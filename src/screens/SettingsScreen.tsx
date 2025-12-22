import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { List, Switch, SegmentedButtons, Divider } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppContext } from '../shared/contexts/useAppContext';
import { deviceSettingsService } from '../services/DeviceSettingsService';
import { notificationService } from '../services/NotificationService';

const SettingsScreen = () => {
  const { user, userPreferredTheme, changeTheme } = useAppContext();
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadSettings = async () => {
      setIsLoading(true);
      const settings = await deviceSettingsService.getSettings();
      setNotificationsEnabled(settings.notificationsEnabled);
      setIsLoading(false);
    };
    loadSettings();
  }, []);

  const handleNotificationsToggle = useCallback(
    async (isChecked: boolean) => {
      if (isChecked) {
        const permissionGranted =
          await notificationService.requestPermissions();
        if (permissionGranted) {
          setNotificationsEnabled(true);
          await deviceSettingsService.setSettings({
            notificationsEnabled: true,
          });
          await notificationService.recalculateAndScheduleNotifications(
            user ? user.id : null,
          );
        } else {
          Alert.alert(
            'Permission Required',
            'To enable notifications, please grant permission in your device settings.',
          );
        }
      } else {
        setNotificationsEnabled(false);
        await deviceSettingsService.setSettings({
          notificationsEnabled: false,
        });
        await notificationService.cancelAllNotifications();
      }
    },
    [user],
  );

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <List.Section>
        <List.Subheader>Appearance</List.Subheader>
        <View style={styles.themeContainer}>
          <SegmentedButtons
            value={userPreferredTheme}
            onValueChange={changeTheme}
            buttons={[
              { value: 'light', label: 'Light', icon: 'white-balance-sunny' },
              { value: 'dark', label: 'Dark', icon: 'moon-waxing-crescent' },
              { value: 'system', label: 'System', icon: 'cellphone' },
            ]}
          />
        </View>
      </List.Section>
      <Divider />
      <List.Section>
        <List.Subheader>Notifications</List.Subheader>
        <List.Item
          title="Task Reminders"
          description="Get reminders at 8 AM, 12 PM, 5 PM, and 8 PM"
          right={() => (
            <Switch
              value={notificationsEnabled}
              onValueChange={handleNotificationsToggle}
              disabled={isLoading}
            />
          )}
        />
      </List.Section>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  themeContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
});

export default SettingsScreen;
