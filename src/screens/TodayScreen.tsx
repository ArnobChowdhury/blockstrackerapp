import React, { useState, useEffect, useCallback } from 'react';
import dayjs from 'dayjs';
import { StyleSheet, View, SectionList, ActivityIndicator } from 'react-native';
import {
  Text,
  Checkbox,
  List,
  Divider,
  IconButton,
  Snackbar,
  Portal,
  Dialog,
  Button,
  useTheme,
  Banner,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CompositeScreenProps, useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type {
  BottomTabParamList,
  RootStackParamList,
} from '../navigation/RootNavigator';
import {
  useDatabase,
  useToggleTaskCompletionStatus,
  useTaskReschedule,
} from '../shared/hooks';
import { formatDate, capitalize, truncateString } from '../shared/utils';
import { Logo } from '../shared/components/icons';
import TaskScoring from '../shared/components/TaskScoring';
import {
  TaskRepository,
  RepetitiveTaskTemplateRepository,
} from '../services/database/repository';
import {
  Task,
  TimeOfDay,
  TaskCompletionStatusEnum,
  TaskScheduleTypeEnum,
} from '../types';
import { DatePickerModal } from 'react-native-paper-dates';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';

type Props = CompositeScreenProps<
  BottomTabScreenProps<BottomTabParamList, 'Today'>,
  NativeStackScreenProps<RootStackParamList>
>;

export interface TaskSection {
  title: string;
  data: Task[];
}

const GROUP_ORDER: Record<TimeOfDay | 'unspecified' | 'failed', number> = {
  [TimeOfDay.Morning]: 1,
  [TimeOfDay.Afternoon]: 2,
  [TimeOfDay.Evening]: 3,
  [TimeOfDay.Night]: 4,
  unspecified: 5,
  failed: 6,
};

const SECTION_THEMES: Record<string, { backgroundColor: string }> = {
  Morning: { backgroundColor: '#E4F8FC' },
  Afternoon: { backgroundColor: '#FEEED4' },
  Evening: { backgroundColor: '#FFE5D9' },
  Failed: { backgroundColor: '#FFDFDC' },
  Night: { backgroundColor: '#CDD2E9' },
  'Any Time': { backgroundColor: '#F5F5F5' },
};

const DEFAULT_SECTION_THEME = {
  backgroundColor: '#E0E0E0',
};

export const groupTasks = (tasks: Task[]): TaskSection[] => {
  const grouped: Record<string, Task[]> = {};

  tasks.forEach(task => {
    const key =
      task.completionStatus === TaskCompletionStatusEnum.FAILED
        ? 'Failed'
        : task.timeOfDay || 'Unspecified';
    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push(task);
  });

  return Object.entries(grouped)
    .map(([timeOfDayKey, taskItems]) => {
      return {
        title:
          timeOfDayKey === 'Unspecified'
            ? 'Any Time'
            : capitalize(timeOfDayKey as keyof typeof GROUP_ORDER),
        data: taskItems,
      };
    })
    .sort((a, b) => {
      const aKey =
        a.title === 'Any Time'
          ? 'unspecified'
          : (a.title.toLowerCase() as keyof typeof GROUP_ORDER);
      const bKey =
        b.title === 'Any Time'
          ? 'unspecified'
          : (b.title.toLowerCase() as keyof typeof GROUP_ORDER);
      return GROUP_ORDER[aKey] - GROUP_ORDER[bKey];
    });
};

const TodayScreen = ({ navigation }: Props) => {
  const theme = useTheme();
  const { db, isLoading: isDbLoading, error: dbError } = useDatabase();
  const [taskRepository, setTaskRepository] = useState<TaskRepository | null>(
    null,
  );
  const [
    repetitiveTaskTemplateRepository,
    setRepetitiveTaskTemplateRepository,
  ] = useState<RepetitiveTaskTemplateRepository | null>(null);

  const [taskSections, setTaskSections] = useState<TaskSection[]>([]);
  const [numberOfTaskOverdue, setNumberOfTaskOverdue] = useState(0);
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const [errorLoadingTasks, setErrorLoadingTasks] = useState<string | null>(
    null,
  );

  const [screenRequestError, setScreenRequestError] = useState('');
  const [showSnackbar, setShowSnackbar] = useState(false);

  const [taskIdToBeRescheduled, setTaskIdToBeRescheduled] = useState<
    number | null
  >(null);
  const [selectedDateForTaskReschedule, setSelectedDateForTaskReschedule] =
    useState<Date>();

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

  const fetchTasksForToday = useCallback(async () => {
    if (!taskRepository || !repetitiveTaskTemplateRepository) {
      console.log(
        '[TodayScreen] taskRepository or repetitiveTaskTemplateRepository is null',
      );
      return;
    }

    console.log('[TodayScreen] Fetching tasks for today...');
    setErrorLoadingTasks(null);

    try {
      await repetitiveTaskTemplateRepository.generateDueRepetitiveTasks(
        taskRepository,
      );

      const countOfTaskOverdue = await taskRepository.getCountOfTasksOverdue();
      setNumberOfTaskOverdue(countOfTaskOverdue);

      const fetchedTasks = await taskRepository.getTasksForToday();
      setTaskSections(groupTasks(fetchedTasks));
    } catch (error: any) {
      console.error('[TodayScreen] Failed to fetch tasks:', error);
      setErrorLoadingTasks(
        error.message || 'An unknown error occurred while fetching tasks.',
      );
      setTaskSections([]);
    } finally {
      setIsLoadingTasks(false);
    }
  }, [taskRepository, repetitiveTaskTemplateRepository]);

  const { onToggleTaskCompletionStatus, error: toggleTaskCompletionError } =
    useToggleTaskCompletionStatus(taskRepository, fetchTasksForToday);

  const { onTaskReschedule, error: toggleTaskScheduleError } =
    useTaskReschedule(taskRepository, fetchTasksForToday);

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
      if (taskRepository) {
        fetchTasksForToday();
      }
    }, [taskRepository, fetchTasksForToday]),
  );

  const handleSnackbarDismiss = () => {
    setShowSnackbar(false);
    setTimeout(() => {
      setScreenRequestError('');
    }, 1000);
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

  const [taskToBeCompleted, setTaskToBeCompleted] = useState<Task>();
  const [scoreForTaskToBeCompleted, setScoreForTaskToBeCompleted] =
    useState<number>();

  const handleTaskCompletion = useCallback(
    (task: Task) => {
      if (task.completionStatus === TaskCompletionStatusEnum.COMPLETE) {
        onToggleTaskCompletionStatus(
          task.id,
          TaskCompletionStatusEnum.INCOMPLETE,
          null,
        );
        return;
      }

      if (!task.shouldBeScored) {
        onToggleTaskCompletionStatus(
          task.id,
          TaskCompletionStatusEnum.COMPLETE,
        );
        return;
      }
      setTaskToBeCompleted(task);
    },
    [onToggleTaskCompletionStatus],
  );

  const renderTaskItem = useCallback(
    ({
      item,
      sectionBackgroundColor,
    }: {
      item: Task;
      sectionBackgroundColor: string;
    }) => {
      return (
        <View
          style={[
            {
              backgroundColor: sectionBackgroundColor,
            },
          ]}>
          <List.Item
            onPress={() => {
              navigation.navigate('EditTask', { taskId: item.id });
            }}
            title={
              <Text
                variant="bodyLarge"
                style={
                  item.completionStatus === TaskCompletionStatusEnum.COMPLETE
                    ? styles.taskCompleted
                    : null
                }>
                {item.title}
              </Text>
            }
            style={[styles.listItem]}
            {...(item.completionStatus !== TaskCompletionStatusEnum.FAILED
              ? {
                  left: props => (
                    <View {...props} style={styles.checkboxContainer}>
                      <Checkbox
                        status={
                          item.completionStatus ===
                          TaskCompletionStatusEnum.COMPLETE
                            ? 'checked'
                            : 'unchecked'
                        }
                        onPress={() => handleTaskCompletion(item)}
                      />
                    </View>
                  ),
                }
              : {})}
            right={props => (
              <View {...props} style={styles.iconContainer}>
                {(item.schedule === TaskScheduleTypeEnum.Unscheduled ||
                  item.schedule === TaskScheduleTypeEnum.Once) &&
                  item.completionStatus !== TaskCompletionStatusEnum.FAILED && (
                    <IconButton
                      icon="calendar-refresh"
                      size={20}
                      onPress={() => {
                        setSelectedDateForTaskReschedule(
                          new Date(item.dueDate as string),
                        );
                        setTaskIdToBeRescheduled(item.id);
                      }}
                      disabled={
                        item.completionStatus ===
                        TaskCompletionStatusEnum.COMPLETE
                      }
                      style={styles.iconButton}
                    />
                  )}
                {item.completionStatus !== TaskCompletionStatusEnum.FAILED && (
                  <IconButton
                    icon="thumb-down-outline"
                    size={20}
                    iconColor="red"
                    disabled={
                      item.completionStatus ===
                      TaskCompletionStatusEnum.COMPLETE
                    }
                    onPress={() =>
                      onToggleTaskCompletionStatus(
                        item.id,
                        TaskCompletionStatusEnum.FAILED,
                      )
                    }
                    style={styles.iconButton}
                  />
                )}
                {item.completionStatus === TaskCompletionStatusEnum.FAILED && (
                  <IconButton
                    icon="restart"
                    size={20}
                    iconColor="green"
                    onPress={() =>
                      onToggleTaskCompletionStatus(
                        item.id,
                        TaskCompletionStatusEnum.INCOMPLETE,
                      )
                    }
                    style={styles.iconButton}
                  />
                )}
              </View>
            )}
          />
        </View>
      );
    },
    [handleTaskCompletion, navigation, onToggleTaskCompletionStatus],
  );

  if (isDbLoading) {
    return (
      <SafeAreaView
        style={styles.centered}
        edges={['top', 'bottom', 'left', 'right']}>
        <ActivityIndicator size="large" />
        <Text style={styles.infoText}>Connecting to Database...</Text>
      </SafeAreaView>
    );
  }
  if (dbError) {
    return (
      <SafeAreaView
        style={styles.centered}
        edges={['top', 'bottom', 'left', 'right']}>
        <Text style={styles.errorText}>Database Connection Error</Text>
        <Text style={styles.errorText}>{dbError.message}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={styles.container}
      edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.topBar}>
        <Logo width={200} height={60} />
      </View>
      {isLoadingTasks ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" />
          <Text style={styles.infoText}>Loading Today's Tasks...</Text>
        </View>
      ) : errorLoadingTasks ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>Failed to Load Tasks</Text>
          <Text style={styles.errorText}>{errorLoadingTasks}</Text>
          <IconButton icon="refresh" size={30} onPress={fetchTasksForToday} />
        </View>
      ) : (
        <>
          <Banner
            visible={numberOfTaskOverdue > 0}
            actions={[
              {
                label: 'Review now',
                onPress: () => {
                  navigation.navigate('Overdue');
                },
              },
            ]}>
            <View>
              <Text variant="bodyLarge" style={styles.boldFonts}>
                You have {numberOfTaskOverdue} overdue task
                {numberOfTaskOverdue > 1 ? 's' : ''}.
              </Text>

              <Text variant="bodyMedium">
                Update their status to keep your progress accurate.
              </Text>
            </View>
          </Banner>
          <SectionList
            style={styles.sectionList}
            sections={taskSections}
            keyExtractor={item => item.id.toString()}
            renderItem={({ item, section }) => {
              const theme =
                SECTION_THEMES[section.title] || DEFAULT_SECTION_THEME;
              return renderTaskItem({
                item,
                sectionBackgroundColor: theme.backgroundColor,
              });
            }}
            renderSectionHeader={({ section: { title } }) => {
              const theme = SECTION_THEMES[title] || DEFAULT_SECTION_THEME;
              return (
                <View
                  style={[
                    styles.sectionHeaderContainer,
                    { backgroundColor: theme.backgroundColor },
                  ]}>
                  <Text style={[styles.sectionHeaderText]} variant="titleLarge">
                    {title}
                  </Text>
                </View>
              );
            }}
            ItemSeparatorComponent={() => <Divider />}
            ListHeaderComponent={() => (
              <View style={styles.paddingTop}>
                <View style={styles.titleContainer}>
                  <Text variant="displaySmall">Today</Text>
                  <IconButton
                    icon="plus"
                    size={20}
                    style={styles.addTaskTodayIcon}
                    iconColor={theme.colors.secondary}
                    onPress={() =>
                      navigation.navigate('AddTask', {
                        isToday: true,
                      })
                    }
                  />
                </View>
                <Text variant="bodyLarge" style={styles.timeAndDate}>
                  {formatDate(dayjs())}
                </Text>
              </View>
            )}
            ListEmptyComponent={
              <View style={styles.centered}>
                <Text variant={'bodyLarge'} style={styles.infoText}>
                  No tasks scheduled for today!
                </Text>
              </View>
            }
            contentContainerStyle={
              taskSections.length === 0 ? styles.emptyListContainer : null
            }
          />
        </>
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
      <Portal>
        <Dialog
          dismissable
          dismissableBackButton={true}
          visible={!!taskToBeCompleted}
          onDismiss={() => {
            setTaskToBeCompleted(undefined);
            setScoreForTaskToBeCompleted(undefined);
          }}>
          <Dialog.Title>
            <View style={styles.dialogTitle}>
              <Text variant="titleMedium" style={styles.boldFonts}>
                Task:
              </Text>
              <Text style={styles.marginLeft}>
                {taskToBeCompleted?.title &&
                  truncateString(taskToBeCompleted.title, 20)}
              </Text>
            </View>
          </Dialog.Title>
          <Dialog.Content>
            <Text
              variant="titleMedium"
              style={[styles.marginBottom, styles.boldFonts]}>
              Score:
            </Text>
            <TaskScoring
              onCirclePress={(score: number) =>
                setScoreForTaskToBeCompleted(prevVal => {
                  if (prevVal === score) {
                    return undefined;
                  }
                  return score;
                })
              }
              selected={scoreForTaskToBeCompleted}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              onPress={() => {
                if (!taskToBeCompleted) {
                  // show error
                  return;
                }

                if (!scoreForTaskToBeCompleted) {
                  // show error
                  return;
                }

                onToggleTaskCompletionStatus(
                  taskToBeCompleted.id as number,
                  TaskCompletionStatusEnum.COMPLETE,
                  scoreForTaskToBeCompleted,
                );
                setTaskToBeCompleted(undefined);
                setScoreForTaskToBeCompleted(undefined);
              }}
              disabled={!taskToBeCompleted || !scoreForTaskToBeCompleted}>
              Done
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  topBar: {
    paddingLeft: 16,
    borderBottomColor: '#ccc',
    borderBottomWidth: 1,
  },
  emptyListContainer: {
    flexGrow: 1,
  },
  infoText: {
    marginTop: 10,
    fontSize: 16,
    color: 'grey',
  },
  errorText: {
    color: 'red',
    textAlign: 'center',
    marginBottom: 5,
    fontSize: 16,
    fontWeight: 'bold',
  },
  timeAndDate: {
    marginVertical: 10,
    fontSize: 20,
  },
  sectionList: {
    paddingHorizontal: 16,
  },
  sectionHeaderContainer: {
    marginTop: 16,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  sectionHeaderText: {
    fontSize: 18,
  },
  listItemContainer: {
    marginHorizontal: 16,
  },
  listItem: {
    paddingHorizontal: 16,
    paddingLeft: 10,
  },
  taskCompleted: {
    textDecorationLine: 'line-through',
  },
  checkboxContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  paddingTop: {
    paddingTop: 10,
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
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addTaskTodayIcon: {
    marginVertical: -4,
  },
  marginBottom: {
    marginBottom: 10,
  },
  dialogTitle: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  boldFonts: {
    fontWeight: 700,
  },
  marginLeft: {
    marginLeft: 10,
  },
});

export default TodayScreen;
