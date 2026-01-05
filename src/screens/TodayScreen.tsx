import React, { useState, useEffect, useCallback, useMemo } from 'react';
import dayjs from 'dayjs';
import {
  StyleSheet,
  View,
  SectionList,
  ActivityIndicator,
  Animated,
} from 'react-native';
import {
  Text,
  Checkbox,
  List,
  Divider,
  IconButton,
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

  const [taskSections, setTaskSections] = useState<TaskSection[]>([]);
  const [numberOfTaskOverdue, setNumberOfTaskOverdue] = useState(0);
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const [errorLoadingTasks, setErrorLoadingTasks] = useState<string | null>(
    null,
  );

  const animatedValue = useMemo(() => new Animated.Value(0), []);
  useEffect(() => {
    if (isSyncing) {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(animatedValue, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: false,
          }),
          Animated.timing(animatedValue, {
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
      console.log(
        `[TodayScreen] Fetching tasks for ${dateToFetch.format(
          'YYYY-MM-DD',
        )}...`,
      );
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
                style={[
                  { color: CombinedLightTheme.colors.onSurface },
                  item.completionStatus === TaskCompletionStatusEnum.COMPLETE
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
                    <View {...props} style={styles.checkboxContainer}>
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
                        user && user.id,
                        user?.isPremium ?? false,
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

  const [hasAnonymousData, setHasAnonymousData] = useState(false);
  useEffect(() => {
    if (checkAnonData) {
      console.log('[TodayScreen] checking anonymous data...', checkAnonData);
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
            <Animated.View
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

          <SectionList
            style={styles.sectionList}
            sections={taskSections}
            keyExtractor={item => item.id.toString()}
            renderItem={({ item, section }) => {
              const sectionTheme =
                SECTION_THEMES[section.title] || DEFAULT_SECTION_THEME;
              return renderTaskItem({
                item,
                sectionBackgroundColor: sectionTheme.backgroundColor,
              });
            }}
            renderSectionHeader={({ section: { title } }) => {
              const sectionTheme =
                SECTION_THEMES[title] || DEFAULT_SECTION_THEME;
              return (
                <View
                  style={[
                    styles.sectionHeaderContainer,
                    { backgroundColor: sectionTheme.backgroundColor },
                  ]}>
                  <Text
                    style={[
                      { color: CombinedLightTheme.colors.onSurface },
                      styles.sectionHeaderText,
                    ]}
                    variant="titleLarge">
                    {title}
                  </Text>
                </View>
              );
            }}
            ItemSeparatorComponent={() => <Divider />}
            ListHeaderComponent={() => (
              <View style={styles.paddingTop}>
                <View style={styles.titleContainer}>
                  <Text variant="displaySmall">
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
