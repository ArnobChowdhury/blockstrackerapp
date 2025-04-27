import React, {useState, useEffect, useCallback} from 'react';
import {
  StyleSheet,
  View,
  ActivityIndicator,
  FlatList,
  Alert,
} from 'react-native';
import {Text, Checkbox, IconButton, List, Divider} from 'react-native-paper';
// import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useFocusEffect} from '@react-navigation/native';
import {SafeAreaView} from 'react-native-safe-area-context';
// import type {RootTabParamList} from '../navigation/RootNavigator';
import {TaskRepository} from '../services/database/repository';
import {useDatabase} from '../shared/hooks/useDatabase';
import type {Task} from '../types';

const taskSeparator = () => <Divider />;

// type Props = NativeStackScreenProps<RootTabParamList, 'Active'>; // this will be used when we add stack navigation

// const ActiveScreen = ({navigation}: Props) => { // this will be used when we add stack navigation
const ActiveScreen = () => {
  // Renamed navigation prop for potential future use
  const {db, isLoading: isDbLoading, error: dbError} = useDatabase();
  const [taskRepository, setTaskRepository] = useState<TaskRepository | null>(
    null,
  );
  const [unscheduledTasks, setUnscheduledTasks] = useState<Task[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
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

  const fetchTasks = useCallback(async () => {
    if (!taskRepository) {
      return; // Repository not ready
    }
    console.log('[ActiveScreen] Fetching unscheduled tasks...');
    setIsLoadingTasks(true);
    setErrorLoadingTasks(null);
    try {
      const tasks = await taskRepository.getAllActiveUnscheduledTasks();
      console.log('[ActiveScreen] Fetched tasks:', tasks);
      setUnscheduledTasks(tasks);
    } catch (error: any) {
      console.error('[ActiveScreen] Failed to fetch tasks:', error);
      setErrorLoadingTasks(
        error.message || 'An unknown error occurred while fetching tasks.',
      );
      setUnscheduledTasks([]); // Clear tasks on error
    } finally {
      setIsLoadingTasks(false);
    }
  }, [taskRepository]);

  useFocusEffect(
    useCallback(() => {
      if (taskRepository) {
        fetchTasks();
      } else {
        console.log(
          '[ActiveScreen] Screen focused, but repository not ready yet.',
        );
      }
    }, [fetchTasks, taskRepository]),
  );

  // --- Placeholder Handlers ---
  // NOTE: These need actual implementation (DB updates, navigation, etc.)
  const handleCheckTask = useCallback((taskId: number) => {
    console.log(`[ActiveScreen] Checkbox toggled for task ID: ${taskId}`);
    // TODO: Implement logic to update task completion status in the database
    // Example: Optimistically update UI, then call repository method
    // setUnscheduledTasks(prevTasks =>
    //   prevTasks.map(task =>
    //     task.id === taskId ? { ...task, /* update status */ } : task
    //   )
    // );
    // await taskRepository.updateTaskStatus(taskId, newStatus);
    // Refetch or handle potential errors
    Alert.alert('Action Needed', `Mark task ${taskId} as complete/incomplete`);
  }, []);

  const handleRescheduleTask = useCallback((taskId: number) => {
    console.log(
      `[ActiveScreen] Reschedule icon pressed for task ID: ${taskId}`,
    );
    // TODO: Implement navigation or modal logic for rescheduling
    Alert.alert('Action Needed', `Reschedule task ${taskId}`);
    // Example: navigation.navigate('RescheduleScreen', { taskId });
  }, []); // Add navigation if used: [navigation]

  // const handleDeleteTask = useCallback(
  //   (taskId: number) => {
  //     console.log(`[ActiveScreen] Delete icon pressed for task ID: ${taskId}`);
  //     Alert.alert(
  //       'Confirm Deletion',
  //       'Are you sure you want to permanently delete this task?',
  //       [
  //         {text: 'Cancel', style: 'cancel'},
  //         {
  //           text: 'Delete',
  //           style: 'destructive',
  //           onPress: async () => {
  //             console.log(`[ActiveScreen] Deleting task ID: ${taskId}`);
  //             // TODO: Implement logic to delete task from the database
  //             // Example: Optimistically update UI, then call repository method
  //             // setUnscheduledTasks(prevTasks => prevTasks.filter(task => task.id !== taskId));
  //             // try {
  //             //   await taskRepository.deleteTask(taskId); // Assuming deleteTask exists
  //             // } catch (error) {
  //             //   console.error("Failed to delete task:", error);
  //             //   Alert.alert("Error", "Failed to delete task.");
  //             //   fetchTasks(); // Refetch to correct UI state
  //             // }
  //           },
  //         },
  //       ],
  //     );
  //   },
  //   [fetchTasks], // Add fetchTasks if you refetch after delete
  // );

  const renderTaskItem = ({item}: {item: Task}) => (
    <List.Item
      title={item.title}
      titleNumberOfLines={2}
      description={item.description}
      descriptionNumberOfLines={3}
      style={styles.listItem}
      // eslint-disable-next-line react/no-unstable-nested-components
      left={props => (
        // Using List.Item's left prop for alignment
        <View {...props} style={styles.checkboxContainer}>
          <Checkbox.Android // Or Checkbox.IOS
            status={'unchecked'}
            onPress={() => handleCheckTask(item.id)}
          />
        </View>
      )}
      // eslint-disable-next-line react/no-unstable-nested-components
      right={props => (
        <View {...props} style={styles.iconContainer}>
          <IconButton
            icon="calendar-refresh-outline" // Or 'clock-edit-outline' etc.
            size={20}
            onPress={() => handleRescheduleTask(item.id)}
            style={styles.iconButton}
          />
          <IconButton
            icon="delete-outline" // Or 'trash-can-outline'
            size={20}
            iconColor="red"
            // onPress={() => handleDeleteTask(item.id)}
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
        <Text style={styles.loadingText}>Initializing Database...</Text>
      </SafeAreaView>
    );
  }

  if (dbError) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.errorText}>Database Initialization Failed</Text>
        <Text style={styles.errorText}>{dbError.message}</Text>
        <Text style={styles.infoText}>Please try restarting the app.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {isLoadingTasks ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>Loading Tasks...</Text>
        </View>
      ) : errorLoadingTasks ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>Failed to Load Tasks</Text>
          <Text style={styles.errorText}>{errorLoadingTasks}</Text>
          <IconButton icon="refresh" size={30} onPress={fetchTasks} />
        </View>
      ) : (
        <FlatList
          data={unscheduledTasks}
          renderItem={renderTaskItem}
          keyExtractor={item => item.id.toString()}
          ItemSeparatorComponent={taskSeparator}
          ListHeaderComponent={
            <List.Subheader style={styles.listHeader}>
              Unscheduled Tasks
            </List.Subheader>
          }
          ListEmptyComponent={
            // Show message when list is empty
            <View style={styles.centered}>
              <Text style={styles.infoText}>
                No active unscheduled tasks found.
              </Text>
            </View>
          }
          contentContainerStyle={
            unscheduledTasks.length === 0 ? styles.emptyListContainer : null
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 80,
  },
  emptyListContainer: {
    flexGrow: 1,
    justifyContent: 'center',
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
  listHeader: {
    fontWeight: 'bold',
    fontSize: 18,
  },
  listItem: {
    paddingRight: 6,
    paddingLeft: 10,
  },
  checkboxContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingRight: 0,
    marginRight: 8,
  },
  iconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  iconButton: {
    margin: 0,
    padding: 0,
    marginLeft: 4,
  },
});

export default ActiveScreen;
