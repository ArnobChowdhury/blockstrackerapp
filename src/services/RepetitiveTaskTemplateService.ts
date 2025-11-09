import { db } from '../db';
import {
  RepetitiveTaskTemplateRepository,
  PendingOperationRepository,
} from '../db/repository';
import {
  NewRepetitiveTaskTemplateData,
  RepetitiveTaskTemplate,
  NewTaskData,
  TaskScheduleTypeEnum,
} from '../types';
import { TaskService } from './TaskService';
import dayjs, { Dayjs } from 'dayjs';
import { syncService } from './SyncService';

export class RepetitiveTaskTemplateService {
  private rttRepo: RepetitiveTaskTemplateRepository;
  private pendingOpRepo: PendingOperationRepository;
  private taskService: TaskService;

  constructor() {
    this.rttRepo = new RepetitiveTaskTemplateRepository(db);
    this.pendingOpRepo = new PendingOperationRepository(db);
    this.taskService = new TaskService();
  }

  async getRepetitiveTaskTemplateById(
    id: string,
    userId: string | null,
  ): Promise<RepetitiveTaskTemplate | null> {
    return this.rttRepo.getRepetitiveTaskTemplateById(id, userId);
  }

  async createRepetitiveTaskTemplate(
    templateData: NewRepetitiveTaskTemplateData,
    userId: string | null,
  ): Promise<string> {
    let newTemplate: RepetitiveTaskTemplate;
    try {
      await db.executeAsync('BEGIN TRANSACTION;');

      newTemplate = await this.rttRepo.createRepetitiveTaskTemplate(
        templateData,
        userId,
      );

      if (userId) {
        console.log(
          '[RepetitiveTaskTemplateService] Logged-in user. Enqueuing pending operation.',
        );

        await this.pendingOpRepo.enqueueOperation({
          userId: userId,
          operation_type: 'create',
          entity_type: 'repetitive_task_template',
          entity_id: newTemplate.id,
          payload: JSON.stringify({ ...newTemplate, tags: [] }),
        });
      }

      await db.executeAsync('COMMIT;');

      if (userId) {
        syncService.runSync();
      }
    } catch (error) {
      console.error(
        '[RepetitiveTaskTemplateService] Transaction for creating template failed. Rolling back.',
        error,
      );
      await db.executeAsync('ROLLBACK;');
      throw error;
    }
    return newTemplate.id;
  }

  async updateRepetitiveTaskTemplate(
    templateId: string,
    templateData: NewRepetitiveTaskTemplateData,
    userId: string | null,
  ): Promise<void> {
    try {
      await db.executeAsync('BEGIN TRANSACTION;');

      const updatedTemplate =
        await this.rttRepo.updateRepetitiveTaskTemplateById(
          templateId,
          templateData,
          userId,
        );

      if (userId) {
        if (!updatedTemplate) {
          throw new Error(
            `[RepetitiveTaskTemplateService] Cannot update non-existent or unauthorized template with ID ${templateId}`,
          );
        }

        console.log(
          '[RepetitiveTaskTemplateService] Logged-in user. Enqueuing pending operation for update.',
        );

        const remotePayload = { ...updatedTemplate, tags: [] };

        await this.pendingOpRepo.enqueueOperation({
          operation_type: 'update',
          entity_type: 'repetitive_task_template',
          entity_id: templateId,
          payload: JSON.stringify(remotePayload),
          userId,
        });
      }

      await db.executeAsync('COMMIT;');

      if (userId) {
        syncService.runSync();
      }
    } catch (error) {
      console.error(
        `[RepetitiveTaskTemplateService] Transaction for updating template ${templateId} failed. Rolling back.`,
        error,
      );
      await db.executeAsync('ROLLBACK;');
      throw error;
    }
  }

  async stopRepetitiveTask(
    templateId: string,
    userId: string | null,
  ): Promise<void> {
    try {
      await db.executeAsync('BEGIN TRANSACTION;');

      const originalTemplate = await this.rttRepo.stopRepetitiveTask(
        templateId,
        userId,
      );

      if (userId) {
        console.log(
          '[RepetitiveTaskTemplateService] Logged-in user. Enqueuing pending operation to stop template.',
        );
        if (!originalTemplate) {
          throw new Error(
            `[RepetitiveTaskTemplateService] Cannot stop non-existent or unauthorized template with ID ${templateId}`,
          );
        }

        const remotePayload = { ...originalTemplate };

        await this.pendingOpRepo.enqueueOperation({
          operation_type: 'update',
          entity_type: 'repetitive_task_template',
          entity_id: templateId,
          payload: JSON.stringify(remotePayload),
          userId,
        });
      }

      await db.executeAsync('COMMIT;');

      if (userId) {
        syncService.runSync();
      }
    } catch (error) {
      console.error(
        `[RepetitiveTaskTemplateService] Transaction for stopping template ${templateId} failed. Rolling back.`,
        error,
      );
      await db.executeAsync('ROLLBACK;');
      throw error;
    }
  }

  async updateLastDateOfTaskGeneration(
    templateId: string,
    lastDate: string,
    userId: string | null,
  ): Promise<void> {
    const updatedTemplate = await this.rttRepo.updateLastDateOfTaskGeneration(
      templateId,
      lastDate,
    );

    if (userId) {
      if (!updatedTemplate) {
        throw new Error(
          `[RepetitiveTaskTemplateService] Cannot update last generation date for non-existent template with ID ${templateId}`,
        );
      }

      console.log(
        '[RepetitiveTaskTemplateService] Enqueuing pending operation for last_date_of_task_generation update.',
      );

      await this.pendingOpRepo.enqueueOperation({
        operation_type: 'update',
        entity_type: 'repetitive_task_template',
        entity_id: templateId,
        payload: JSON.stringify({ ...updatedTemplate, tags: [] }),
        userId,
      });
    }
  }

  async generateDueRepetitiveTasks(userId: string | null): Promise<void> {
    console.log(
      '[RepetitiveTaskTemplateService] Starting generation of due tasks...',
    );
    const dueTemplates = await this.rttRepo.getDueRepetitiveTaskTemplates(
      userId,
    );

    if (dueTemplates.length === 0) {
      console.log(
        '[RepetitiveTaskTemplateService] No due templates to process.',
      );
      return;
    }

    const isPremium = !!userId;

    for (const template of dueTemplates) {
      try {
        await db.executeAsync('BEGIN TRANSACTION;');

        const todayStart = dayjs().startOf('day');
        let lastGenDate = template.lastDateOfTaskGeneration;

        if (!lastGenDate) {
          const templateCreationDate = dayjs(template.createdAt).startOf('day');
          lastGenDate = templateCreationDate.isSame(todayStart)
            ? todayStart.subtract(1, 'day').toISOString()
            : template.createdAt;
        }

        const daysToGenerate = todayStart.diff(
          dayjs(lastGenDate).startOf('day'),
          'day',
        );

        let latestDueDateForTemplate: Dayjs | undefined;

        for (let i = 0; i < daysToGenerate; i += 1) {
          const targetDueDate = dayjs(lastGenDate)
            .startOf('day')
            .add(i + 1, 'day');
          const dayOfWeekLowercase = targetDueDate
            .format('dddd')
            .toLowerCase() as keyof RepetitiveTaskTemplate;

          let shouldGenerateTask = false;
          if (template.schedule === TaskScheduleTypeEnum.Daily) {
            shouldGenerateTask = true;
          } else if (
            template.schedule === TaskScheduleTypeEnum.SpecificDaysInAWeek
          ) {
            shouldGenerateTask = !!template[dayOfWeekLowercase];
          }

          if (shouldGenerateTask) {
            const newTaskData: NewTaskData = {
              title: template.title,
              description: template.description || undefined,
              schedule: template.schedule,
              dueDate: targetDueDate.toDate(),
              timeOfDay: template.timeOfDay,
              repetitiveTaskTemplateId: template.id,
              shouldBeScored: template.shouldBeScored ? 1 : 0,
              spaceId: template.spaceId,
            };

            await this.taskService._createTaskInternal(newTaskData, userId);
            latestDueDateForTemplate = targetDueDate;
          }
        }

        if (latestDueDateForTemplate) {
          await this.updateLastDateOfTaskGeneration(
            template.id,
            latestDueDateForTemplate.toISOString(),
            userId,
          );
        }

        await db.executeAsync('COMMIT;');
      } catch (error) {
        console.error(
          `[RepetitiveTaskTemplateService] Transaction failed for template ${template.id}. Rolling back.`,
          error,
        );
        await db.executeAsync('ROLLBACK;');
      }
    }

    if (isPremium) {
      syncService.runSync();
    }
  }

  async getAllActiveDailyRepetitiveTaskTemplates(
    userId: string | null,
  ): Promise<RepetitiveTaskTemplate[]> {
    return this.rttRepo.getAllActiveDailyRepetitiveTaskTemplates(userId);
  }

  async getAllActiveSpecificDaysInAWeekRepetitiveTaskTemplates(
    userId: string | null,
  ): Promise<RepetitiveTaskTemplate[]> {
    return this.rttRepo.getAllActiveSpecificDaysInAWeekRepetitiveTaskTemplates(
      userId,
    );
  }

  async getActiveDailyRepetitiveTaskTemplatesBySpace(
    spaceId: string,
    userId: string | null,
  ): Promise<RepetitiveTaskTemplate[]> {
    return this.rttRepo.getActiveDailyRepetitiveTaskTemplatesBySpace(
      userId,
      spaceId,
    );
  }

  async getActiveSpecificDaysInAWeekRepetitiveTaskTemplatesBySpace(
    spaceId: string,
    userId: string | null,
  ): Promise<RepetitiveTaskTemplate[]> {
    return this.rttRepo.getActiveSpecificDaysInAWeekRepetitiveTaskTemplatesBySpace(
      userId,
      spaceId,
    );
  }

  async countAllActiveRepetitiveTasksByCategory(userId: string | null) {
    return this.rttRepo.countAllActiveRepetitiveTasksByCategory(userId);
  }

  async countActiveRepetitiveTasksBySpaceId(
    spaceId: string,
    userId: string | null,
  ) {
    if (!spaceId) {
      throw new Error('A spaceId must be provided.');
    }

    return this.rttRepo.countActiveRepetitiveTasksBySpaceId(spaceId, userId);
  }
}
