import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Drawer, Text } from 'react-native-paper';
import {
  DrawerContentScrollView,
  DrawerContentComponentProps,
} from '@react-navigation/drawer';
import { SegmentedButtons } from 'react-native-paper';
import { useAppContext } from '../contexts/useAppContext';

export default function CustomDrawerContent(
  props: DrawerContentComponentProps,
) {
  const { navigation, state } = props;
  const activeRoute = state.routeNames[state.index];

  const { currentTheme, changeTheme } = useAppContext();

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
          <View style={styles.modeContainer}>
            <Text style={styles.modeHeader} variant="bodyMedium">
              Mode
            </Text>
            <SegmentedButtons
              value={currentTheme}
              onValueChange={changeTheme}
              buttons={[
                {
                  value: 'light',
                  label: 'Light',
                  icon: 'white-balance-sunny',
                },
                {
                  value: 'dark',
                  label: 'Dark',
                  icon: 'moon-waxing-crescent',
                },
                { value: 'system', label: 'System', icon: 'cellphone' },
              ]}
            />
          </View>
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
});
