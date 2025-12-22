import AsyncStorage from '@react-native-async-storage/async-storage';

const SETTINGS_KEY = 'deviceSettings';

export interface DeviceSettings {
  notificationsEnabled: boolean;
}

const defaultSettings: DeviceSettings = {
  notificationsEnabled: true,
};

class DeviceSettingsService {
  async getSettings(): Promise<DeviceSettings> {
    try {
      const settingsJson = await AsyncStorage.getItem(SETTINGS_KEY);
      if (settingsJson) {
        const storedSettings = JSON.parse(settingsJson);
        // Merge with defaults to ensure all keys are present if new ones are added later
        return { ...defaultSettings, ...storedSettings };
      }
    } catch (error) {
      console.error(
        '[DeviceSettingsService] Failed to get settings, returning defaults.',
        error,
      );
    }
    return defaultSettings;
  }

  async setSettings(newSettings: Partial<DeviceSettings>): Promise<void> {
    try {
      const currentSettings = await this.getSettings();
      const updatedSettings = { ...currentSettings, ...newSettings };
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(updatedSettings));
    } catch (error) {
      console.error('[DeviceSettingsService] Failed to set settings.', error);
    }
  }
}

export const deviceSettingsService = new DeviceSettingsService();
