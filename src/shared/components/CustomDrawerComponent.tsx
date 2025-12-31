import React from 'react';
import { StyleSheet, View, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Drawer, Text } from 'react-native-paper';
import {
  DrawerContentScrollView,
  DrawerContentComponentProps,
} from '@react-navigation/drawer';
import { useAppContext } from '../../shared/contexts/useAppContext';
import { iapService } from '../../services/IAPService';

export default function CustomDrawerContent(
  props: DrawerContentComponentProps,
) {
  const { navigation, state } = props;
  const activeRoute = state.routeNames[state.index];

  const { user, signOut } = useAppContext();

  const handlePurchase = async () => {
    if (!user) {
      Alert.alert(
        'Sign In Required',
        'You need to be signed in to upgrade to Premium.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign In', onPress: () => navigation.navigate('Auth') },
        ],
      );
      return;
    }

    try {
      await iapService.requestPurchase();
    } catch (error) {
      console.error('Purchase failed', error);
      Alert.alert('Error', 'Failed to initiate purchase.');
    }
  };

  return (
    <SafeAreaView style={styles.flexOne}>
      <DrawerContentScrollView
        {...props}
        contentContainerStyle={styles.flexOne}>
        <Drawer.Section>
          <Drawer.Item
            label="Today"
            active={activeRoute === 'Home'}
            onPress={() => navigation.navigate('Home')}
            style={styles.item}
          />
          <Drawer.Item
            label="Overdue"
            active={activeRoute === 'Overdue'}
            onPress={() => navigation.navigate('Overdue')}
            style={styles.item}
          />
          {!user?.isPremium && (
            <Drawer.Item
              label="Go Premium"
              icon="star"
              onPress={handlePurchase}
              style={styles.item}
            />
          )}
          <Drawer.Item
            label="Settings"
            active={activeRoute === 'Settings'}
            onPress={() => navigation.navigate('Settings')}
            style={styles.item}
          />
          {user ? (
            <View style={styles.modeContainer}>
              <Text variant="bodyMedium">{user.email}</Text>
              <Drawer.Item
                label="Sign Out"
                onPress={signOut}
                style={styles.signOutButton}
                icon="logout"
              />
            </View>
          ) : (
            <Drawer.Item
              label="Sign in or Sign up"
              onPress={() => navigation.navigate('Auth')}
              style={styles.item}
            />
          )}
        </Drawer.Section>
      </DrawerContentScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flexOne: {
    flex: 1,
  },
  item: {
    borderRadius: 3,
  },
  modeContainer: {
    paddingLeft: 12,
    paddingRight: 16,
    paddingVertical: 20,
  },
  modeHeader: {
    paddingLeft: 16,
    marginBottom: 10,
  },
  signOutButton: {
    marginLeft: 0,
  },
});
