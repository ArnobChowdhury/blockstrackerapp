import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  TaskRepository,
  SpaceRepository,
} from '../services/database/repository';
import AutocompleteInput from '../shared/components/Autocomplete';

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
import type { Space } from '../types';
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
  const [snackbarMessage, setSnackbarMessage] = useState('');

  const [selectedDateVisible, setSelectedDateVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>();

  const [selectedSpace, setSelectedSpace] = useState<Space | null>(null);

  const [taskRepository, setTaskRepository] = useState<TaskRepository | null>(
    null,
  );
  const [spaceRepository, setSpaceRepository] =
    useState<SpaceRepository | null>(null);

  const [allSpaces, setAllSpaces] = useState<Space[]>([]);

  useEffect(() => {
    if (db && !dbError && !isDbLoading) {
      setTaskRepository(new TaskRepository(db));
    } else {
      setTaskRepository(null);
    }
  }, [db, dbError, isDbLoading]);

  useEffect(() => {
    if (db && !dbError && !isDbLoading) {
      setSpaceRepository(new SpaceRepository(db));
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
    setSelectedDateVisible(false);
    setSelectedDate(undefined);
    setSelectedSpace(null);
    setSpaceQuery('');
    setIsSaving(false);

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
        dueDate: selectedDate,
        timeOfDay: selectedTimeOfDay,
        shouldBeScored: finalShouldBeScored,
        space: selectedSpace,
      });

      setSnackbarMessage('Task added successfully!');
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

  const onDismissSnackBar = () => {
    setSnackbarVisible(false);
    setSnackbarMessage('');
  };

  const [spaceQuery, setSpaceQuery] = useState('');
  const [isLoadingSpaces, setIsLoadingSpaces] = useState(true);
  // const [errorLoadingSpace, setErrorLoadingSpace] = useState();
  const [isSpaceOnFocus, setIsSpaceOnFocus] = useState(false);

  const handleSpaceOnFocus = () => {
    setIsSpaceOnFocus(true);
  };

  const handleSpaceOnBlur = () => {
    setIsSpaceOnFocus(false);
  };

  const handleLoadSpace = useCallback(async () => {
    if (!spaceRepository) {
      return;
    }

    setIsLoadingSpaces(true);

    try {
      const spaces = await spaceRepository.getAllSpaces();
      setAllSpaces(spaces);
    } catch (error: any) {
      setSnackbarVisible(true);
      setSnackbarMessage(
        `Failed to load spaces: ${error.message || 'Unknown error'}`,
      );

      console.error('[DB] Failed to fetch spaces:', error);
    } finally {
      setIsLoadingSpaces(false);
    }
  }, [spaceRepository]);

  const handleAddSpace = useCallback(
    async (spaceName: string) => {
      if (!spaceRepository) {
        return;
      }

      try {
        await spaceRepository.addSpace(spaceName);
        handleLoadSpace();
      } catch (error: any) {
        Alert.alert(
          'Database Error',
          `Failed to create space "${spaceName}": ${
            error.message || 'Unknown error'
          }`,
        );
        console.error('[DB] Failed to add space:', error);
      }
    },
    [spaceRepository, handleLoadSpace],
  );

  const handleSpaceSelect = useCallback(
    (spaceId: number | null) => {
      if (!spaceId) {
        setSelectedSpace(null);
        return;
      }

      const foundSpace = allSpaces.find(space => space.id === spaceId);
      if (foundSpace) {
        setSelectedSpace(foundSpace);
      }
    },
    [setSelectedSpace, allSpaces],
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

  const addTaskDisabled = !taskName || !selectedScheduleType || isSpaceOnFocus;

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
          Schedule*
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
            <Checkbox.Android
              status={shouldBeScored ? 'checked' : 'unchecked'}
              onPress={handleShouldBeScored}
              disabled={isSaving}
            />
            <Text
              variant="bodyMedium"
              onPress={isSaving ? undefined : handleShouldBeScored}
              style={isSaving ? styles.disabledText : null}>
              Should be scored
            </Text>
          </View>
        )}
        <AutocompleteInput
          label="Select or Create a space for the task (Optional)"
          query={spaceQuery}
          setQuery={setSpaceQuery}
          onSelect={handleSpaceSelect}
          options={allSpaces}
          loading={isLoadingSpaces}
          onLoadSuggestions={handleLoadSpace}
          onAddOption={handleAddSpace}
          selectedOption={selectedSpace}
          onFocus={handleSpaceOnFocus}
          onBlur={handleSpaceOnBlur}
        />
      </ScrollView>

      <Button
        mode="contained"
        onPress={handleAddTask}
        style={styles.addButton}
        loading={isSaving}
        disabled={isSaving || isDbLoading || addTaskDisabled}
        icon="plus-circle-outline">
        {isSaving ? 'Adding Task...' : 'Add Task'}
      </Button>
      <Snackbar
        visible={snackbarVisible}
        onDismiss={onDismissSnackBar}
        duration={3000}
        onIconPress={onDismissSnackBar}>
        {snackbarMessage}
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
