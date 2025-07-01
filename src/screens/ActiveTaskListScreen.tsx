import React, {
  useState,
  useEffect,
  useCallback,
  useLayoutEffect,
} from 'react';
import { StyleSheet, View, ActivityIndicator, FlatList } from 'react-native';
import {
  Text,
  Checkbox,
  IconButton,
  List,
  Divider,
  Snackbar,
  Button,
} from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CompositeScreenProps, useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type {
  ActiveStackParamList,
  RootStackParamList,
} from '../navigation/RootNavigator';
import {
  TaskRepository,
  RepetitiveTaskTemplateRepository,
} from '../services/database/repository';
import {
  useDatabase,
  useToggleTaskCompletionStatus,
  useTaskReschedule,
} from '../shared/hooks';
import {
  Task,
  RepetitiveTaskTemplate,
  TaskScheduleTypeEnum,
  TaskCompletionStatusEnum,
} from '../types';
import { DatePickerModal } from 'react-native-paper-dates';
import dayjs from 'dayjs';

const taskSeparator = () => <Divider />;

type Props = CompositeScreenProps<
  NativeStackScreenProps<ActiveStackParamList, 'ActiveTaskList'>,
  NativeStackScreenProps<RootStackParamList>
>;

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
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
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

  const [screenRequestError, setScreenRequestError] = useState('');
  const [showSnackbar, setShowSnackbar] = useState(false);

  const [taskIdToBeRescheduled, setTaskIdToBeRescheduled] = useState<
    number | null
  >(null);
  const [selectedDateForTaskReschedule, setSelectedDateForTaskReschedule] =
    useState<Date>();

  const { onToggleTaskCompletionStatus, error: toggleTaskCompletionError } =
    useToggleTaskCompletionStatus(taskRepository, fetchTasksByCategory);

  const { onTaskReschedule, error: toggleTaskScheduleError } =
    useTaskReschedule(taskRepository, fetchTasksByCategory);

  useEffect(() => {
    if (toggleTaskCompletionError) {
      setScreenRequestError(toggleTaskCompletionError);
      setShowSnackbar(true);
    }
  }, [toggleTaskCompletionError]);

  useEffect(() => {
    if (toggleTaskScheduleError) {
      setScreenRequestError(toggleTaskScheduleError);
      setShowSnackbar(true);
    }
  }, [toggleTaskScheduleError]);

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

  const handleStoppingRepetitiveTaskTemplate = async (
    repetitiveTaskTemplateId: number,
  ) => {
    await repetitiveTaskTemplateRepository?.stopRepetitiveTask(
      repetitiveTaskTemplateId,
    );
    await fetchTasksByCategory();
  };

  const renderTaskItem = ({
    item,
  }: {
    item: Task | RepetitiveTaskTemplate;
  }) => {
    const isRepetitiveTaskTemplate =
      category === TaskScheduleTypeEnum.Daily ||
      category === TaskScheduleTypeEnum.SpecificDaysInAWeek;

    return (
      <List.Item
        title={<Text variant="bodyLarge">{item.title}</Text>}
        titleNumberOfLines={2}
        onPress={() => {
          if (!isRepetitiveTaskTemplate) {
            navigation.navigate('EditTask', { taskId: item.id });
          } else {
            navigation.navigate('EditTask', {
              taskId: item.id,
              isRepetitiveTaskTemplate: true,
            });
          }
        }}
        style={styles.listItem}
        {...(!isRepetitiveTaskTemplate
          ? {
              left: props => (
                <View {...props} style={styles.checkboxContainer}>
                  <Checkbox
                    status={'unchecked'}
                    onPress={() =>
                      onToggleTaskCompletionStatus(
                        item.id,
                        (item as Task).completionStatus ===
                          TaskCompletionStatusEnum.COMPLETE
                          ? TaskCompletionStatusEnum.INCOMPLETE
                          : TaskCompletionStatusEnum.COMPLETE,
                      )
                    }
                  />
                </View>
              ),
              right: props => (
                <View {...props} style={styles.iconContainer}>
                  {(category === TaskScheduleTypeEnum.Unscheduled ||
                    category === TaskScheduleTypeEnum.Once) && (
                    <IconButton
                      icon="calendar-refresh-outline"
                      size={20}
                      onPress={() => {
                        if ((item as Task).dueDate) {
                          setSelectedDateForTaskReschedule(
                            new Date((item as Task).dueDate as string),
                          );
                        }
                        setTaskIdToBeRescheduled(item.id);
                      }}
                      style={styles.iconButton}
                    />
                  )}
                  <IconButton
                    icon="delete-outline"
                    size={20}
                    iconColor="red"
                    onPress={() =>
                      onToggleTaskCompletionStatus(
                        item.id,
                        TaskCompletionStatusEnum.FAILED,
                      )
                    }
                    style={styles.iconButton}
                  />
                </View>
              ),
            }
          : {})}
        {...(isRepetitiveTaskTemplate
          ? {
              left: props => (
                <View {...props} style={styles.checkboxContainer}>
                  <Text style={styles.bulletText}>•</Text>
                </View>
              ),
              right: props => (
                <View {...props} style={styles.iconContainer}>
                  <Button
                    onPress={async () =>
                      await handleStoppingRepetitiveTaskTemplate(item.id)
                    }>
                    Stop
                  </Button>
                </View>
              ),
            }
          : {})}
      />
    );
  };

  const handleTaskRescheduling = useCallback(
    async (params: { date: Date | undefined }) => {
      if (!taskIdToBeRescheduled || !params.date) {
        setScreenRequestError(
          'An error occurred while rescheduling the task. Please try again.',
        );
        return;
      }

      await onTaskReschedule(taskIdToBeRescheduled, params.date);
      setTaskIdToBeRescheduled(null);
      setSelectedDateForTaskReschedule(undefined);
    },
    [taskIdToBeRescheduled, onTaskReschedule],
  );

  const handleSnackbarDismiss = () => {
    setShowSnackbar(false);
    setTimeout(() => {
      setScreenRequestError('');
    }, 1000);
  };

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

      <Snackbar
        visible={showSnackbar}
        onDismiss={handleSnackbarDismiss}
        onIconPress={handleSnackbarDismiss}
        duration={3000}>
        <View style={styles.snackbarContainer}>
          <IconButton icon="alert-circle-outline" iconColor="red" />
          <Text variant="bodyMedium" style={styles.snackbarText}>
            {screenRequestError}
          </Text>
        </View>
      </Snackbar>

      <DatePickerModal
        locale="en"
        mode="single"
        visible={!!taskIdToBeRescheduled}
        onDismiss={() => setTaskIdToBeRescheduled(null)}
        date={selectedDateForTaskReschedule}
        onConfirm={handleTaskRescheduling}
        label="Task Date"
        calendarIcon="calendar-outline"
        saveLabel="Reschedule Task"
        animationType="slide"
        validRange={{ startDate: dayjs().startOf('day').toDate() }}
      />
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
  bulletText: {
    fontSize: 36,
    lineHeight: 30,
    marginLeft: 10,
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
  snackbarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 50,
  },
  snackbarText: {
    color: 'white',
    paddingRight: 10,
  },
});

export default ActiveTaskListScreen;
