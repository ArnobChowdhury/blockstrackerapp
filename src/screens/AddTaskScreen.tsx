import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TaskRepository } from '../services/database/repository';

import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootTabParamList } from '../navigation/RootNavigator';
import {
  TextInput,
  Text,
  Chip,
  Checkbox,
  Button,
  Snackbar,
  Divider,
} from 'react-native-paper';
import { TaskScheduleTypeEnum, TimeOfDay } from '../types';
import { capitalize } from '../shared/utils';
import { useDatabase } from '../shared/hooks/useDatabase';
import { DatePickerModal } from 'react-native-paper-dates';
import dayjs from 'dayjs';

type Props = NativeStackScreenProps<RootTabParamList, 'AddTask'>;

const AddTaskScreen = ({}: Props) => {
  const { db, isLoading: isDbLoading, error: dbError } = useDatabase();
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

  const [selectedDateVisible, setSelectedDateVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>();

  const [taskRepository, setTaskRepository] = useState<TaskRepository | null>(
    null,
  );

  useEffect(() => {
    if (db && !dbError && !isDbLoading) {
      setTaskRepository(new TaskRepository(db));
    } else {
      setTaskRepository(null);
    }
  }, [db, dbError, isDbLoading]);

  const handleFrequencySelect = useCallback(
    (frequency: TaskScheduleTypeEnum) => {
      setSelectedScheduleType(frequency);

      if (frequency === TaskScheduleTypeEnum.Once) {
        setSelectedDateVisible(true);
      }

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
    const trimmedTaskName = taskName.trim();
    if (!trimmedTaskName) {
      Alert.alert('Missing Information', 'Please enter a Task Name.');
      return;
    }

    if (!taskRepository) {
      Alert.alert(
        'Database Error',
        'The database repository is not ready. Please wait or restart the app.',
      );
      return;
    }

    setIsSaving(true);

    const trimmedDescription = taskDescription.trim();
    const isScorableType =
      selectedScheduleType === TaskScheduleTypeEnum.Daily ||
      selectedScheduleType === TaskScheduleTypeEnum.SpecificDaysInAWeek;
    const finalShouldBeScored = isScorableType ? (shouldBeScored ? 1 : 0) : 0;

    try {
      await taskRepository.addTask({
        title: trimmedTaskName,
        description: trimmedDescription,
        schedule: selectedScheduleType,
        timeOfDay: selectedTimeOfDay,
        shouldBeScored: finalShouldBeScored,
      });

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

  const onConfirmSelectedDate = useCallback(
    (params: { date: Date | undefined }) => {
      setSelectedDateVisible(false);
      setSelectedDate(params.date);
    },
    [setSelectedDateVisible, setSelectedDate],
  );

  const sDate = useMemo(() => {
    if (selectedDate) {
      const d = dayjs(selectedDate);
      return `${d.date()} ${d.format('MMMM')}`;
    }
  }, [selectedDate]);

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

        {selectedScheduleType === TaskScheduleTypeEnum.Once && selectedDate && (
          <>
            <Chip icon={'calendar-outline'} style={styles.marginBottom}>
              {sDate}
            </Chip>
            <Divider style={styles.marginTop} />
          </>
        )}

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
        duration={3000}
        onIconPress={onDismissSnackBar}>
        Task added successfully!
      </Snackbar>

      <DatePickerModal
        locale="en"
        mode="single"
        visible={selectedDateVisible}
        onDismiss={() => setSelectedDateVisible(false)}
        date={selectedDate}
        onConfirm={onConfirmSelectedDate}
        label="Task Date"
        calendarIcon="calendar-outline"
        saveLabel="Select Date"
        animationType="slide"
        validRange={{ startDate: new Date() }}
      />
    </SafeAreaView>
  );
};

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
  marginBottom: {
    marginBottom: 8,
  },
  marginTop: {
    marginTop: 8,
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
