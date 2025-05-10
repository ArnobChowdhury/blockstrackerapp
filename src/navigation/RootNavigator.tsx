import React from 'react';
import {
  createBottomTabNavigator,
  BottomTabBarProps,
} from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { BottomNavigation, useTheme } from 'react-native-paper';
import { CommonActions } from '@react-navigation/native';
import { StyleSheet } from 'react-native';
import TodayScreen from '../screens/TodayScreen';
import AddTaskScreen from '../screens/AddTaskScreen';
import ActiveCategoryListScreen from '../screens/ActiveCategoryListScreen';
import ActiveTaskListScreen from '../screens/ActiveTaskListScreen';
import { TaskScheduleTypeEnum } from '../types';
import { CalendarToday, PlusIcon } from '../shared/components/icons';

export type ActiveStackParamList = {
  ActiveCategoryList: undefined;
  ActiveTaskList: { category: TaskScheduleTypeEnum };
};

export type RootTabParamList = {
  Today: undefined;
  ActiveStack: undefined;
  AddTask: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();
const Stack = createNativeStackNavigator<ActiveStackParamList>();

const ActiveStackNavigator = () => {
  return (
    <Stack.Navigator
      initialRouteName="ActiveCategoryList"
      // screenOptions={{}}
    >
      <Stack.Screen
        name="ActiveCategoryList"
        component={ActiveCategoryListScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen name="ActiveTaskList" component={ActiveTaskListScreen} />
    </Stack.Navigator>
  );
};

interface IconProps {
  color: string;
  size: number;
  focused: boolean;
}

const renderTodayIcon = () => {
  return ({ color, size, focused }: IconProps) => {
    const theme = useTheme();

    return (
      <CalendarToday
        size={size}
        color={focused ? theme.colors.primary : color}
        date={new Date().getDate()}
      />
    );
  };
};

const renderActiveIcon = () => {
  return ({ color, size, focused }: IconProps) => {
    const theme = useTheme();

    return (
      <MaterialCommunityIcons
        name="run"
        color={focused ? theme.colors.primary : color}
        size={size}
      />
    );
  };
};

const addTaskIcon = () => {
  return ({ color, size, focused }: IconProps) => {
    const theme = useTheme();

    return (
      <PlusIcon size={size} color={focused ? theme.colors.primary : color} />
    );
  };
};

const navigationTabBar = ({
  navigation,
  state,
  descriptors,
  insets,
}: BottomTabBarProps) => (
  <BottomNavigation.Bar
    activeIndicatorStyle={styles.activeTabIndicator}
    navigationState={state}
    safeAreaInsets={insets}
    onTabPress={({ route, preventDefault }) => {
      const navigationRoute = state.routes.find(r => r.key === route.key);
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
    renderIcon={({ route, focused, color }) => {
      const { options } = descriptors[route.key];
      if (options.tabBarIcon) {
        return options.tabBarIcon({ focused, color, size: 32 });
      }
      return null;
    }}
    getLabelText={({ route }) => {
      const descriptor = descriptors[route.key];
      const { options } = descriptor;
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
          tabBarIcon: renderTodayIcon(),
        }}
      />
      <Tab.Screen
        name="AddTask"
        component={AddTaskScreen}
        options={{
          title: 'Add Task',
          tabBarLabel: 'Add Task',
          tabBarIcon: addTaskIcon(),
        }}
      />
      <Tab.Screen
        name="ActiveStack"
        component={ActiveStackNavigator}
        options={{
          title: 'Active',
          tabBarLabel: 'Active',
          tabBarIcon: renderActiveIcon(),
        }}
      />
    </Tab.Navigator>
  );
};

export default RootNavigator;

const styles = StyleSheet.create({
  activeTabIndicator: {
    width: 8,
    height: 8,
    top: 42,
    borderRadius: 10,
  },
});
