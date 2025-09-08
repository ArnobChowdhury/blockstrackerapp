import React, { useState, useMemo, useCallback, useLayoutEffect } from 'react';
import { StyleSheet, View, ActivityIndicator, ScrollView } from 'react-native';
import { Text, IconButton, Snackbar } from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TaskService } from '../services/TaskService';
import type { TrackerStackParamList } from '../navigation/RootNavigator';
import { Task } from '../types';
import HabitHeatmap from '../shared/components/HabitHeatmap';

type Props = NativeStackScreenProps<TrackerStackParamList, 'Tracker'>;

const TrackerScreen = ({ route, navigation }: Props) => {
  const { habit } = route.params;
  console.log('[Tracker] Habit:', habit.title);

  const taskService = useMemo(() => new TaskService(), []);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const [errorLoadingTasks, setErrorLoadingTasks] = useState<string | null>(
    null,
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      title: habit.title,
    });
  }, [navigation, habit]);

  const fetchTaskOfHabit = useCallback(
    async (repetitiveTaskTemplateId: string) => {
      console.log(`[Tracker-${habit.id}] Fetching tasks...`);
      setErrorLoadingTasks(null);

      try {
        const fetchedTasks: Task[] =
          await taskService.getActiveTasksByRepetitiveTaskTemplateId(
            repetitiveTaskTemplateId,
          );

        console.log(
          `[Tracker-${habit.id}] Fetched tasks count:`,
          fetchedTasks.length,
        );
        setTasks(fetchedTasks);
      } catch (error: any) {
        console.error(`[Tracker-${habit.id}] Failed to fetch tasks:`, error);
        setErrorLoadingTasks(
          error.message || 'An unknown error occurred while fetching tasks.',
        );
        setTasks([]);
      } finally {
        setIsLoadingTasks(false);
      }
    },
    [taskService, habit],
  );

  const [screenRequestError, setScreenRequestError] = useState('');
  const [showSnackbar, setShowSnackbar] = useState(false);

  useFocusEffect(
    useCallback(() => {
      console.log(`[Tracker-${habit.id}] Screen focused.`);
      fetchTaskOfHabit(habit.id);
    }, [fetchTaskOfHabit, habit]),
  );
  const handleSnackbarDismiss = () => {
    setShowSnackbar(false);
    setTimeout(() => {
      setScreenRequestError('');
    }, 1000);
  };

  return (
    <SafeAreaView edges={['bottom', 'left', 'right']}>
      <ScrollView>
        {isLoadingTasks ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" />
            <Text style={styles.loadingText}>Loading Tasks...</Text>
          </View>
        ) : errorLoadingTasks ? (
          <View style={styles.centered}>
            <Text style={styles.errorText}>Failed to Load Tasks</Text>
            <Text style={styles.errorText}>{errorLoadingTasks}</Text>
            <IconButton
              icon="refresh"
              size={30}
              onPress={() => fetchTaskOfHabit(habit.id)}
            />
          </View>
        ) : (
          <View style={styles.heatmapContainer}>
            <Text variant="titleMedium" style={styles.heading}>
              Activity Heatmap
            </Text>
            <HabitHeatmap
              repetitiveTaskTemplate={habit}
              tasks={tasks}
              numDays={91}
            />
          </View>
        )}
      </ScrollView>
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
  heatmapContainer: {
    paddingVertical: 20,
  },
  heading: {
    marginBottom: 10,
    textAlign: 'center',
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

export default TrackerScreen;
