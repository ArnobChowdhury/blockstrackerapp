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

  async generateDueRepetitiveTasks(userId: string | null): Promise<void> {
    console.log('[RepetitiveTaskTemplateService] Generating due tasks...');
    const todayStart = dayjs().startOf('day');

    try {
      const dueTemplates = await this.rttRepo.getDueRepetitiveTaskTemplates(
        userId,
      );

      if (dueTemplates.length === 0) {
        console.log(
          '[RepetitiveTaskTemplateService] No due templates to process.',
        );
        return;
      }

      for (const template of dueTemplates) {
        let lastGenDateOrCreatedAt: Dayjs | string =
          template.lastDateOfTaskGeneration || template.createdAt;

        if (!template.lastDateOfTaskGeneration) {
          const templateCreationDate = dayjs(template.createdAt)
            .startOf('day')
            .toISOString();
          if (templateCreationDate === todayStart.toISOString()) {
            lastGenDateOrCreatedAt = todayStart.subtract(1, 'day');
          }
        }

        const daysToGenerate = todayStart.diff(
          dayjs(lastGenDateOrCreatedAt).startOf('day'),
          'day',
        );

        for (let i = 0; i < daysToGenerate; i++) {
          const targetDueDate = dayjs(lastGenDateOrCreatedAt)
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
              spaceId: template.spaceId || null,
            };

            try {
              await this.taskService.createTask(newTaskData, userId);
              await this.rttRepo.updateLastDateOfTaskGeneration(
                template.id,
                targetDueDate.toISOString(),
              );
            } catch (error) {
              console.error(
                `[RepetitiveTaskTemplateService] Error processing template ${
                  template.id
                } for date ${targetDueDate.toISOString()}:`,
                error,
              );
            }
          }
        }
      }
    } catch (error) {
      console.error(
        '[RepetitiveTaskTemplateService] Failed to generate due tasks:',
        error,
      );
      throw error;
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
