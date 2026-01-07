import BackgroundFetch from 'react-native-background-fetch';
import * as Keychain from 'react-native-keychain';
import { jwtDecode } from 'jwt-decode';
import { initializeDatabase } from '../db';
import { deviceSettingsService } from './DeviceSettingsService';
import { syncService } from './SyncService';
import { notificationService } from './NotificationService';

export const backgroundTask = async (event: any) => {
  const { taskId } = event;
  const isTimeout = event.timeout;

  console.log('[BackgroundFetch] Headless task started:', taskId);

  if (isTimeout) {
    console.log('[BackgroundFetch] Headless task timed out:', taskId);
    BackgroundFetch.finish(taskId);
    return;
  }

  try {
    await initializeDatabase();

    let userId: string | null = null;
    let isPremium: boolean = false;

    try {
      const credentials = await Keychain.getGenericPassword();
      if (credentials) {
        const accessToken = credentials.password;
        const decoded = jwtDecode<{ user_id: string; is_premium: boolean }>(
          accessToken,
        );
        if (decoded.user_id) {
          userId = decoded.user_id;
        }
        if (decoded.is_premium) {
          isPremium = decoded.is_premium;
        }
      }
    } catch (error) {
      console.error(
        '[BackgroundFetch] Failed to retrieve or decode token:',
        error,
      );
    }

    if (userId && isPremium) {
      console.log(`[BackgroundFetch] Running sync for user: ${userId}`);
      try {
        await syncService.runSync(userId);
      } catch (error) {
        console.error('[BackgroundFetch] Sync failed:', error);
      }
    } else {
      console.log(
        '[BackgroundFetch] Sync skipped. User not logged in or not Premium.',
      );
    }

    const settings = await deviceSettingsService.getSettings();
    if (!settings.notificationsEnabled) {
      console.log(
        '[BackgroundFetch] Notifications are disabled. Skipping task.',
      );
      BackgroundFetch.finish(taskId);
      return;
    }

    console.log('[BackgroundFetch] Recalculating notifications...');
    await notificationService.recalculateAndScheduleNotifications(userId);
  } catch (error) {
    console.error('[BackgroundFetch] Headless task failed:', error);
  }

  BackgroundFetch.finish(taskId);
};
