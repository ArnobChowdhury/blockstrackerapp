import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import {
  List,
  Switch,
  SegmentedButtons,
  Divider,
  useTheme,
  // Button,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppContext } from '../shared/contexts/useAppContext';
import { deviceSettingsService } from '../services/DeviceSettingsService';
import { notificationService } from '../services/NotificationService';
import { iapService } from '../services/IAPService';

const SettingsScreen = () => {
  const { user, userPreferredTheme, changeTheme } = useAppContext();
  const theme = useTheme();
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

  const handleRestorePurchase = useCallback(async () => {
    setIsLoading(true);
    try {
      await iapService.restorePurchases();
      Alert.alert('Success', 'Purchase restored successfully.');
    } catch (error: any) {
      Alert.alert(
        'Restore Failed',
        error.message || 'Could not find a purchase to restore.',
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

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
      <Divider />
      <List.Section>
        <List.Subheader>Premium</List.Subheader>
        {user?.isPremium && (
          <List.Item
            title="Premium Active"
            description="Thank you for supporting BlocksTracker!"
            left={props => (
              <List.Icon {...props} icon="crown" color={theme.colors.primary} />
            )}
          />
        )}
        <List.Item
          title="Restore Purchase"
          description="Restore your subscription if you reinstalled the app."
          onPress={handleRestorePurchase}
          left={props => <List.Icon {...props} icon="restore" />}
          disabled={isLoading}
        />
      </List.Section>
      {/* <Divider />
      <List.Section>
        <List.Subheader>Debug</List.Subheader>
        <Button
          mode="contained"
          onPress={() => notificationService.sendTestNotification()}
          style={styles.debugButton}>
          Test Notification (5s)
        </Button>
      </List.Section> */}
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
  debugButton: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
});

export default SettingsScreen;
