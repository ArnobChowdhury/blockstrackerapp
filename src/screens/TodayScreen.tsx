import React, { useState, useEffect, useCallback } from 'react';
import dayjs from 'dayjs';
import {
  StyleSheet,
  View,
  SectionList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Text, Checkbox, List, Divider, IconButton } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootTabParamList } from '../navigation/RootNavigator';
import { useDatabase } from '../shared/hooks/useDatabase';
import { formatDate, capitalize } from '../shared/utils';
import { Logo } from '../shared/components/icons';
import { TaskRepository } from '../services/database/repository';
import { Task, TimeOfDay, TaskCompletionStatusEnum } from '../types';

type Props = NativeStackScreenProps<RootTabParamList, 'Today'>;

export interface TaskSection {
  title: string;
  data: Task[];
}

const TIME_OF_DAY_ORDER: Record<TimeOfDay | 'Unspecified', number> = {
  [TimeOfDay.Morning]: 1,
  [TimeOfDay.Afternoon]: 2,
  [TimeOfDay.Evening]: 3,
  [TimeOfDay.Night]: 4,
  Unspecified: 5,
};

const SECTION_THEMES: Record<string, { backgroundColor: string }> = {
  Morning: { backgroundColor: '#E4F8FC' },
  Afternoon: { backgroundColor: '#FEEED4' },
  Evening: { backgroundColor: '#FFDFDC' },
  Night: { backgroundColor: '#CDD2E9' },
  'Any Time': { backgroundColor: '#F5F5F5' },
};

const DEFAULT_SECTION_THEME = {
  backgroundColor: '#E0E0E0',
};

export const groupTasksByTimeOfDay = (tasks: Task[]): TaskSection[] => {
  const grouped: Record<string, Task[]> = {};

  tasks.forEach(task => {
    const key = task.timeOfDay || 'Unspecified';
    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push(task);
  });

  return Object.entries(grouped)
    .map(([timeOfDayKey, taskItems]) => ({
      title:
        timeOfDayKey === 'Unspecified'
          ? 'Any Time'
          : capitalize(timeOfDayKey as TimeOfDay),
      data: taskItems,
    }))
    .sort((a, b) => {
      const aKey =
        a.title === 'Any Time'
          ? 'Unspecified'
          : (a.title.toLowerCase() as TimeOfDay);
      const bKey =
        b.title === 'Any Time'
          ? 'Unspecified'
          : (b.title.toLowerCase() as TimeOfDay);
      return TIME_OF_DAY_ORDER[aKey] - TIME_OF_DAY_ORDER[bKey];
    });
};

const TodayScreen = ({ navigation }: Props) => {
  const { db, isLoading: isDbLoading, error: dbError } = useDatabase();
  const [taskRepository, setTaskRepository] = useState<TaskRepository | null>(
    null,
  );
  const [taskSections, setTaskSections] = useState<TaskSection[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const [errorLoadingTasks, setErrorLoadingTasks] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (db && !dbError && !isDbLoading) {
      setTaskRepository(new TaskRepository(db));
    } else {
      setTaskRepository(null);
    }
  }, [db, dbError, isDbLoading]);

  const fetchTasksForToday = useCallback(async () => {
    if (!taskRepository) {
      return;
    }

    console.log('[TodayScreen] Fetching tasks for today...');
    setErrorLoadingTasks(null);

    try {
      const fetchedTasks = await taskRepository.getTasksForToday();
      setTaskSections(groupTasksByTimeOfDay(fetchedTasks));
    } catch (error: any) {
      console.error('[TodayScreen] Failed to fetch tasks:', error);
      setErrorLoadingTasks(
        error.message || 'An unknown error occurred while fetching tasks.',
      );
      setTaskSections([]);
    } finally {
      setIsLoadingTasks(false);
    }
  }, [taskRepository]);

  useFocusEffect(
    useCallback(() => {
      if (taskRepository) {
        fetchTasksForToday();
      }
    }, [taskRepository, fetchTasksForToday]),
  );

  const handleCheckTask = useCallback(
    async (taskId: number, completionStatus: TaskCompletionStatusEnum) => {
      if (!taskRepository) {
        return;
      }

      try {
        await taskRepository.updateTaskCompletionStatus(
          taskId,
          completionStatus,
        );
        await fetchTasksForToday();
      } catch (error: any) {
        Alert.alert('Error', `Failed to update task: ${error.message}`);
      }
    },
    [taskRepository, fetchTasksForToday],
  );

  const renderTaskItem = ({
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
          {...(item.description && {
            description: <Text variant="bodyMedium">{item.description}</Text>,
          })}
          descriptionNumberOfLines={1}
          style={[styles.listItem]}
          left={props => (
            <View {...props} style={styles.checkboxContainer}>
              <Checkbox
                status={
                  item.completionStatus === TaskCompletionStatusEnum.COMPLETE
                    ? 'checked'
                    : 'unchecked'
                }
                onPress={() =>
                  handleCheckTask(
                    item.id,
                    item.completionStatus === TaskCompletionStatusEnum.COMPLETE
                      ? TaskCompletionStatusEnum.INCOMPLETE
                      : TaskCompletionStatusEnum.COMPLETE,
                  )
                }
              />
            </View>
          )}
        />
      </View>
    );
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

  return (
    <SafeAreaView
      style={styles.container}
      edges={['top', 'bottom', 'left', 'right']}>
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
              <Text variant="titleLarge">Today</Text>
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
      )}
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
});

export default TodayScreen;
