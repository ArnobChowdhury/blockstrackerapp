import React, { useState, useEffect, useCallback, useMemo } from 'react';
import dayjs from 'dayjs';
import {
  StyleSheet,
  View,
  ActivityIndicator,
  Animated as RNAnimated,
  TouchableOpacity,
} from 'react-native';
import {
  Text,
  Checkbox,
  List,
  IconButton,
  Portal,
  Dialog,
  Button,
  useTheme,
  Banner,
  Icon,
} from 'react-native-paper';
import Animated, {
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
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
  useRefreshScreenAfterSync,
} from '../shared/hooks';
import { formatDate, capitalize, truncateString } from '../shared/utils';
import { TaskService } from '../services/TaskService';
import { RepetitiveTaskTemplateService } from '../services/RepetitiveTaskTemplateService';
import { dataMigrationService } from '../services/DataMigrationService';
import { Logo } from '../shared/components/icons';
import TaskScoring from '../shared/components/TaskScoring';
import {
  Task,
  TimeOfDay,
  TaskCompletionStatusEnum,
  TaskScheduleTypeEnum,
} from '../types';
import { DatePickerModal } from 'react-native-paper-dates';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { DrawerActions } from '@react-navigation/native';
import { useAppContext } from '../shared/contexts/useAppContext';
import { CombinedLightTheme } from '../app/theme/theme';
import DragList, { DragListRenderItemInfo } from 'react-native-draglist';

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

const getTaskOrder = (task: Task) => {
  if (task.completionStatus === TaskCompletionStatusEnum.FAILED) {
    return GROUP_ORDER.failed;
  }

  if (!task.timeOfDay) {
    return GROUP_ORDER.unspecified;
  }

  return GROUP_ORDER[task.timeOfDay];
};

interface TaskHeaders {
  type: 'header';
  title: string;
  key: string;
}

type TaskOrHeader = Task | TaskHeaders;

const groupAndFlattenTasks = (tasks: Task[]): TaskOrHeader[] => {
  const sortedTasks = tasks.slice().sort((a, b) => {
    return getTaskOrder(a) - getTaskOrder(b);
  });

  const taskList: TaskOrHeader[] = [];

  sortedTasks.forEach((task, index) => {
    if (task.completionStatus === TaskCompletionStatusEnum.FAILED) {
      if (
        sortedTasks[index - 1]?.completionStatus !==
        TaskCompletionStatusEnum.FAILED
      ) {
        taskList.push({
          type: 'header',
          title: 'Failed',
          key: 'Failed',
        });
      }
      taskList.push(task);
      return;
    }

    if (
      index === 0 ||
      (sortedTasks[index - 1] &&
        task.timeOfDay !== sortedTasks[index - 1].timeOfDay)
    ) {
      const title = task.timeOfDay ? capitalize(task.timeOfDay) : 'Any Time';
      taskList.push({
        type: 'header',
        title: task.timeOfDay ? capitalize(task.timeOfDay) : 'Any Time',
        key: title,
      });
    }

    taskList.push(task);
  });

  return taskList;
};

function keyExtractor(item: TaskOrHeader, _index: number) {
  if ('type' in item) {
    return item.key;
  }
  return item.id;
}

const SCALE_ACTIVE = 1.05;
const DraggableRow = React.memo(
  ({
    isActive,
    children,
  }: {
    isActive: boolean;
    children: React.ReactNode;
  }) => {
    const animatedStyle = useAnimatedStyle(
      () => ({
        transform: [
          {
            scale: withSpring(isActive ? SCALE_ACTIVE : 1),
          },
        ],
        shadowOpacity: withTiming(isActive ? 0.25 : 0),
        elevation: isActive ? 6 : 0,
      }),
      [isActive],
    );

    return <Animated.View style={animatedStyle}>{children}</Animated.View>;
  },
);

const findHeader = (
  taskIndex: number,
  taskSections: TaskOrHeader[],
): [TaskHeaders, number] | null => {
  for (let i = taskIndex; i >= 0; i--) {
    const item = taskSections[i];
    if ('type' in item && item.type === 'header') {
      return [item, i];
    }
  }
  return null;
};

const isTask = (item: TaskOrHeader): item is Task => {
  return !('type' in item);
};

const TodayScreen = ({ navigation }: Props) => {
  const theme = useTheme();
  const {
    user,
    isSyncing,
    firstSyncDone,
    checkAnonData,
    setCheckAnonData,
    showSnackbar,
  } = useAppContext();
  const repetitiveTaskTemplateService = useMemo(
    () => new RepetitiveTaskTemplateService(),
    [],
  );
  const taskService = useMemo(() => new TaskService(), []);

  const { isLoading: isDbLoading, error: dbError } = useDatabase();
  const [displayDate, setDisplayDate] = useState(() => dayjs().startOf('day'));
  const [newDayBannerVisible, setNewDayBannerVisible] = useState(false);

  const [taskSections, setTaskSections] = useState<TaskOrHeader[]>([]);
  const [numberOfTaskOverdue, setNumberOfTaskOverdue] = useState(0);
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const [errorLoadingTasks, setErrorLoadingTasks] = useState<string | null>(
    null,
  );

  const animatedValue = useMemo(() => new RNAnimated.Value(0), []);
  useEffect(() => {
    if (isSyncing) {
      const animation = RNAnimated.loop(
        RNAnimated.sequence([
          RNAnimated.timing(animatedValue, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: false,
          }),
          RNAnimated.timing(animatedValue, {
            toValue: 0,
            duration: 1000,
            useNativeDriver: false,
          }),
        ]),
      );
      animation.start();
      return () => animation.stop();
    }
  }, [isSyncing, animatedValue]);

  const fetchTasksForDate = useCallback(
    async (dateToFetch: dayjs.Dayjs) => {
      setErrorLoadingTasks(null);

      try {
        await repetitiveTaskTemplateService.generateDueRepetitiveTasks(
          user && user.id,
          user?.isPremium ?? false,
        );

        const countOfTaskOverdue = await taskService.getCountOfTasksOverdue(
          user && user.id,
        );
        setNumberOfTaskOverdue(countOfTaskOverdue);
        const fetchedTasks = await taskService.getTasksForDate(
          dateToFetch.toDate(),
          user && user.id,
        );
        setTaskSections(groupAndFlattenTasks(fetchedTasks));
      } catch (error: any) {
        console.error('[TodayScreen] Failed to fetch tasks:', error);
        setErrorLoadingTasks(
          error.message || 'An unknown error occurred while fetching tasks.',
        );
        setTaskSections([]);
      } finally {
        setIsLoadingTasks(false);
      }
    },
    [repetitiveTaskTemplateService, user, taskService],
  );

  const refreshCurrentView = useCallback(async () => {
    await fetchTasksForDate(displayDate);
  }, [fetchTasksForDate, displayDate]);

  const { onToggleTaskCompletionStatus } = useToggleTaskCompletionStatus(
    taskService,
    refreshCurrentView,
  );

  const {
    onTaskReschedule,
    isDatePickerVisible,
    selectedDateForTaskReschedule,
    resetTaskRescheduling,
    datePickerStartDate,
    datePickerEndDate,
    handleRescheduleIconTap,
  } = useTaskReschedule(
    taskService,
    repetitiveTaskTemplateService,
    refreshCurrentView,
  );

  useFocusEffect(
    useCallback(() => {
      if (!isDbLoading && !newDayBannerVisible && firstSyncDone) {
        fetchTasksForDate(displayDate);
      }
    }, [
      isDbLoading,
      newDayBannerVisible,
      firstSyncDone,
      fetchTasksForDate,
      displayDate,
    ]),
  );

  useEffect(() => {
    if (newDayBannerVisible) {
      return;
    }

    const intervalId = setInterval(() => {
      const now = dayjs().startOf('day');

      if (now.isAfter(displayDate)) {
        console.log('A new day has begun while using the app. Showing banner.');
        setNewDayBannerVisible(true);
      }
    }, 30000);

    return () => clearInterval(intervalId);
  }, [displayDate, newDayBannerVisible]);

  const handleRefreshToNewDay = useCallback(() => {
    const newDate = dayjs().startOf('day');
    setNewDayBannerVisible(false);
    setDisplayDate(newDate);

    fetchTasksForDate(newDate);
  }, [fetchTasksForDate]);

  const [taskToBeCompleted, setTaskToBeCompleted] = useState<Task>();
  const [scoreForTaskToBeCompleted, setScoreForTaskToBeCompleted] =
    useState<number>();

  const handleTaskCompletion = useCallback(
    (task: Task) => {
      if (task.completionStatus === TaskCompletionStatusEnum.COMPLETE) {
        onToggleTaskCompletionStatus(
          task.id,
          TaskCompletionStatusEnum.INCOMPLETE,
          user && user.id,
          user?.isPremium ?? false,
        );
        return;
      }

      if (!task.shouldBeScored) {
        onToggleTaskCompletionStatus(
          task.id,
          TaskCompletionStatusEnum.COMPLETE,
          user && user.id,
          user?.isPremium ?? false,
        );
        return;
      }
      setTaskToBeCompleted(task);
    },
    [onToggleTaskCompletionStatus, user],
  );

  const renderTaskItem = useCallback(
    ({
      item,
      onDragStart,
      onDragEnd,
      isActive,
    }: DragListRenderItemInfo<TaskOrHeader>) => {
      if ('type' in item) {
        return (
          <View
            style={[
              styles.sectionHeaderContainer,
              {
                backgroundColor: SECTION_THEMES[item.title].backgroundColor,
              },
            ]}>
            <Text
              style={[
                { color: CombinedLightTheme.colors.onSurface },
                styles.sectionHeaderText,
              ]}
              variant="titleMedium">
              {item.title}
            </Text>
          </View>
        );
      }

      let sectionBackgroundColor: string;

      if (item.completionStatus === TaskCompletionStatusEnum.FAILED) {
        sectionBackgroundColor = SECTION_THEMES.Failed.backgroundColor;
      } else if (item.timeOfDay) {
        sectionBackgroundColor =
          SECTION_THEMES[capitalize(item.timeOfDay)].backgroundColor;
      } else {
        sectionBackgroundColor = SECTION_THEMES['Any Time'].backgroundColor;
      }

      return (
        <DraggableRow isActive={isActive}>
          <View
            key={item.id}
            style={[
              styles.draggableRowView,
              // eslint-disable-next-line react-native/no-inline-styles
              {
                backgroundColor: isActive ? '#fff' : sectionBackgroundColor,
                borderTopWidth: isActive ? 0.8 : 0,
              },
            ]}>
            <TouchableOpacity
              style={styles.dragHandle}
              onPressIn={onDragStart}
              onPressOut={onDragEnd}>
              <Icon
                source="drag-horizontal-variant"
                size={16}
                color={CombinedLightTheme.colors.onSurfaceVariant}
              />
            </TouchableOpacity>
            <View style={styles.flexOne}>
              <List.Item
                onPress={() => {
                  navigation.navigate('EditTask', { taskId: item.id });
                }}
                title={
                  <Text
                    variant="bodyLarge"
                    style={[
                      { color: CombinedLightTheme.colors.onSurface },
                      item.completionStatus ===
                      TaskCompletionStatusEnum.COMPLETE
                        ? styles.taskCompleted
                        : null,
                    ]}>
                    {item.title}
                  </Text>
                }
                style={[styles.listItem]}
                {...(item.completionStatus !== TaskCompletionStatusEnum.FAILED
                  ? {
                      left: props => (
                        <View {...props}>
                          <Checkbox
                            uncheckedColor={CombinedLightTheme.colors.onSurface}
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
                    {item.schedule !== TaskScheduleTypeEnum.Daily && (
                      <IconButton
                        icon="calendar-refresh"
                        size={20}
                        onPress={() => handleRescheduleIconTap(item)}
                        iconColor={theme.colors.secondary}
                        disabled={
                          item.completionStatus ===
                          TaskCompletionStatusEnum.COMPLETE
                        }
                        style={styles.iconButton}
                      />
                    )}
                    {item.completionStatus !==
                      TaskCompletionStatusEnum.FAILED && (
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
                            user && user.id,
                            user?.isPremium ?? false,
                          )
                        }
                        style={styles.iconButton}
                      />
                    )}
                    {item.completionStatus ===
                      TaskCompletionStatusEnum.FAILED && (
                      <IconButton
                        icon="restart"
                        size={20}
                        iconColor="green"
                        onPress={() =>
                          onToggleTaskCompletionStatus(
                            item.id,
                            TaskCompletionStatusEnum.INCOMPLETE,
                            user && user.id,
                            user?.isPremium ?? false,
                          )
                        }
                        style={styles.iconButton}
                      />
                    )}
                  </View>
                )}
              />
            </View>
          </View>
        </DraggableRow>
      );
    },
    [
      handleRescheduleIconTap,
      handleTaskCompletion,
      navigation,
      onToggleTaskCompletionStatus,
      theme.colors.secondary,
      user,
    ],
  );

  async function onReordered(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex) {
      return;
    }

    const currentList = [...taskSections];
    const movedItem = currentList[fromIndex];

    if (!isTask(movedItem)) {
      return;
    }

    const targetIndex = toIndex === 0 ? 1 : toIndex;

    currentList.splice(fromIndex, 1);
    currentList.splice(targetIndex, 0, movedItem);

    const headerInfo = findHeader(targetIndex, currentList);
    if (!headerInfo) {
      return;
    }
    const [header] = headerInfo;

    let newTimeOfDay: TimeOfDay | null = movedItem.timeOfDay;
    let newCompletionStatus = movedItem.completionStatus;

    if (header.title === 'Failed') {
      newCompletionStatus = TaskCompletionStatusEnum.FAILED;
    } else {
      if (movedItem.completionStatus === TaskCompletionStatusEnum.FAILED) {
        newCompletionStatus = TaskCompletionStatusEnum.INCOMPLETE;
      }

      if (header.title === 'Any Time') {
        newTimeOfDay = null;
      } else if (Object.keys(TimeOfDay).includes(header.title)) {
        newTimeOfDay = header.title.toLowerCase() as TimeOfDay;
      }
    }

    currentList[targetIndex] = {
      ...(currentList[targetIndex] as Task),
      timeOfDay: newTimeOfDay,
      completionStatus: newCompletionStatus,
    };

    const tasksOnly = currentList.filter(isTask);
    const groupedList = groupAndFlattenTasks(tasksOnly);
    setTaskSections(groupedList);

    const newMovedIndex = groupedList.findIndex(
      item => isTask(item) && item.id === movedItem.id,
    );

    if (newMovedIndex === -1) {
      return;
    }

    const prevItem = groupedList[newMovedIndex - 1];
    const nextItem = groupedList[newMovedIndex + 1];

    const prevOrder = isTask(prevItem) ? prevItem.sortOrder : 0;
    const nextOrder = isTask(nextItem) ? nextItem.sortOrder : prevOrder + 10000;

    const reindexUpdates: { id: string; sortOrder: number }[] = [];
    let newSortOrder: number;

    if (nextOrder <= prevOrder + 0.001) {
      const sectionHeaderInfo = findHeader(newMovedIndex, groupedList);
      if (sectionHeaderInfo) {
        const [, sectionHeaderIndex] = sectionHeaderInfo;
        let currentSortOrder = 10000;

        for (let i = sectionHeaderIndex + 1; i < groupedList.length; i++) {
          const item = groupedList[i];
          if (!isTask(item)) {
            break;
          }

          reindexUpdates.push({ id: item.id, sortOrder: currentSortOrder });
          currentSortOrder += 10000;
        }
      }

      const update = reindexUpdates.find(u => u.id === movedItem.id);
      newSortOrder = update ? update.sortOrder : (newMovedIndex + 1) * 10000;
    } else {
      newSortOrder = (prevOrder + nextOrder) / 2;
    }

    try {
      if (reindexUpdates.length > 0) {
        await taskService.reindexTasks(
          reindexUpdates,
          user && user.id,
          user?.isPremium ?? false,
        );
      }

      await taskService.reorderTask(
        movedItem.id,
        newSortOrder,
        newTimeOfDay,
        newCompletionStatus,
        user && user.id,
        user?.isPremium ?? false,
      );
      await refreshCurrentView();
    } catch (error) {
      console.error('[TodayScreen] Failed to save task order:', error);
      showSnackbar('Failed to save task order');
    }
  }

  const [hasAnonymousData, setHasAnonymousData] = useState(false);
  useEffect(() => {
    if (checkAnonData) {
      dataMigrationService.hasAnonymousData().then(setHasAnonymousData);
    }
  }, [checkAnonData, setCheckAnonData]);

  useRefreshScreenAfterSync(refreshCurrentView, 'Today');

  const handleDataMigration = async () => {
    if (user) {
      try {
        await dataMigrationService.assignAnonymousDataToUser(user.id);
        if (user.isPremium) {
          await dataMigrationService.queueAllDataForSync(user.id);
        }
        setCheckAnonData(false);
        setHasAnonymousData(false);
        refreshCurrentView();
      } catch (err: any) {
        showSnackbar(err.message);
      }
    }
  };

  const handleDismissMigration = () => {
    setCheckAnonData(false);
    setHasAnonymousData(false);
  };

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

  const blinkingColor = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [
      theme.colors.secondary,
      theme.colors.surfaceVariant as string,
    ],
  });

  return (
    <SafeAreaView
      style={styles.container}
      edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.topBar}>
        <Logo width={200} height={60} />
        <IconButton
          icon="menu"
          size={30}
          onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
        />
        {isSyncing && (
          <View style={styles.syncIndicatorContainer}>
            <RNAnimated.View
              style={[
                {
                  backgroundColor: blinkingColor,
                },
                styles.syncingIndicator,
              ]}
            />
            <Text variant="bodyLarge">Syncing</Text>
          </View>
        )}
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
          <IconButton icon="refresh" size={30} onPress={refreshCurrentView} />
        </View>
      ) : (
        <>
          <Banner
            visible={numberOfTaskOverdue > 0 && !newDayBannerVisible}
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
          <Banner
            visible={newDayBannerVisible}
            actions={[
              {
                label: "Show Today's Tasks",
                onPress: handleRefreshToNewDay,
              },
            ]}
            icon="calendar-clock">
            <Text variant="bodyMedium">
              A new day has begun! You can continue with yesterday's tasks or
              refresh to see what's new for today.
            </Text>
          </Banner>

          <View style={[styles.paddingTop, styles.todayTextContainer]}>
            <View style={styles.titleContainer}>
              <Text variant="headlineSmall">
                {newDayBannerVisible ? 'Yesterday' : 'Today'}
              </Text>
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
              {formatDate(displayDate)}
            </Text>
          </View>

          <DragList
            data={taskSections}
            renderItem={renderTaskItem}
            keyExtractor={keyExtractor}
            onReordered={onReordered}
            style={styles.dragList}
          />
        </>
      )}
      <DatePickerModal
        locale="en"
        mode="single"
        visible={isDatePickerVisible}
        onDismiss={resetTaskRescheduling}
        date={selectedDateForTaskReschedule}
        onConfirm={onTaskReschedule}
        label="Task Date"
        calendarIcon="calendar-outline"
        saveLabel="Reschedule Task"
        animationType="slide"
        validRange={{
          startDate: datePickerStartDate,
          endDate: datePickerEndDate,
        }}
      />
      <Portal>
        <Dialog visible={hasAnonymousData} onDismiss={handleDismissMigration}>
          <Dialog.Title>Import Local Data</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              We found some data (tasks, spaces, or templates) created while you
              were signed out. Would you like to import them to your account
              now?
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={handleDismissMigration}>No, thanks</Button>
            <Button onPress={handleDataMigration}>Import</Button>
          </Dialog.Actions>
        </Dialog>
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
                  return;
                }

                if (scoreForTaskToBeCompleted === undefined) {
                  return;
                }

                onToggleTaskCompletionStatus(
                  taskToBeCompleted.id,
                  TaskCompletionStatusEnum.COMPLETE,
                  user && user.id,
                  user?.isPremium ?? false,
                  scoreForTaskToBeCompleted + 1,
                );
                setTaskToBeCompleted(undefined);
                setScoreForTaskToBeCompleted(undefined);
              }}
              disabled={
                !taskToBeCompleted || scoreForTaskToBeCompleted === undefined
              }>
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
  syncIndicatorContainer: {
    alignItems: 'center',
    paddingVertical: 2,
    position: 'absolute',
    top: '110%',
    right: '2%',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  syncingIndicator: {
    width: 12,
    height: 12,
    marginRight: 8,
    borderRadius: 10,
  },
  topBar: {
    paddingLeft: 16,
    borderBottomColor: '#ccc',
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'relative',
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
    marginVertical: 2,
    fontSize: 16,
  },
  sectionList: {
    paddingHorizontal: 16,
  },
  sectionHeaderContainer: {
    marginTop: 8,
    paddingHorizontal: 8,
    paddingTop: 8,
  },
  sectionHeaderText: {
    fontSize: 14,
  },
  dragHandle: {
    paddingHorizontal: 8,
  },
  listItemContainer: {
    marginHorizontal: 16,
  },
  listItem: {
    paddingHorizontal: 4,
    paddingLeft: 0,
  },
  taskCompleted: {
    textDecorationLine: 'line-through',
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
  todayTextContainer: {
    paddingLeft: 8,
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
  dragList: {
    marginBottom: 110,
  },
  draggableRowView: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomColor: '#E0E0E0',
    borderBottomWidth: 0.8,
    borderTopColor: '#E0E0E0',
  },
  flexOne: {
    flex: 1,
  },
});

export default TodayScreen;
