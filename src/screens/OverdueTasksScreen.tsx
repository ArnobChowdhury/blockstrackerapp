import React, { useState, useCallback, useMemo } from 'react';
import dayjs from 'dayjs';
import {
  StyleSheet,
  View,
  SectionList,
  ActivityIndicator,
  useWindowDimensions,
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
  ProgressBar,
  Banner,
  useTheme,
  Icon,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import {
  useDatabase,
  useToggleTaskCompletionStatus,
  useTaskReschedule,
  useRefreshScreenAfterSync,
} from '../shared/hooks';
import { formatDate, truncateString } from '../shared/utils';
import { TaskService } from '../services/TaskService';
import { RepetitiveTaskTemplateService } from '../services/RepetitiveTaskTemplateService';
import TaskScoring from '../shared/components/TaskScoring';
import { Task, TaskCompletionStatusEnum, TaskScheduleTypeEnum } from '../types';
import { DatePickerModal } from 'react-native-paper-dates';
import { useAppContext } from '../shared/contexts/useAppContext';

type Props = NativeStackScreenProps<RootStackParamList, 'Overdue'>;

export interface TaskSection {
  title: string;
  data: Task[];
}

export const groupTasksByDate = (tasks: Task[]): TaskSection[] => {
  const grouped: Record<string, Task[]> = {};
  tasks.forEach(task => {
    const key = dayjs(task.dueDate).format('YYYY-MM-DD');
    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push(task);
  });
  return Object.entries(grouped)
    .map(([dateKey, taskItems]) => ({
      title: formatDate(dayjs(dateKey, 'YYYY-MM-DD')),
      data: taskItems,
    }))
    .sort((a, b) => dayjs(a.title).diff(dayjs(b.title)));
};

const OverdueScreen = ({ navigation }: Props) => {
  const theme = useTheme();
  const { isLoading: isDbLoading, error: dbError } = useDatabase();
  const { user, showSnackbar } = useAppContext();
  const [overdueTaskSections, setOverdueTaskSections] = useState<TaskSection[]>(
    [],
  );
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const [errorLoadingTasks, setErrorLoadingTasks] = useState<string | null>(
    null,
  );

  const taskService = useMemo(() => new TaskService(), []);
  const repetitiveTaskTemplateService = useMemo(
    () => new RepetitiveTaskTemplateService(),
    [],
  );

  const fetchOverdueTasks = useCallback(async () => {
    if (isDbLoading) {
      console.log('[OverdueScreen] DB not ready, skipping fetch.');
      return;
    }

    console.log('[OverdueScreen] Fetching overdue tasks...');
    setErrorLoadingTasks(null);
    setIsLoadingTasks(true);
    try {
      const fetchedOverdueTasks = await taskService.getAllOverdueTasks(
        user && user.id,
      );
      console.log('fetchedOverdueTasks', groupTasksByDate(fetchedOverdueTasks));

      setOverdueTaskSections(groupTasksByDate(fetchedOverdueTasks));
    } catch (error: any) {
      console.error('[TodayScreen] Failed to fetch tasks:', error);
      setErrorLoadingTasks(
        error.message || 'An unknown error occurred while fetching tasks.',
      );
      setOverdueTaskSections([]);
    } finally {
      setIsLoadingTasks(false);
    }
  }, [isDbLoading, taskService, user]);

  const {
    onToggleTaskCompletionStatus,
    requestOnGoing: toggleTaskCompletionRequestOnGoing,
  } = useToggleTaskCompletionStatus(taskService, fetchOverdueTasks);

  const {
    onTaskReschedule,
    handleRescheduleIconTap,
    isDatePickerVisible,
    selectedDateForTaskReschedule,
    resetTaskRescheduling,
    datePickerStartDate,
    datePickerEndDate,
  } = useTaskReschedule(
    taskService,
    repetitiveTaskTemplateService,
    fetchOverdueTasks,
  );

  useRefreshScreenAfterSync(fetchOverdueTasks, 'Overdue');

  useFocusEffect(
    useCallback(() => {
      if (!isDbLoading) {
        fetchOverdueTasks();
      }
    }, [isDbLoading, fetchOverdueTasks]),
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

  const [bulkFailureOnGoing, setBulkFailureOnGoing] = useState(false);
  const handleBulkFailures = async (data: Task[]) => {
    const taskIds = data.map(task => task.id);
    setBulkFailureOnGoing(true);
    try {
      await taskService.bulkFailTasks(
        taskIds,
        user && user.id,
        user?.isPremium ?? false,
      );
      await fetchOverdueTasks();
    } catch (err) {
      showSnackbar(
        'An error occurred while marking tasks as failed. Please try again.',
      );
    } finally {
      setBulkFailureOnGoing(false);
    }
  };

  const handleFailAllOverdueTasksAtOnce = async () => {
    setBulkFailureOnGoing(true);
    try {
      await taskService.failAllOverdueTasksAtOnce(
        user && user.id,
        user?.isPremium ?? false,
      );
      await fetchOverdueTasks();
    } catch (err) {
      showSnackbar(
        'An error occurred while marking tasks as failed. Please try again.',
      );
    } finally {
      setBulkFailureOnGoing(false);
    }
  };

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
            disabled={toggleTaskCompletionRequestOnGoing || bulkFailureOnGoing}
            onPress={() => {
              navigation.navigate('EditTask', { taskId: item.id });
            }}
            title={
              <Text
                variant="bodyLarge"
                disabled={
                  toggleTaskCompletionRequestOnGoing || bulkFailureOnGoing
                }
                style={
                  item.completionStatus === TaskCompletionStatusEnum.COMPLETE
                    ? styles.taskCompleted
                    : null
                }>
                {item.title}
              </Text>
            }
            style={[styles.listItem]}
            left={props => (
              <View {...props} style={styles.checkboxContainer}>
                <Checkbox
                  status={
                    item.completionStatus === TaskCompletionStatusEnum.COMPLETE
                      ? 'checked'
                      : 'unchecked'
                  }
                  onPress={() => handleTaskCompletion(item)}
                  disabled={
                    toggleTaskCompletionRequestOnGoing || bulkFailureOnGoing
                  }
                />
              </View>
            )}
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
                        TaskCompletionStatusEnum.COMPLETE ||
                      toggleTaskCompletionRequestOnGoing ||
                      bulkFailureOnGoing
                    }
                    style={styles.iconButton}
                  />
                )}
                <IconButton
                  icon="thumb-down-outline"
                  size={20}
                  iconColor="red"
                  disabled={
                    item.completionStatus ===
                      TaskCompletionStatusEnum.COMPLETE ||
                    toggleTaskCompletionRequestOnGoing ||
                    bulkFailureOnGoing
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
              </View>
            )}
          />
        </View>
      );
    },
    [
      toggleTaskCompletionRequestOnGoing,
      bulkFailureOnGoing,
      navigation,
      handleTaskCompletion,
      theme.colors.secondary,
      handleRescheduleIconTap,
      onToggleTaskCompletionStatus,
      user,
    ],
  );

  const { width } = useWindowDimensions();
  const safeMaxWidth = Math.min(width - 64, 300);

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
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <ProgressBar
        indeterminate
        visible={toggleTaskCompletionRequestOnGoing || bulkFailureOnGoing}
      />
      {isLoadingTasks ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" />
          <Text style={styles.infoText}>Loading Overdue Tasks...</Text>
        </View>
      ) : errorLoadingTasks ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>Failed to Load Tasks</Text>
          <Text style={styles.errorText}>{errorLoadingTasks}</Text>
          <IconButton icon="refresh" size={30} onPress={fetchOverdueTasks} />
        </View>
      ) : (
        <SectionList
          style={styles.sectionList}
          sections={overdueTaskSections}
          keyExtractor={item => item.id.toString()}
          renderItem={({ item }) => {
            return renderTaskItem({
              item,
              sectionBackgroundColor: theme.colors.elevation.level2,
            });
          }}
          renderSectionHeader={({ section: { title, data } }) => {
            return (
              <View
                style={[
                  styles.sectionHeaderContainer,
                  { backgroundColor: theme.colors.elevation.level2 },
                ]}>
                <Text style={[styles.sectionHeaderText]} variant="titleLarge">
                  {title}
                </Text>
                <Button
                  disabled={
                    bulkFailureOnGoing || toggleTaskCompletionRequestOnGoing
                  }
                  onPress={() => handleBulkFailures(data)}
                  textColor="red"
                  labelStyle={styles.failDateTasksButton}>
                  Fail all
                </Button>
              </View>
            );
          }}
          ItemSeparatorComponent={() => <Divider />}
          ListHeaderComponent={() => (
            <View style={styles.paddingTop}>
              <Banner
                visible={overdueTaskSections.length > 1}
                elevation={2}
                actions={[
                  {
                    label: 'Fail All Overdue',
                    onPress: handleFailAllOverdueTasksAtOnce,
                    labelStyle: { color: theme.colors.error },
                    mode: 'text',
                    disabled:
                      bulkFailureOnGoing || toggleTaskCompletionRequestOnGoing,
                  },
                ]}>
                <View style={styles.bannerContentContainer}>
                  <Icon
                    source="alert-circle-outline"
                    color={theme.colors.error}
                    size={24}
                  />
                  <View style={styles.bannerTextContainer}>
                    <Text variant="bodyLarge" style={styles.boldFonts}>
                      Clear Overdue Tasks Quickly
                    </Text>
                    <Text
                      style={{ maxWidth: safeMaxWidth }}
                      variant="bodyMedium"
                      numberOfLines={3}>
                      This helps you mark all items as 'Failed' in one go,
                      keeping your progress accurate.
                    </Text>
                  </View>
                </View>
              </Banner>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text variant={'bodyLarge'} style={styles.infoText}>
                No overdue tasks! 👍
              </Text>
            </View>
          }
          contentContainerStyle={
            overdueTaskSections.length === 0 ? styles.emptyListContainer : null
          }
        />
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
  sectionList: {
    paddingHorizontal: 16,
  },
  sectionHeaderContainer: {
    marginTop: 16,
    paddingHorizontal: 16,
    paddingTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionHeaderText: {
    fontSize: 18,
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
  failDateTasksButton: {
    fontSize: 16,
  },
  bannerContentContainer: {
    flexDirection: 'row',
  },
  bannerTextContainer: {
    flex: 1,
    marginLeft: 10,
    minWidth: 0,
  },
});

export default OverdueScreen;
