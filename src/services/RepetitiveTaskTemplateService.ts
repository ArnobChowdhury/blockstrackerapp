import { db } from '../db';
import {
  RepetitiveTaskTemplateRepository,
  PendingOperationRepository,
} from '../db/repository';
import { NewRepetitiveTaskTemplateData, DaysInAWeek } from '../types';
import uuid from 'react-native-uuid';

export class RepetitiveTaskTemplateService {
  private rttRepo: RepetitiveTaskTemplateRepository;
  private pendingOpRepo: PendingOperationRepository;

  constructor() {
    this.rttRepo = new RepetitiveTaskTemplateRepository(db);
    this.pendingOpRepo = new PendingOperationRepository(db);
  }

  async createRepetitiveTaskTemplate(
    templateData: NewRepetitiveTaskTemplateData,
    isLoggedIn: boolean,
  ): Promise<string> {
    if (!isLoggedIn) {
      console.log(
        '[RepetitiveTaskTemplateService] Offline user. Writing to local DB only.',
      );
      return await this.rttRepo.createRepetitiveTaskTemplate(templateData);
    }

    console.log(
      '[RepetitiveTaskTemplateService] Logged-in user. Using transactional outbox.',
    );

    const now = new Date();
    const newId = uuid.v4() as string;

    const localPayload = { ...templateData, id: newId };

    const remotePayload = {
      id: newId,
      isActive: true,
      title: templateData.title,
      description: templateData.description,
      schedule: templateData.schedule,
      priority: 3, // Default priority
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
    };

    try {
      await db.executeAsync('BEGIN TRANSACTION;');
      await this.rttRepo._internalAddRepetitiveTaskTemplate(localPayload);
      await this.pendingOpRepo.enqueueOperation({
        operation_type: 'create',
        entity_type: 'repetitive_task_template',
        entity_id: newId,
        payload: JSON.stringify(remotePayload),
      });
      await db.executeAsync('COMMIT;');
      return newId;
    } catch (error) {
      console.error(
        `[RepetitiveTaskTemplateService] Transaction for creating template ${newId} failed. Rolling back.`,
        error,
      );
      await db.executeAsync('ROLLBACK;');
      throw error;
    }
  }
}
