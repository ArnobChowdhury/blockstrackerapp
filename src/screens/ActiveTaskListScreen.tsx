import React, {
  useState,
  useEffect,
  useCallback,
  useLayoutEffect,
} from 'react';
import {
  StyleSheet,
  View,
  ActivityIndicator,
  FlatList,
  Alert,
} from 'react-native';
import { Text, Checkbox, IconButton, List, Divider } from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ActiveStackParamList } from '../navigation/RootNavigator';
import {
  TaskRepository,
  RepetitiveTaskTemplateRepository,
} from '../services/database/repository';
import { useDatabase } from '../shared/hooks/useDatabase';
import { Task, RepetitiveTaskTemplate, TaskScheduleTypeEnum } from '../types';

const taskSeparator = () => <Divider />;

type Props = NativeStackScreenProps<ActiveStackParamList, 'ActiveTaskList'>;

const ActiveTaskListScreen = ({ route, navigation }: Props) => {
  const { category } = route.params;
  console.log(
    '[TaskList] Category:',
    TaskScheduleTypeEnum.SpecificDaysInAWeek === category,
  );

  const { db, isLoading: isDbLoading, error: dbError } = useDatabase();
  const [taskRepository, setTaskRepository] = useState<TaskRepository | null>(
    null,
  );
  const [
    repetitiveTaskTemplateRepository,
    setRepetitiveTaskTemplateRepository,
  ] = useState<RepetitiveTaskTemplateRepository | null>(null);
  const [tasks, setTasks] = useState<Task[] | RepetitiveTaskTemplate[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [errorLoadingTasks, setErrorLoadingTasks] = useState<string | null>(
    null,
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      title: category,
    });
  }, [navigation, category]);

  useEffect(() => {
    if (db && !dbError && !isDbLoading) {
      setTaskRepository(new TaskRepository(db));
    } else {
      setTaskRepository(null);
    }
  }, [db, dbError, isDbLoading]);

  useEffect(() => {
    if (db && !dbError && !isDbLoading) {
      setRepetitiveTaskTemplateRepository(
        new RepetitiveTaskTemplateRepository(db),
      );
    } else {
      setRepetitiveTaskTemplateRepository(null);
    }
  }, [db, dbError, isDbLoading]);

  const fetchTasksByCategory = useCallback(async () => {
    if (!taskRepository) {
      console.log(
        `[TaskList-${category}] fetchTasks called, but repository not ready.`,
      );
      return;
    }

    if (!repetitiveTaskTemplateRepository) {
      console.log(
        `[TaskList-${category}] fetchTasks called, but repository not ready.`,
      );
      return;
    }

    console.log(`[TaskList-${category}] Fetching tasks...`);
    setIsLoadingTasks(true);
    setErrorLoadingTasks(null);

    try {
      let fetchedTasks: Task[] | RepetitiveTaskTemplate[] = [];
      if (TaskScheduleTypeEnum.Unscheduled === category) {
        fetchedTasks = await taskRepository.getAllActiveUnscheduledTasks();
      } else if (TaskScheduleTypeEnum.Once === category) {
        fetchedTasks = await taskRepository.getAllActiveOnceTasks();
      } else if (TaskScheduleTypeEnum.Daily === category) {
        fetchedTasks =
          await repetitiveTaskTemplateRepository.getAllActiveDailyRepetitiveTaskTemplates();
      } else if (TaskScheduleTypeEnum.SpecificDaysInAWeek === category) {
        fetchedTasks =
          await repetitiveTaskTemplateRepository.getAllActiveSpecificDaysInAWeekRepetitiveTaskTemplates();
      }

      console.log(
        `[TaskList-${category}] Fetched tasks count:`,
        fetchedTasks.length,
      );
      setTasks(fetchedTasks);
    } catch (error: any) {
      console.error(`[TaskList-${category}] Failed to fetch tasks:`, error);
      setErrorLoadingTasks(
        error.message || 'An unknown error occurred while fetching tasks.',
      );
      setTasks([]);
    } finally {
      setIsLoadingTasks(false);
    }
  }, [taskRepository, repetitiveTaskTemplateRepository, category]);

  useFocusEffect(
    useCallback(() => {
      console.log(`[TaskList-${category}] Screen focused.`);
      if (taskRepository) {
        fetchTasksByCategory();
      } else {
        console.log(
          `[TaskList-${category}] Screen focused, but repository not ready yet.`,
        );
      }
    }, [category, fetchTasksByCategory, taskRepository]),
  );

  const handleCheckTask = useCallback(
    (taskId: number) => {
      console.log(
        `[TaskList-${category}] Checkbox toggled for task ID: ${taskId}`,
      );
      Alert.alert(
        'Action Needed',
        `Mark task ${taskId} as complete/incomplete`,
      );
      // TODO: Implement DB update logic
    },
    [category],
  );

  const handleRescheduleTask = useCallback(
    (taskId: number) => {
      console.log(
        `[TaskList-${category}] Reschedule icon pressed for task ID: ${taskId}`,
      );
      Alert.alert('Action Needed', `Reschedule task ${taskId}`);
      // TODO: Implement navigation/modal logic
      // Example: navigation.navigate('RescheduleScreen', { taskId }); // Need to add RescheduleScreen to stack
    },
    [category],
  );

  const renderTaskItem = ({
    item,
  }: {
    item: Task | RepetitiveTaskTemplate;
  }) => (
    <List.Item
      title={item.title}
      titleNumberOfLines={2}
      description={item.description}
      descriptionNumberOfLines={1}
      style={styles.listItem}
      {...(category === TaskScheduleTypeEnum.Unscheduled ||
      category === TaskScheduleTypeEnum.Once
        ? {
            left: props => (
              <View {...props} style={styles.checkboxContainer}>
                <Checkbox
                  status={'unchecked'}
                  onPress={() => handleCheckTask(item.id)}
                />
              </View>
            ),
          }
        : {})}
      right={props => (
        <View {...props} style={styles.iconContainer}>
          {(category === TaskScheduleTypeEnum.Unscheduled ||
            category === TaskScheduleTypeEnum.Once) && (
            <IconButton
              icon="calendar-refresh-outline"
              size={20}
              onPress={() => handleRescheduleTask(item.id)}
              style={styles.iconButton}
            />
          )}
          <IconButton
            icon="delete-outline"
            size={20}
            iconColor="red"
            // onPress={() => handleDeleteTask(item.id)} // Add delete handler if needed
            style={styles.iconButton}
          />
        </View>
      )}
    />
  );

  if (isDbLoading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Connecting to Database...</Text>
      </SafeAreaView>
    );
  }
  if (dbError) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.errorText}>Database Connection Error</Text>
        <Text style={styles.errorText}>{dbError.message}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['bottom', 'left', 'right']}>
      {isLoadingTasks ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>Loading Tasks...</Text>
        </View>
      ) : errorLoadingTasks ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>Failed to Load Tasks</Text>
          <Text style={styles.errorText}>{errorLoadingTasks}</Text>
          <IconButton icon="refresh" size={30} onPress={fetchTasksByCategory} />
        </View>
      ) : (
        <FlatList
          data={tasks}
          renderItem={renderTaskItem}
          keyExtractor={item => item.id.toString()}
          ItemSeparatorComponent={taskSeparator}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={styles.infoText}>
                No active tasks found for this category.
              </Text>
            </View>
          }
          contentContainerStyle={
            tasks.length === 0 ? styles.emptyListContainer : null
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyListContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center', // Center empty message
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  errorText: {
    color: 'red',
    textAlign: 'center',
    marginBottom: 5,
    fontSize: 16,
    fontWeight: 'bold',
  },
  infoText: {
    textAlign: 'center',
    marginTop: 10,
    fontSize: 16,
    color: 'grey',
  },
  listItem: {
    paddingHorizontal: 16, // Adjust padding
    paddingRight: 6,
    paddingLeft: 10,
  },
  checkboxContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  iconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  iconButton: {
    margin: 0,
    marginLeft: 4,
  },
});

export default ActiveTaskListScreen;
