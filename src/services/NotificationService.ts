import notifee, {
  TimestampTrigger,
  TriggerType,
  AuthorizationStatus,
} from '@notifee/react-native';
import {
  TaskRepository,
  RepetitiveTaskTemplateRepository,
} from '../db/repository';
import { deviceSettingsService } from './DeviceSettingsService';
import { TimeOfDay } from '../types';
import dayjs from 'dayjs';
import { db } from '../db';
import { ANDROID_TASK_REMINDER_NOTIFICATION_CHANNEL_ID } from '../shared/constants';

class NotificationService {
  private rttRepo: RepetitiveTaskTemplateRepository;
  private taskRepo: TaskRepository;

  constructor() {
    this.rttRepo = new RepetitiveTaskTemplateRepository(db);
    this.taskRepo = new TaskRepository(db);
    console.log('[NotificationService] Initialized.');
  }

  /**
   * Requests permission from the user to display notifications.
   * Required for iOS and Android 13+.
   * @returns {Promise<boolean>} - True if permission is granted, false otherwise.
   */
  public async requestPermissions(): Promise<boolean> {
    console.log('[NotificationService] Requesting notification permissions...');
    try {
      const settings = await notifee.requestPermission();
      const isGranted =
        settings.authorizationStatus === AuthorizationStatus.AUTHORIZED ||
        settings.authorizationStatus === AuthorizationStatus.PROVISIONAL;

      if (isGranted) {
        console.log('[NotificationService] Permission granted.');
        return true;
      } else {
        console.log('[NotificationService] Permission denied.');
        return false;
      }
    } catch (error) {
      console.error(
        '[NotificationService] Failed to request permissions:',
        error,
      );
      return false;
    }
  }

  /**
   * The core logic. It cancels all existing notifications and schedules new ones
   * based on the current state of tasks in the local database.
   */
  public async recalculateAndScheduleNotifications(
    userId: string | null,
  ): Promise<void> {
    console.log(
      `[NotificationService] Recalculating notifications for user: ${userId}`,
    );

    try {
      const deviceSettings = await deviceSettingsService.getSettings();
      if (!deviceSettings.notificationsEnabled) {
        console.log(
          '[NotificationService] Notifications are disabled. Aborting.',
        );
        await this.cancelAllNotifications();
        return;
      }

      await notifee.cancelTriggerNotifications();
      console.log(
        '[NotificationService] Cleared all previously scheduled triggers.',
      );

      const schedule: Record<TimeOfDay, { hour: number; title: string }> = {
        [TimeOfDay.Morning]: { hour: 8, title: 'Your Morning Tasks' },
        [TimeOfDay.Afternoon]: { hour: 12, title: 'Your Afternoon Tasks' },
        [TimeOfDay.Evening]: { hour: 17, title: 'Your Evening Tasks' },
        [TimeOfDay.Night]: { hour: 20, title: 'Your Nightly Tasks' },
      };

      const now = dayjs();

      for (const time of Object.values(TimeOfDay)) {
        const slot = schedule[time];
        let notificationTime = dayjs().hour(slot.hour).minute(0).second(0);

        if (notificationTime.isBefore(now)) {
          notificationTime = notificationTime.add(1, 'day');
        }

        const dateForQuery = notificationTime.toDate();

        const incompleteTaskCount =
          await this.taskRepo.getIncompleteTasksCountForTimeOfDay(
            userId,
            time,
            dateForQuery,
          );
        const incompleteRttCount =
          await this.rttRepo.getCountOfIncompleteRepetitiveTasksForTimeOfDay(
            userId,
            time,
            dateForQuery,
          );
        const totalIncomplete = incompleteTaskCount + incompleteRttCount;

        if (totalIncomplete > 0) {
          console.log(
            `[NotificationService] Scheduling notification for ${time} on ${notificationTime.format()} with ${totalIncomplete} tasks.`,
          );

          const trigger: TimestampTrigger = {
            type: TriggerType.TIMESTAMP,
            timestamp: notificationTime.valueOf(),
          };

          await notifee.createTriggerNotification(
            {
              id: time, // Use a fixed ID (e.g., 'Morning') to prevent duplicates
              title: slot.title,
              body: `You have ${totalIncomplete} task${
                totalIncomplete > 1 ? 's' : ''
              } to complete.`,
              android: {
                channelId: ANDROID_TASK_REMINDER_NOTIFICATION_CHANNEL_ID,
                smallIcon: 'ic_notification',
                largeIcon: 'ic_notification_large',
                color: '#008ab4',
                pressAction: {
                  id: 'default',
                },
              },
            },
            trigger,
          );
        }
      }
    } catch (error) {
      console.error(
        '[NotificationService] Failed during recalculation:',
        error,
      );
    }
  }

  /**
   * Cancels all currently scheduled (and displayed) notifications.
   * Used when the user disables notifications in settings.
   */
  public async cancelAllNotifications(): Promise<void> {
    console.log('[NotificationService] Cancelling all notifications...');
    await notifee.cancelAllNotifications();
  }

  /**
   * Sends a test notification 5 seconds from now.
   * Useful for verifying permissions and appearance.
   */
  public async sendTestNotification(): Promise<void> {
    console.log('[NotificationService] Scheduling test notification for 5s...');
    const trigger: TimestampTrigger = {
      type: TriggerType.TIMESTAMP,
      timestamp: Date.now() + 5000, // 5 seconds from now
    };

    await notifee.createTriggerNotification(
      {
        id: 'test_notification',
        title: 'Test Notification',
        body: 'This is a test notification to verify the system works.',
        android: {
          channelId: ANDROID_TASK_REMINDER_NOTIFICATION_CHANNEL_ID,
          smallIcon: 'ic_notification',
          largeIcon: 'ic_notification_large',
          color: '#008ab4',
          pressAction: {
            id: 'default',
          },
        },
      },
      trigger,
    );
  }
}

export const notificationService = new NotificationService();
