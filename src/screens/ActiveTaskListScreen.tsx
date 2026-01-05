import React, { useState, useCallback, useLayoutEffect, useMemo } from 'react';
import {
  StyleSheet,
  View,
  ActivityIndicator,
  FlatList,
  SectionList,
} from 'react-native';
import {
  Text,
  Checkbox,
  IconButton,
  List,
  Divider,
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
  useDatabase,
  useToggleTaskCompletionStatus,
  useTaskReschedule,
  useRefreshScreenAfterSync,
} from '../shared/hooks';
import {
  Task,
  RepetitiveTaskTemplate,
  TaskScheduleTypeEnum,
  TaskCompletionStatusEnum,
} from '../types';
import { SpaceService } from '../services/SpaceService';
import { TaskService } from '../services/TaskService';
import { RepetitiveTaskTemplateService } from '../services/RepetitiveTaskTemplateService';
import { DatePickerModal } from 'react-native-paper-dates';
import dayjs from 'dayjs';
import { useAppContext } from '../shared/contexts/useAppContext';
import advancedFormat from 'dayjs/plugin/advancedFormat';

dayjs.extend(advancedFormat);

const taskSeparator = () => (
  <Divider style={[styles.marginLeftTen, styles.marginRightTen]} />
);

const listEmptyComponent = () => (
  <View style={[styles.centered, styles.paddingTwenty]}>
    <Text style={styles.infoText}>
      No active tasks found for this category.
    </Text>
  </View>
);

type Props = CompositeScreenProps<
  NativeStackScreenProps<ActiveStackParamList, 'ActiveTaskList'>,
  NativeStackScreenProps<RootStackParamList>
>;

type SectionProps = {
  date: string;
  data: Task[];
};

const groupTasksByDate = (tasks: Task[]): SectionProps[] => {
  const sortedByDate = tasks.sort((a, b) =>
    dayjs(a.dueDate).diff(dayjs(b.dueDate)),
  );

  const grouped: Record<string, Task[]> = {};
  sortedByDate.forEach(task => {
    const dateKey = dayjs(task.dueDate).format('Do MMM, YYYY');
    if (!grouped[dateKey]) {
      grouped[dateKey] = [];
    }
    grouped[dateKey].push(task);
  });

  return Object.entries(grouped).map(([date, _tasks]) => {
    return {
      date,
      data: _tasks,
    };
  });
};

const ActiveTaskListScreen = ({ route, navigation }: Props) => {
  const { user } = useAppContext();

  const { category, spaceId } = route.params;
  console.log(
    '[TaskList] Category:',
    TaskScheduleTypeEnum.SpecificDaysInAWeek === category,
  );

  const { isLoading: isDbLoading, error: dbError } = useDatabase();
  const [tasks, setTasks] = useState<Task[] | RepetitiveTaskTemplate[]>([]);
  const [onceTasksByDate, setOnceTasksByDate] = useState<SectionProps[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const [errorLoadingTasks, setErrorLoadingTasks] = useState<string | null>(
    null,
  );

  const spaceService = useMemo(() => new SpaceService(), []);
  const taskService = useMemo(() => new TaskService(), []);
  const repetitiveTaskTemplateService = useMemo(
    () => new RepetitiveTaskTemplateService(),
    [],
  );

  useLayoutEffect(() => {
    if (spaceId) {
      spaceService.getSpaceById(spaceId, user && user.id).then(space => {
        if (!space) {
          return;
        }
        navigation.setOptions({
          title: `${space.name} - ${category}`,
        });
      });
    } else {
      navigation.setOptions({
        title: category,
      });
    }
  }, [navigation, category, spaceId, spaceService, user]);

  const fetchTasksByCategory = useCallback(async () => {
    console.log(`[TaskList-${category}] Fetching tasks...`);
    setErrorLoadingTasks(null);

    try {
      let fetchedTasks: Task[] | RepetitiveTaskTemplate[] = [];
      if (spaceId) {
        if (TaskScheduleTypeEnum.Unscheduled === category) {
          fetchedTasks = await taskService.getActiveUnscheduledTasksBySpace(
            spaceId,
            user && user.id,
          );
        } else if (TaskScheduleTypeEnum.Once === category) {
          fetchedTasks = await taskService.getActiveOnceTasksBySpace(
            spaceId,
            user && user.id,
          );
        } else if (TaskScheduleTypeEnum.Daily === category) {
          fetchedTasks =
            await repetitiveTaskTemplateService.getActiveDailyRepetitiveTaskTemplatesBySpace(
              spaceId,
              user && user.id,
            );
        } else if (TaskScheduleTypeEnum.SpecificDaysInAWeek === category) {
          fetchedTasks =
            await repetitiveTaskTemplateService.getActiveSpecificDaysInAWeekRepetitiveTaskTemplatesBySpace(
              spaceId,
              user && user.id,
            );
        }
      } else if (TaskScheduleTypeEnum.Unscheduled === category) {
        fetchedTasks = await taskService.getAllActiveUnscheduledTasks(
          user && user.id,
        );
      } else if (TaskScheduleTypeEnum.Once === category) {
        fetchedTasks = await taskService.getAllActiveOnceTasks(user && user.id);
      } else if (TaskScheduleTypeEnum.Daily === category) {
        fetchedTasks =
          await repetitiveTaskTemplateService.getAllActiveDailyRepetitiveTaskTemplates(
            user && user.id,
          );
      } else if (TaskScheduleTypeEnum.SpecificDaysInAWeek === category) {
        fetchedTasks =
          await repetitiveTaskTemplateService.getAllActiveSpecificDaysInAWeekRepetitiveTaskTemplates(
            user && user.id,
          );
      }

      console.log(
        `[TaskList-${category}] Fetched tasks count:`,
        fetchedTasks.length,
      );
      setTasks(fetchedTasks);
      if (category === TaskScheduleTypeEnum.Once) {
        setOnceTasksByDate(groupTasksByDate(fetchedTasks as Task[]));
      }
    } catch (error: any) {
      console.error(`[TaskList-${category}] Failed to fetch tasks:`, error);
      setErrorLoadingTasks(
        error.message || 'An unknown error occurred while fetching tasks.',
      );
      setTasks([]);
    } finally {
      setIsLoadingTasks(false);
    }
  }, [category, spaceId, taskService, repetitiveTaskTemplateService, user]);

  const { onToggleTaskCompletionStatus } = useToggleTaskCompletionStatus(
    taskService,
    fetchTasksByCategory,
  );

  const {
    onTaskReschedule,
    selectedDateForTaskReschedule,
    handleRescheduleIconTap,
    isDatePickerVisible,
    resetTaskRescheduling,
  } = useTaskReschedule(
    taskService,
    repetitiveTaskTemplateService,
    fetchTasksByCategory,
  );

  useRefreshScreenAfterSync(fetchTasksByCategory, 'TaskList');

  useFocusEffect(
    useCallback(() => {
      console.log(`[TaskList-${category}] Screen focused.`);
      if (!isDbLoading) {
        fetchTasksByCategory();
      } else {
        console.log(
          `[TaskList-${category}] Screen focused, but repository not ready yet.`,
        );
      }
    }, [category, fetchTasksByCategory, isDbLoading]),
  );

  const handleStoppingRepetitiveTaskTemplate = async (
    repetitiveTaskTemplateId: string,
  ) => {
    await repetitiveTaskTemplateService.stopRepetitiveTask(
      repetitiveTaskTemplateId,
      user && user.id,
      user?.isPremium ?? false,
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
                        user && user.id,
                        user?.isPremium ?? false,
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
                      onPress={() => handleRescheduleIconTap(item as Task)}
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
                        user && user.id,
                        user?.isPremium ?? false,
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

  const renderSectionHeader = ({
    section: { date },
  }: {
    section: SectionProps;
  }) => {
    return (
      <View style={styles.sectionHeaderContainer}>
        <View style={[styles.line, styles.marginLeftTen]} />
        <Text variant="titleSmall" style={styles.sectionHeaderText}>
          {date}
        </Text>
        <View style={[styles.line, styles.marginRightTen]} />
      </View>
    );
  };

  if (isDbLoading) {
    return (
      <SafeAreaView style={[styles.centered, styles.paddingTwenty]}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Connecting to Database...</Text>
      </SafeAreaView>
    );
  }
  if (dbError) {
    return (
      <SafeAreaView style={[styles.centered, styles.paddingTwenty]}>
        <Text style={styles.errorText}>Database Connection Error</Text>
        <Text style={styles.errorText}>{dbError.message}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['bottom', 'left', 'right']}>
      {isLoadingTasks ? (
        <View style={[styles.centered, styles.paddingTwenty]}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>Loading Tasks...</Text>
        </View>
      ) : errorLoadingTasks ? (
        <View style={[styles.centered, styles.paddingTwenty]}>
          <Text style={styles.errorText}>Failed to Load Tasks</Text>
          <Text style={styles.errorText}>{errorLoadingTasks}</Text>
          <IconButton icon="refresh" size={30} onPress={fetchTasksByCategory} />
        </View>
      ) : (
        <>
          {category !== TaskScheduleTypeEnum.Once ? (
            <FlatList
              data={tasks}
              renderItem={renderTaskItem}
              keyExtractor={item => item.id.toString()}
              ItemSeparatorComponent={taskSeparator}
              ListEmptyComponent={listEmptyComponent}
              contentContainerStyle={
                tasks.length === 0 ? styles.emptyListContainer : null
              }
            />
          ) : (
            <SectionList
              sections={onceTasksByDate}
              renderSectionHeader={renderSectionHeader}
              renderItem={renderTaskItem}
              ItemSeparatorComponent={taskSeparator}
              ListEmptyComponent={listEmptyComponent}
            />
          )}
        </>
      )}

      <DatePickerModal
        locale="en"
        mode="single"
        visible={isDatePickerVisible}
        onDismiss={resetTaskRescheduling}
        date={selectedDateForTaskReschedule || new Date()}
        onConfirm={onTaskReschedule}
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
  },
  paddingTwenty: {
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
  sectionHeaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  line: {
    flex: 1,
    height: 0.5,
    backgroundColor: '#888',
  },
  marginRightTen: {
    marginRight: 10,
  },
  marginLeftTen: {
    marginLeft: 10,
  },
  sectionHeaderText: {
    marginHorizontal: 10,
    color: '#888',
  },
});

export default ActiveTaskListScreen;
