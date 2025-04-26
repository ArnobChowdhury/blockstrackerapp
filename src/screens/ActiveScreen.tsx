import React, {useState, useEffect} from 'react';
import {StyleSheet, View, ActivityIndicator} from 'react-native';
import {Text} from 'react-native-paper';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {SafeAreaView} from 'react-native-safe-area-context';
import type {RootTabParamList} from '../navigation/RootNavigator';
import {TaskRepository} from '../services/database/repository';
import {useDatabase} from '../shared/hooks/useDatabase';
import type {Task} from '../types';

type Props = NativeStackScreenProps<RootTabParamList, 'Active'>;

const ActiveScreen = ({}: Props) => {
  const {db, isLoading: isDbLoading, error: dbError} = useDatabase();
  const [taskRepository, setTaskRepository] = useState<TaskRepository | null>(
    null,
  );
  const [unscheduledTasks, setUnscheduledTasks] = useState<Task[]>([]);

  useEffect(() => {
    if (db && !dbError && !isDbLoading) {
      setTaskRepository(new TaskRepository(db));
    } else {
      setTaskRepository(null);
    }
  }, [db, dbError, isDbLoading]);

  useEffect(() => {
    console.log('[ActiveScreen] taskRepository:', taskRepository);
    if (taskRepository) {
      taskRepository.getAllActiveUnscheduledTasks().then(tasks => {
        console.log('[ActiveScreen] tasks:', tasks);
        setUnscheduledTasks(tasks);
      });
    }
  }, [taskRepository]);

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
    <View style={styles.container}>
      <Text style={styles.title} variant="headlineMedium">
        Active Tasks Screen
      </Text>
      <Text variant="bodyLarge">
        Displays all active (non-completed) tasks.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    marginBottom: 10,
    textAlign: 'center',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
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
  },
});

export default ActiveScreen;
