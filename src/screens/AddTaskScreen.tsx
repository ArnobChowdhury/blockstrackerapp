import React, {useState, useCallback} from 'react';
import {
  StyleSheet,
  View,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootTabParamList} from '../navigation/RootNavigator';
import {
  TextInput,
  Text,
  Chip,
  Checkbox,
  Button,
  Snackbar,
} from 'react-native-paper';
import {TaskScheduleTypeEnum, TimeOfDay} from '../types';
import {capitalize} from '../shared/utils';
import {useDatabase} from '../shared/hooks/useDatabase';

type Props = NativeStackScreenProps<RootTabParamList, 'AddTask'>;

const AddTaskScreen = ({}: Props) => {
  const {db, isLoading: isDbLoading, error: dbError} = useDatabase();
  const [taskName, setTaskName] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [selectedScheduleType, setSelectedScheduleType] =
    useState<TaskScheduleTypeEnum>(TaskScheduleTypeEnum.Unscheduled);
  const [selectedTimeOfDay, setSelectedTimeOfDay] = useState<TimeOfDay | null>(
    null,
  );
  const [shouldBeScored, setShouldBeScored] = useState(false);
  const [isSaving, setIsSaving] = useState(false); // For Add Task button loading state
  const [snackbarVisible, setSnackbarVisible] = useState(false);

  const handleFrequencySelect = useCallback(
    (frequency: TaskScheduleTypeEnum) => {
      setSelectedScheduleType(frequency);

      if (
        frequency !== TaskScheduleTypeEnum.Daily &&
        frequency !== TaskScheduleTypeEnum.SpecificDaysInAWeek
      ) {
        setShouldBeScored(false);
      }
    },
    [],
  );

  const handleTimeToggle = useCallback((time: TimeOfDay) => {
    setSelectedTimeOfDay(prev => (prev === time ? null : time));
  }, []);

  const handleShouldBeScored = useCallback(() => {
    setShouldBeScored(prev => !prev);
  }, []);

  const resetForm = useCallback(() => {
    setTaskName('');
    setTaskDescription('');
    setSelectedScheduleType(TaskScheduleTypeEnum.Unscheduled);
    setSelectedTimeOfDay(null);
    setShouldBeScored(false);
    console.log('[Form] Reset complete');
  }, []);

  const handleAddTask = async () => {
    // 1. Validation
    const trimmedTaskName = taskName.trim();
    if (!trimmedTaskName) {
      Alert.alert('Missing Information', 'Please enter a Task Name.');
      return;
    }

    if (!db || isDbLoading || dbError) {
      Alert.alert(
        'Database Error',
        'The database is not ready. Please wait or restart the app if the problem persists.',
      );
      return;
    }

    setIsSaving(true);

    const now = new Date().toISOString(); // Consistent timestamp format
    const trimmedDescription = taskDescription.trim();

    const isScorableType =
      selectedScheduleType === TaskScheduleTypeEnum.Daily ||
      selectedScheduleType === TaskScheduleTypeEnum.SpecificDaysInAWeek;
    const finalShouldBeScored = isScorableType ? (shouldBeScored ? 1 : 0) : 0;

    const sql = `
      INSERT INTO tasks (
        title,
        description,
        schedule,
        time_of_day,
        should_be_scored,
        created_at,
        modified_at
        -- Relying on defaults for: is_active, priority, completion_status
        -- Not inserting: due_date, score, repetitive_task_template_id, space_id (add later if needed)
      ) VALUES (?, ?, ?, ?, ?, ?, ?);
    `;

    const params = [
      trimmedTaskName,
      trimmedDescription || null,
      selectedScheduleType,
      selectedTimeOfDay,
      finalShouldBeScored,
      now,
      now,
    ];

    try {
      console.log('[DB] Attempting to INSERT Task:', {sql, params});
      const result = await db.execute(sql, params);
      console.log('[DB] Task INSERT successful:', result);

      setSnackbarVisible(true);
      resetForm();
    } catch (error: any) {
      console.error('[DB] Failed to INSERT task:', error);
      Alert.alert(
        'Database Error',
        `Failed to save the task: ${error.message || 'Unknown error'}`,
      );
    } finally {
      setIsSaving(false);
    }
  };

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

  const onDismissSnackBar = () => {
    setSnackbarVisible(false);
  };

  return (
    <SafeAreaView
      style={styles.container}
      edges={['top', 'bottom', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <TextInput
          label="Task Name *"
          value={taskName}
          onChangeText={setTaskName}
          style={styles.textInput}
          disabled={isSaving}
        />

        <TextInput
          label="Task Description"
          value={taskDescription}
          onChangeText={setTaskDescription}
          multiline={true}
          numberOfLines={4}
          style={styles.textInput}
          disabled={isSaving}
        />

        <Text variant="titleMedium" style={styles.inputHeader}>
          Schedule
        </Text>
        <View style={styles.chipContainer}>
          {Object.values(TaskScheduleTypeEnum).map((option, index) => (
            <Chip
              key={index}
              mode="outlined"
              style={styles.chip}
              selected={option === selectedScheduleType}
              showSelectedOverlay={true}
              onPress={() => handleFrequencySelect(option)}
              disabled={isSaving}>
              {option}
            </Chip>
          ))}
        </View>

        <Text variant="titleMedium" style={styles.inputHeader}>
          Time of day
        </Text>
        <View style={styles.chipContainer}>
          {Object.values(TimeOfDay).map((time, index) => (
            <Chip
              key={index}
              mode="outlined"
              style={styles.chip}
              selected={time === selectedTimeOfDay}
              showSelectedOverlay={true}
              onPress={() => handleTimeToggle(time)}
              disabled={isSaving}>
              {capitalize(time)}
            </Chip>
          ))}
        </View>

        {(selectedScheduleType === TaskScheduleTypeEnum.Daily ||
          selectedScheduleType ===
            TaskScheduleTypeEnum.SpecificDaysInAWeek) && (
          <View style={styles.checkboxContainer}>
            <Checkbox.Android // Use Checkbox.Android or Checkbox.IOS explicitly if needed
              status={shouldBeScored ? 'checked' : 'unchecked'}
              onPress={handleShouldBeScored}
              disabled={isSaving}
            />
            <Text
              variant="bodyMedium"
              onPress={isSaving ? undefined : handleShouldBeScored}
              style={isSaving ? styles.disabledText : null} // Optional: Style disabled text
            >
              Should be scored
            </Text>
          </View>
        )}
      </ScrollView>

      <Button
        mode="contained"
        onPress={handleAddTask}
        style={styles.addButton}
        loading={isSaving}
        disabled={isSaving || isDbLoading}
        icon="plus-circle-outline">
        {isSaving ? 'Adding Task...' : 'Add Task'}
      </Button>
      <Snackbar
        visible={snackbarVisible}
        onDismiss={onDismissSnackBar}
        action={{
          label: 'Undo',
          onPress: onDismissSnackBar,
        }}>
        Task added successfully!
      </Snackbar>
    </SafeAreaView>
  );
};

// --- Styles ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 15,
    paddingBottom: 80,
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
  textInput: {
    marginBottom: 15,
  },
  inputHeader: {
    marginBottom: 10,
    marginTop: 10,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 15,
  },
  chip: {
    marginRight: 8,
    marginBottom: 8,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 5,
  },
  disabledText: {
    color: '#a0a0a0',
  },
  addButton: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    paddingVertical: 5,
  },
});

export default AddTaskScreen;
