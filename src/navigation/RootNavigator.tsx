import React from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

export type RootTabParamList = {
  Today: undefined;
  Active: undefined;
};

import TodayScreen from '../screens/TodayScreen';
import ActiveScreen from '../screens/ActiveScreen';

const Tab = createBottomTabNavigator<RootTabParamList>();

// Define the icon rendering functions outside the component's render path
const renderTodayIcon = ({color, size}: {color: string; size: number}) => (
  <MaterialCommunityIcons name="calendar-today" color={color} size={size} />
);

const renderActiveIcon = ({color, size}: {color: string; size: number}) => (
  <MaterialCommunityIcons name="format-list-checks" color={color} size={size} />
);

const RootNavigator = () => {
  return (
    // Use Tab.Navigator instead of Stack.Navigator
    <Tab.Navigator
      initialRouteName="Today"
      screenOptions={{
        tabBarActiveTintColor: '#6200ee', // Color for active tab
        tabBarInactiveTintColor: 'gray', // Color for inactive tabs
      }}>
      <Tab.Screen
        name="Today"
        component={TodayScreen}
        options={{
          title: 'Today', // Header title
          tabBarLabel: 'Today', // Text label for the tab
          tabBarIcon: renderTodayIcon,
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
