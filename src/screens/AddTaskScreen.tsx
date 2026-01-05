import React, {
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import {
  StyleSheet,
  View,
  Alert,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TaskService } from '../services/TaskService';
import { SpaceService } from '../services/SpaceService';
import AutocompleteInput, {
  AutocompleteInputHandles,
} from '../shared/components/Autocomplete';
import truncate from 'html-truncate';
import { CompositeScreenProps } from '@react-navigation/native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type {
  BottomTabParamList,
  RootStackParamList,
} from '../navigation/RootNavigator';
import {
  TextInput,
  Text,
  Chip,
  Checkbox,
  Button,
  Snackbar,
  Divider,
  useTheme,
} from 'react-native-paper';
import { TaskScheduleTypeEnum, TimeOfDay, DaysInAWeek } from '../types';
import type { Space } from '../types';
import { capitalize } from '../shared/utils';
import { useDatabase } from '../shared/hooks/useDatabase';
import { useAppContext } from '../shared/contexts/useAppContext';
import { RepetitiveTaskTemplateService } from '../services/RepetitiveTaskTemplateService';
import { DatePickerModal } from 'react-native-paper-dates';
import RenderHtml from 'react-native-render-html';
import dayjs from 'dayjs';

type Props = CompositeScreenProps<
  BottomTabScreenProps<BottomTabParamList, 'AddTask'>,
  NativeStackScreenProps<RootStackParamList>
>;

const AddTaskScreen = ({ navigation, route }: Props) => {
  const isTodaysTask = route.params?.isToday;

  const theme = useTheme();
  const { user } = useAppContext();
  const { isLoading: isDbLoading, error: dbError } = useDatabase();
  const [taskName, setTaskName] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [selectedScheduleType, setSelectedScheduleType] =
    useState<TaskScheduleTypeEnum>(TaskScheduleTypeEnum.Unscheduled);
  const [selectedTimeOfDay, setSelectedTimeOfDay] = useState<TimeOfDay | null>(
    null,
  );
  const [shouldBeScored, setShouldBeScored] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  const [selectedDateVisible, setSelectedDateVisible] = useState(false);
  const [temporaryDate, setTemporaryDate] = useState<Date>();
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedDays, setSelectedDays] = useState<DaysInAWeek[]>([]);

  const [selectedSpace, setSelectedSpace] = useState<Space | null>(null);

  const [allSpaces, setAllSpaces] = useState<Space[]>([]);

  const autocompleteInputRef = useRef<AutocompleteInputHandles>(null);

  // Services should be memoized to avoid re-creating them on every render.
  const taskService = useMemo(() => new TaskService(), []);
  const repetitiveTaskTemplateService = useMemo(
    () => new RepetitiveTaskTemplateService(),
    [],
  );
  const spaceService = useMemo(() => new SpaceService(), []);

  useEffect(() => {
    if (isTodaysTask) {
      setSelectedScheduleType(TaskScheduleTypeEnum.Once);
      setSelectedDate(new Date());
      navigation.setParams({ isToday: false });
    }
  }, [isTodaysTask, navigation]);

  useEffect(() => {
    if (route.params?.updatedDescription) {
      setTaskDescription(route.params.updatedDescription);
      navigation.setParams({ updatedDescription: undefined });
    }
  }, [route.params?.updatedDescription, navigation]);

  const makeDateSelectionModalVisible = useCallback(() => {
    setTemporaryDate(undefined);
    setSelectedDateVisible(true);
  }, []);

  const handleFrequencySelect = useCallback(
    (frequency: TaskScheduleTypeEnum) => {
      setSelectedScheduleType(frequency);

      if (frequency !== selectedScheduleType) {
        setSelectedDate(undefined);
        setSelectedDays([]);
      }

      if (frequency === TaskScheduleTypeEnum.Once) {
        makeDateSelectionModalVisible();
      }

      if (
        frequency !== TaskScheduleTypeEnum.Daily &&
        frequency !== TaskScheduleTypeEnum.SpecificDaysInAWeek
      ) {
        setShouldBeScored(false);
      }
    },
    [makeDateSelectionModalVisible, selectedScheduleType],
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
    setSelectedDays([]);
    setIsSaving(false);

    console.log('[Form] Reset complete');
  }, []);

  const handleAddTask = async () => {
    const trimmedTaskName = taskName.trim();
    if (!trimmedTaskName) {
      Alert.alert('Missing Information', 'Please enter a Task Name.');
      return;
    }

    setIsSaving(true);

    const trimmedDescription = taskDescription.trim();
    const isRepetitiveTask =
      selectedScheduleType === TaskScheduleTypeEnum.Daily ||
      selectedScheduleType === TaskScheduleTypeEnum.SpecificDaysInAWeek;

    const finalShouldBeScored = isRepetitiveTask ? (shouldBeScored ? 1 : 0) : 0;

    try {
      if (!isRepetitiveTask) {
        await taskService.createTask(
          {
            title: trimmedTaskName,
            description: trimmedDescription,
            schedule: selectedScheduleType,
            dueDate: selectedDate,
            timeOfDay: selectedTimeOfDay,
            shouldBeScored: finalShouldBeScored,
            spaceId: selectedSpace && selectedSpace.id,
          },
          user && user.id,
          user?.isPremium ?? false,
        );
      } else {
        await repetitiveTaskTemplateService.createRepetitiveTaskTemplate(
          {
            title: trimmedTaskName,
            description: trimmedDescription,
            schedule: selectedScheduleType,
            days: selectedDays,
            timeOfDay: selectedTimeOfDay,
            shouldBeScored: finalShouldBeScored,
            spaceId: selectedSpace && selectedSpace.id,
          },
          user && user.id,
          user?.isPremium ?? false,
        );
      }

      setSnackbarMessage('Task added successfully!');
      setSnackbarVisible(true);
      resetForm();
    } catch (error: any) {
      console.error('[AddTaskScreen] Failed to add task:', error);
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
  const [isSpaceOnFocus, setIsSpaceOnFocus] = useState(false);

  const handleSpaceOnFocus = () => {
    setIsSpaceOnFocus(true);
  };

  const handleSpaceOnBlur = () => {
    setIsSpaceOnFocus(false);
  };

  const handleLoadSpace = useCallback(async () => {
    setIsLoadingSpaces(true);

    try {
      const spaces = await spaceService.getAllSpaces(user && user.id);
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
  }, [spaceService, user]);

  const handleAddSpace = useCallback(
    async (spaceName: string) => {
      try {
        await spaceService.createSpace(
          spaceName,
          user && user.id,
          user?.isPremium ?? false,
        );
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
    [spaceService, user, handleLoadSpace],
  );

  const handleSpaceSelect = useCallback(
    (spaceId: string | null) => {
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

  const handleDayToggle = (day: DaysInAWeek) => {
    setSelectedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day],
    );
  };

  const { width } = useWindowDimensions();

  const handleDatePickerModalDismiss = () => {
    if (!selectedDate) {
      setSelectedScheduleType(TaskScheduleTypeEnum.Unscheduled);
    }

    setSelectedDateVisible(false);
  };

  const descriptionSource = useMemo(
    () => ({
      html: taskDescription
        ? truncate(taskDescription, 40)
        : '<p>Task Description</p>',
    }),
    [taskDescription],
  );

  const descriptionInputFieldBaseStyles = useMemo(() => {
    return {
      fontSize: 16,
      color: theme.colors.onSurfaceVariant,
      fontFamily: 'HankenGrotesk-Regular',
      marginLeft: -4,
    };
  }, [theme.colors.onSurfaceVariant]);

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

  const addTaskDisabled =
    !taskName ||
    !selectedScheduleType ||
    isSpaceOnFocus ||
    (selectedScheduleType === TaskScheduleTypeEnum.SpecificDaysInAWeek &&
      selectedDays.length === 0);

  return (
    <SafeAreaView
      style={styles.container}
      edges={['top', 'bottom', 'left', 'right']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.KeyboardAvoidingView}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled" // Already good
          onScroll={() => {
            autocompleteInputRef.current?.remeasure();
          }}
          scrollEventThrottle={16} // Optional: Adjust for performance
        >
          <TextInput
            label="Task Name*"
            value={taskName}
            onChangeText={setTaskName}
            style={styles.textInput}
            disabled={isSaving}
          />

          <TouchableOpacity
            onPress={() =>
              navigation.navigate('TaskDescription', {
                initialHTML: taskDescription,
                source: 'AddTask',
              })
            }>
            <View
              style={[
                {
                  borderColor: theme.colors.onSurfaceVariant,
                  borderBottomColor: theme.colors.primary,
                  backgroundColor: theme.colors.surfaceVariant,
                },
                styles.descriptionContainer,
              ]}>
              <RenderHtml
                baseStyle={descriptionInputFieldBaseStyles}
                contentWidth={width}
                source={descriptionSource}
                systemFonts={['HankenGrotesk-Regular', 'sans-serif']}
                ignoredDomTags={['br']}
              />
            </View>
          </TouchableOpacity>

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

          {selectedScheduleType === TaskScheduleTypeEnum.Once &&
            selectedDate && (
              <>
                <Chip icon={'calendar-outline'} style={styles.marginBottom}>
                  {sDate}
                </Chip>
                <Divider style={styles.marginTop} />
              </>
            )}

          {selectedScheduleType ===
            TaskScheduleTypeEnum.SpecificDaysInAWeek && (
            <>
              <Text variant="titleMedium" style={styles.inputHeader}>
                Select Days*
              </Text>
              <View style={styles.chipContainer}>
                {Object.values(DaysInAWeek).map((day, index) => (
                  <Chip
                    key={index}
                    mode="outlined"
                    style={styles.chip}
                    selected={selectedDays.includes(day)}
                    showSelectedOverlay={true}
                    onPress={() => handleDayToggle(day)}
                    disabled={isSaving}>
                    {capitalize(day)}
                  </Chip>
                ))}
              </View>
            </>
          )}

          {(selectedScheduleType === TaskScheduleTypeEnum.Daily ||
            selectedScheduleType ===
              TaskScheduleTypeEnum.SpecificDaysInAWeek) && (
            <View style={styles.checkboxContainer}>
              <Checkbox
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

          <AutocompleteInput
            ref={autocompleteInputRef}
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
          <Button
            mode="contained"
            onPress={handleAddTask}
            style={styles.addButton}
            labelStyle={{ color: theme.colors.onPrimaryContainer }}
            loading={isSaving}
            disabled={isSaving || isDbLoading || addTaskDisabled}
            icon="plus-circle-outline">
            {isSaving ? 'Adding Task...' : 'Add Task'}
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
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
        onDismiss={handleDatePickerModalDismiss}
        date={selectedDate}
        onConfirm={onConfirmSelectedDate}
        onChange={change => {
          setTemporaryDate(change.date);
        }}
        label="Task Date"
        calendarIcon="calendar-outline"
        saveLabel="Select Date"
        saveLabelDisabled={!temporaryDate}
        animationType="slide"
        validRange={{ startDate: dayjs().startOf('day').toDate() }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  KeyboardAvoidingView: {
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
  descriptionContainer: {
    borderBottomWidth: 0.6,
    borderTopEndRadius: 5,
    borderTopStartRadius: 5,
    padding: 20,
    maxHeight: 120,
    overflow: 'hidden',
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
    marginBottom: 10,
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
  },
  disabledText: {
    color: '#a0a0a0',
  },
  addButton: {
    paddingVertical: 5,
    marginVertical: 20,
  },
});

export default AddTaskScreen;
