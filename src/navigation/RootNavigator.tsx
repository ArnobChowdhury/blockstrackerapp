import React from 'react';
import {
  createBottomTabNavigator,
  BottomTabBarProps,
} from '@react-navigation/bottom-tabs';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {BottomNavigation} from 'react-native-paper';
import {CommonActions} from '@react-navigation/native'; // Import Route type if needed elsewhere

export type RootTabParamList = {
  Today: undefined;
  Active: undefined;
  AddTask: undefined;
};

import TodayScreen from '../screens/TodayScreen';
import ActiveScreen from '../screens/ActiveScreen';
import AddTaskScreen from '../screens/AddTaskScreen';

const Tab = createBottomTabNavigator<RootTabParamList>();

const renderTodayIcon = ({color, size}: {color: string; size: number}) => (
  <MaterialCommunityIcons name="calendar-today" color={color} size={size} />
);

const renderActiveIcon = ({color, size}: {color: string; size: number}) => (
  <MaterialCommunityIcons name="format-list-checks" color={color} size={size} />
);

const addTaskIcon = ({color, size}: {color: string; size: number}) => (
  <MaterialCommunityIcons name="plus" color={color} size={size} />
);

const navigationTabBar = (
  {navigation, state, descriptors, insets}: BottomTabBarProps, // <--- Apply the type here
) => (
  <BottomNavigation.Bar
    navigationState={state}
    safeAreaInsets={insets}
    onTabPress={({route, preventDefault}) => {
      // Now TypeScript knows state.routes is an array of Route objects
      const navigationRoute = state.routes.find(r => r.key === route.key); // No more error for 'r'

      if (!navigationRoute) {
        return;
      }

      const event = navigation.emit({
        type: 'tabPress',
        target: navigationRoute.key,
        canPreventDefault: true,
      });

      if (event.defaultPrevented) {
        preventDefault();
      } else {
        navigation.dispatch({
          ...CommonActions.navigate(
            navigationRoute.name,
            navigationRoute.params,
          ),
          target: state.key,
        });
      }
    }}
    renderIcon={({route, focused, color}) => {
      const {options} = descriptors[route.key];
      if (options.tabBarIcon) {
        return options.tabBarIcon({focused, color, size: 24});
      }
      return null;
    }}
    getLabelText={({route}) => {
      const descriptor = descriptors[route.key];
      const {options} = descriptor;

      const label =
        options.tabBarLabel !== undefined
          ? options.tabBarLabel
          : options.title !== undefined
          ? options.title
          : descriptor.route.name;

      return typeof label === 'string' ? label : '';
    }}
  />
);

const RootNavigator = () => {
  return (
    <Tab.Navigator
      initialRouteName="Today"
      screenOptions={{
        headerShown: false,
      }}
      tabBar={navigationTabBar}>
      <Tab.Screen
        name="Today"
        component={TodayScreen}
        options={{
          title: 'Today',
          tabBarLabel: 'Today',
          tabBarIcon: renderTodayIcon,
        }}
      />
      <Tab.Screen
        name="AddTask"
        component={AddTaskScreen}
        options={{
          title: 'Add Task',
          tabBarLabel: 'Add Task',
          tabBarIcon: addTaskIcon,
        }}
      />
      <Tab.Screen
        name="Active"
        component={ActiveScreen}
        options={{
          title: 'Active',
          tabBarLabel: 'Active',
          tabBarIcon: renderActiveIcon,
        }}
      />
    </Tab.Navigator>
  );
};

export default RootNavigator;
