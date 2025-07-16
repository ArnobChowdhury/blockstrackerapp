import React from 'react';
import {
  createBottomTabNavigator,
  BottomTabBarProps,
} from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { BottomNavigation, useTheme, Text } from 'react-native-paper';
import { CommonActions, NavigatorScreenParams } from '@react-navigation/native';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { StyleSheet } from 'react-native';
import TodayScreen from '../screens/TodayScreen';
import HabitsScreen from '../screens/HabitsScreen';
import TrackerScreen from '../screens/TrackerScreen';
import AddTaskScreen from '../screens/AddTaskScreen';
import EditTaskScreen from '../screens/EditTaskScreen';
import ActiveCategoryListScreen from '../screens/ActiveCategoryListScreen';
import ActiveTaskListScreen from '../screens/ActiveTaskListScreen';
import TaskDescriptionScreen from '../screens/TaskDescription';
import OverdueScreen from '../screens/OverdueTasksScreen';
import { TaskScheduleTypeEnum, RepetitiveTaskTemplate } from '../types';
import {
  CalendarToday,
  PlusIcon,
  TrackerIcon,
} from '../shared/components/icons';
import CustomDrawerContent from '../shared/components/CustomDrawerComponent';

export type ActiveStackParamList = {
  ActiveCategoryList: undefined;
  ActiveTaskList: { category: TaskScheduleTypeEnum; spaceId?: number };
};

export type TrackerStackParamList = {
  HabitsList: undefined;
  Tracker: { habit: RepetitiveTaskTemplate };
};

export type BottomTabParamList = {
  Today: undefined;
  AddTask: { isToday?: boolean; updatedDescription?: string } | undefined;
  ActiveStack: undefined;
  HabitsTracker: undefined;
};

export type RootStackParamList = {
  EditTask: {
    taskId?: number;
    isRepetitiveTaskTemplate?: boolean;
    isToday?: boolean;
    updatedDescription?: string;
  };
  TaskDescription: {
    initialHTML: string;
    source: 'AddTask' | 'EditTask';
  };
  Overdue: undefined;
  Drawer: NavigatorScreenParams<DrawerParamList>;
};

export type DrawerParamList = {
  Home: NavigatorScreenParams<BottomTabParamList>;
  Overdue: undefined;
};

const RootStack = createNativeStackNavigator<RootStackParamList>();

const Tab = createBottomTabNavigator<BottomTabParamList>();
const ActiveStack = createNativeStackNavigator<ActiveStackParamList>();
const TrackerStack = createNativeStackNavigator<TrackerStackParamList>();
const Drawer = createDrawerNavigator<DrawerParamList>();

const ActiveStackNavigator = () => {
  return (
    <ActiveStack.Navigator
      initialRouteName="ActiveCategoryList"
      screenOptions={{
        headerTitle: ({ children }) => (
          <Text variant="titleLarge">{children}</Text>
        ),
      }}>
      <ActiveStack.Screen
        name="ActiveCategoryList"
        component={ActiveCategoryListScreen}
        options={{ headerShown: false }}
      />
      <ActiveStack.Screen
        name="ActiveTaskList"
        component={ActiveTaskListScreen}
      />
    </ActiveStack.Navigator>
  );
};

const TrackerStackNavigator = () => {
  return (
    <TrackerStack.Navigator
      initialRouteName="HabitsList"
      screenOptions={{
        headerTitle: ({ children }) => (
          <Text variant="titleLarge">{children}</Text>
        ),
      }}>
      <TrackerStack.Screen
        name="HabitsList"
        component={HabitsScreen}
        options={{ headerShown: false }}
      />
      <TrackerStack.Screen name="Tracker" component={TrackerScreen} />
    </TrackerStack.Navigator>
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

const renderTrackerIcon = () => {
  return ({ color, size, focused }: IconProps) => {
    const theme = useTheme();

    return (
      <TrackerIcon size={size} color={focused ? theme.colors.primary : color} />
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

const BottomNavigator = () => {
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
      <Tab.Screen
        name="HabitsTracker"
        component={TrackerStackNavigator}
        options={{
          title: 'Tracker',
          tabBarLabel: 'Tracker',
          tabBarIcon: renderTrackerIcon(),
        }}
      />
    </Tab.Navigator>
  );
};

const DrawerNavigator = () => {
  return (
    <Drawer.Navigator
      screenOptions={{
        headerShown: false,
        drawerPosition: 'right',
        drawerHideStatusBarOnOpen: true,
      }}
      drawerContent={props => <CustomDrawerContent {...props} />}>
      <Drawer.Screen name="Home" component={BottomNavigator} />
      <Drawer.Screen
        name="Overdue"
        component={OverdueScreen}
        options={{
          headerTitle: () => <Text variant="titleLarge">Overdue Tasks</Text>,
          headerShown: true,
        }}
      />
    </Drawer.Navigator>
  );
};

const RootNavigator = () => {
  return (
    <RootStack.Navigator>
      <RootStack.Screen
        name="Drawer"
        options={{ headerShown: false }}
        component={DrawerNavigator}
      />
      <RootStack.Screen name="EditTask" component={EditTaskScreen} />
      <RootStack.Screen
        name="TaskDescription"
        component={TaskDescriptionScreen}
        options={{ headerShown: false }}
      />
      <RootStack.Screen
        name="Overdue"
        component={OverdueScreen}
        options={{
          headerTitle: () => <Text variant="titleLarge">Overdue Tasks</Text>,
        }}
      />
    </RootStack.Navigator>
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
