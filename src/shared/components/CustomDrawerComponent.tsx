import React from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Drawer } from 'react-native-paper';
import {
  DrawerContentScrollView,
  DrawerContentComponentProps,
} from '@react-navigation/drawer';

export default function CustomDrawerContent(
  props: DrawerContentComponentProps,
) {
  const { navigation, state } = props;
  const activeRoute = state.routeNames[state.index];

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
});
