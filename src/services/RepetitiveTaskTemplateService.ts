import { db } from '../db';
import {
  RepetitiveTaskTemplateRepository,
  PendingOperationRepository,
} from '../db/repository';
import {
  NewRepetitiveTaskTemplateData,
  DaysInAWeek,
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
    let newId: string;
    try {
      await db.executeAsync('BEGIN TRANSACTION;');

      newId = await this.rttRepo.createRepetitiveTaskTemplate(
        templateData,
        userId,
      );

      if (userId) {
        console.log(
          '[RepetitiveTaskTemplateService] Logged-in user. Enqueuing pending operation.',
        );
        const now = new Date();
        const remotePayload = {
          id: newId,
          isActive: true,
          title: templateData.title,
          description: templateData.description,
          schedule: templateData.schedule,
          priority: 3,
          shouldBeScored: templateData.shouldBeScored === 1,
          monday: templateData.days.includes(DaysInAWeek.Monday),
          tuesday: templateData.days.includes(DaysInAWeek.Tuesday),
          wednesday: templateData.days.includes(DaysInAWeek.Wednesday),
          thursday: templateData.days.includes(DaysInAWeek.Thursday),
          friday: templateData.days.includes(DaysInAWeek.Friday),
          saturday: templateData.days.includes(DaysInAWeek.Saturday),
          sunday: templateData.days.includes(DaysInAWeek.Sunday),
          timeOfDay: templateData.timeOfDay,
          lastDateOfTaskGeneration: null,
          createdAt: now.toISOString(),
          modifiedAt: now.toISOString(),
          tags: [],
          spaceId: templateData.spaceId,
          userId: userId,
        };

        await this.pendingOpRepo.enqueueOperation({
          userId: userId,
          operation_type: 'create',
          entity_type: 'repetitive_task_template',
          entity_id: newId,
          payload: JSON.stringify(remotePayload),
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
    return newId;
  }

  async updateRepetitiveTaskTemplate(
    templateId: string,
    templateData: NewRepetitiveTaskTemplateData,
    userId: string | null,
  ): Promise<void> {
    if (!userId) {
      console.log(
        '[RepetitiveTaskTemplateService] Offline user. Updating local DB only.',
      );
      await this.rttRepo.updateRepetitiveTaskTemplateById(
        templateId,
        templateData,
        userId,
      );
      return;
    }

    console.log(
      '[RepetitiveTaskTemplateService] Logged-in user. Using transactional outbox for update.',
    );

    const now = new Date();

    const originalTemplate = await this.rttRepo.getRepetitiveTaskTemplateById(
      templateId,
      userId,
    );
    if (!originalTemplate) {
      throw new Error(
        `[RepetitiveTaskTemplateService] Cannot update non-existent template with ID ${templateId}`,
      );
    }

    const remotePayload = {
      id: templateId,
      isActive: true,
      title: templateData.title,
      description: templateData.description,
      schedule: templateData.schedule,
      priority: 3,
      shouldBeScored: templateData.shouldBeScored === 1,
      monday: templateData.days.includes(DaysInAWeek.Monday),
      tuesday: templateData.days.includes(DaysInAWeek.Tuesday),
      wednesday: templateData.days.includes(DaysInAWeek.Wednesday),
      thursday: templateData.days.includes(DaysInAWeek.Thursday),
      friday: templateData.days.includes(DaysInAWeek.Friday),
      saturday: templateData.days.includes(DaysInAWeek.Saturday),
      sunday: templateData.days.includes(DaysInAWeek.Sunday),
      timeOfDay: templateData.timeOfDay,
      lastDateOfTaskGeneration: null,
      createdAt: originalTemplate.createdAt,
      modifiedAt: now.toISOString(),
      tags: [],
      spaceId: templateData.spaceId,
    };

    try {
      await db.executeAsync('BEGIN TRANSACTION;');
      await this.rttRepo.updateRepetitiveTaskTemplateById(
        templateId,
        templateData,
        userId,
      );
      await this.pendingOpRepo.enqueueOperation({
        operation_type: 'update',
        entity_type: 'repetitive_task_template',
        entity_id: templateId,
        payload: JSON.stringify(remotePayload),
        userId,
      });
      await db.executeAsync('COMMIT;');

      syncService.runSync();
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
    if (!userId) {
      console.log(
        '[RepetitiveTaskTemplateService] Offline user. Stopping template locally.',
      );
      await this.rttRepo.stopRepetitiveTask(templateId);
      return;
    }

    console.log(
      '[RepetitiveTaskTemplateService] Logged-in user. Using transactional outbox to stop template.',
    );

    const originalTemplate = await this.rttRepo.getRepetitiveTaskTemplateById(
      templateId,
      userId,
    );
    if (!originalTemplate) {
      throw new Error(
        `[RepetitiveTaskTemplateService] Cannot stop non-existent template with ID ${templateId}`,
      );
    }

    const remotePayload = {
      ...originalTemplate,
      isActive: false,
      modifiedAt: new Date().toISOString(),
    };

    try {
      await db.executeAsync('BEGIN TRANSACTION;');
      await this.rttRepo.stopRepetitiveTask(templateId);
      await this.pendingOpRepo.enqueueOperation({
        operation_type: 'update',
        entity_type: 'repetitive_task_template',
        entity_id: templateId,
        payload: JSON.stringify(remotePayload),
        userId,
      });
      await db.executeAsync('COMMIT;');
      console.log(
        `[RepetitiveTaskTemplateService] Transaction for stopping template ${templateId} committed.`,
      );

      syncService.runSync();
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
