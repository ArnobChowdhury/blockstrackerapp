import React, {
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useLayoutEffect,
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
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TaskService } from '../services/TaskService';
import { RepetitiveTaskTemplateService } from '../services/RepetitiveTaskTemplateService';
import { SpaceService } from '../services/SpaceService';
import AutocompleteInput, {
  AutocompleteInputHandles,
} from '../shared/components/Autocomplete';
import truncate from 'html-truncate';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import {
  TextInput,
  Text,
  Chip,
  Checkbox,
  Button,
  Snackbar,
  Divider,
  useTheme,
  IconButton,
  Icon,
} from 'react-native-paper';
import { TaskScheduleTypeEnum, TimeOfDay, DaysInAWeek } from '../types';
import type { RepetitiveTaskTemplate, Task, Space } from '../types';
import {
  capitalize,
  getScheduledWeekDaysFromRepetitiveTask,
} from '../shared/utils';
import { useDatabase } from '../shared/hooks/useDatabase';
import { useAppContext } from '../shared/contexts/useAppContext';
import { DatePickerModal } from 'react-native-paper-dates';
import RenderHtml from 'react-native-render-html';
import dayjs from 'dayjs';

type Props = NativeStackScreenProps<RootStackParamList, 'EditTask'>;

const EditTaskScreen = ({ navigation, route }: Props) => {
  const isRepetitiveTaskTemplate =
    route.params?.isRepetitiveTaskTemplate || false;

  useLayoutEffect(() => {
    navigation.setOptions({
      title: 'Edit',
    });
  }, [navigation]);

  const theme = useTheme();
  const { user } = useAppContext();
  const { isLoading: isDbLoading, error: dbError } = useDatabase();
  const [isRepetitiveTask, setIsRepetitiveTask] = useState<boolean>(false);
  const [taskTemplateId, setTaskTemplateId] = useState<string | null>(null);
  const [taskName, setTaskName] = useState('');
  const [taskDescription, setTaskDescription] = useState<string | null>('');
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

  const [isLoadingTask, setIsLoadingTask] = useState(true);
  const [errorLoadingTask, setErrorLoadingTask] = useState<string | null>(null);
  const [allSpaces, setAllSpaces] = useState<Space[]>([]);

  const autocompleteInputRef = useRef<AutocompleteInputHandles>(null);
  const taskService = useMemo(() => new TaskService(), []);
  const repetitiveTaskTemplateService = useMemo(
    () => new RepetitiveTaskTemplateService(),
    [],
  );
  const spaceService = useMemo(() => new SpaceService(), []);

  const fetchSpace = useCallback(
    async (spaceId: string) => {
      try {
        const space = await spaceService.getSpaceById(spaceId, user && user.id);
        if (!space) {
          throw new Error(`Space with ID ${spaceId} not found.`);
        }
        setSelectedSpace(space);
      } catch (error: any) {
        console.error('[EditTaskScreen] Failed to fetch space');
      }
    },
    [spaceService, user],
  );

  const fetchTaskOrTemplate = useCallback(async () => {
    if (!route.params.taskId) {
      console.log('[EditTaskScreen] No task ID provided');
      setErrorLoadingTask('No task ID provided');
      return;
    }

    console.log('[EditTaskScreen] Fetching task for editing...');
    setErrorLoadingTask(null);

    try {
      let fetchedTaskOrTemplate: Task | RepetitiveTaskTemplate | null;

      if (!isRepetitiveTaskTemplate) {
        const task = await taskService.getTaskById(route.params.taskId);
        if (!task) {
          throw new Error(`Task with ID ${route.params.taskId} not found.`);
        }
        if (
          task.schedule === TaskScheduleTypeEnum.Daily ||
          task.schedule === TaskScheduleTypeEnum.SpecificDaysInAWeek
        ) {
          setIsRepetitiveTask(true);
          setTaskTemplateId(task.repetitiveTaskTemplateId);
        }
        setSelectedDate(dayjs(task.dueDate).toDate());

        fetchedTaskOrTemplate = task;
      } else {
        const repetitiveTaskTemplate =
          await repetitiveTaskTemplateService.getRepetitiveTaskTemplateById(
            route.params.taskId,
            user && user.id,
          );
        if (!repetitiveTaskTemplate) {
          throw new Error(`Task with ID ${route.params.taskId} not found.`);
        }

        const days = getScheduledWeekDaysFromRepetitiveTask(
          repetitiveTaskTemplate,
        );
        console.log(days);
        setSelectedDays(days);

        fetchedTaskOrTemplate = repetitiveTaskTemplate;
      }

      // common fields
      setTaskName(fetchedTaskOrTemplate.title);
      setTaskDescription(fetchedTaskOrTemplate.description);
      setSelectedScheduleType(fetchedTaskOrTemplate.schedule);
      setSelectedTimeOfDay(fetchedTaskOrTemplate.timeOfDay);
      setShouldBeScored(fetchedTaskOrTemplate.shouldBeScored);

      if (fetchedTaskOrTemplate.spaceId) {
        await fetchSpace(fetchedTaskOrTemplate.spaceId);
      }
    } catch (error: any) {
      console.error('[TodayScreen] Failed to fetch tasks:', error);
      setErrorLoadingTask(
        error.message || 'An unknown error occurred while fetching tasks.',
      );
    } finally {
      setIsLoadingTask(false);
    }
  }, [
    route.params.taskId,
    isRepetitiveTaskTemplate,
    taskService,
    repetitiveTaskTemplateService,
    user,
    fetchSpace,
  ]);

  useEffect(() => {
    fetchTaskOrTemplate();
  }, [fetchTaskOrTemplate]);

  useEffect(() => {
    if (route.params?.updatedDescription) {
      setTaskDescription(route.params.updatedDescription);
      navigation.setParams({ updatedDescription: undefined });
    }
  }, [route.params?.updatedDescription, navigation]);

  const handleTimeToggle = useCallback((time: TimeOfDay) => {
    setSelectedTimeOfDay(prev => (prev === time ? null : time));
  }, []);

  const handleShouldBeScored = useCallback(() => {
    setShouldBeScored(prev => !prev);
  }, []);

  const handleTaskUpdate = async () => {
    const trimmedTaskName = taskName.trim();
    if (!trimmedTaskName) {
      Alert.alert('Missing Information', 'Please enter a Task Name.');
      return;
    }

    if (!route.params.taskId) {
      Alert.alert(
        'Something went wrong',
        'The task ID is missing. Please try again.',
      );
      return;
    }

    setIsSaving(true);

    const trimmedDescription = taskDescription?.trim();

    try {
      if (!isRepetitiveTaskTemplate) {
        await taskService.updateTask(
          route.params.taskId,
          {
            title: trimmedTaskName,
            description: trimmedDescription,
            schedule: selectedScheduleType,
            dueDate: selectedDate,
            timeOfDay: selectedTimeOfDay,
            shouldBeScored: shouldBeScored ? 1 : 0,
            spaceId: selectedSpace && selectedSpace.id,
          },
          user && user.id,
        );
      } else {
        await repetitiveTaskTemplateService.updateRepetitiveTaskTemplate(
          route.params.taskId,
          {
            title: trimmedTaskName,
            description: trimmedDescription,
            schedule: selectedScheduleType,
            days: selectedDays,
            timeOfDay: selectedTimeOfDay,
            shouldBeScored: shouldBeScored ? 1 : 0,
            spaceId: selectedSpace && selectedSpace.id,
          },
          user && user.id,
        );
      }

      setSnackbarMessage('Task updated successfully!');
      setSnackbarVisible(true);
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

  const handleEditingRepetitiveTaskTemplateInsteadOfTask = useCallback(() => {
    if (!taskTemplateId) {
      return;
    }

    navigation.replace('EditTask', {
      taskId: taskTemplateId,
      isRepetitiveTaskTemplate: true,
    });
  }, [taskTemplateId, navigation]);

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
        await spaceService.createSpace(spaceName, user && user.id);
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

  const descriptionSource = {
    html: taskDescription
      ? truncate(taskDescription, 40)
      : '<p>Task Description</p>',
  };

  const descriptionInputFieldBaseStyles = useMemo(() => {
    return {
      fontSize: 16,
      color: theme.colors.onSurface,
      fontFamily: 'HankenGrotesk-Regular',
      marginLeft: -4,
    };
  }, [theme.colors.onSurface]);

  const [isYesPressed, setIsYesPressed] = useState(false);

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
    (isRepetitiveTaskTemplate &&
      selectedScheduleType === TaskScheduleTypeEnum.SpecificDaysInAWeek &&
      selectedDays.length === 0);

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      {isLoadingTask ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>Loading Tasks...</Text>
        </View>
      ) : errorLoadingTask ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>Failed to Load Tasks</Text>
          <Text style={styles.errorText}>{errorLoadingTask}</Text>
          <IconButton icon="refresh" size={30} onPress={fetchTaskOrTemplate} />
        </View>
      ) : (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.KeyboardAvoidingView}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            onScroll={() => {
              autocompleteInputRef.current?.remeasure();
            }}
            scrollEventThrottle={16}>
            {isRepetitiveTask && (
              <View style={styles.disclaimer}>
                <Icon source="information-outline" size={20} />
                <Text
                  variant="bodyMedium"
                  style={[
                    { color: theme.colors.primary },
                    styles.disclaimerText,
                  ]}>
                  Editing this form will not affect the underlying template of
                  this repetitive task. Would you like to edit the template
                  instead?{' '}
                  <Pressable
                    style={[isYesPressed && styles.disclaimerPressable]}
                    onPressIn={() => setIsYesPressed(true)}
                    onPressOut={() => {
                      setIsYesPressed(false);
                      handleEditingRepetitiveTaskTemplateInsteadOfTask();
                    }}>
                    <Text
                      variant="bodyMedium"
                      style={[
                        styles.disclaimerLink,
                        {
                          color: theme.colors.secondary,
                        },
                      ]}>
                      Yes
                    </Text>
                  </Pressable>
                </Text>
              </View>
            )}
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
                  source: 'EditTask',
                  initialHTML: taskDescription || '',
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
                />
              </View>
            </TouchableOpacity>

            <View style={styles.scheduleContainer}>
              <Text variant="titleMedium" style={styles.inputHeader}>
                Schedule:
              </Text>
              <Text variant="bodyLarge" style={styles.inputHeader}>
                {' '}
                {selectedScheduleType}
              </Text>
            </View>

            {selectedDate && (
              <>
                <Chip
                  icon={'calendar-outline'}
                  style={styles.marginBottom}
                  onPress={() => setSelectedDateVisible(true)}>
                  {sDate}
                </Chip>
                <Divider style={styles.marginTop} />
              </>
            )}

            {isRepetitiveTaskTemplate &&
              selectedScheduleType ===
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
              onPress={handleTaskUpdate}
              style={styles.addButton}
              labelStyle={{ color: theme.colors.onPrimaryContainer }}
              loading={isSaving}
              disabled={isSaving || isDbLoading || addTaskDisabled}
              icon="plus-circle-outline">
              {isSaving ? 'Saving Task...' : 'Save Task'}
            </Button>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
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
  scheduleContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  disclaimer: {
    marginBottom: 10,
    flexDirection: 'row',
  },
  disclaimerText: { flex: 1, marginLeft: 6 },
  disclaimerPressable: {
    opacity: 0.5,
  },
  disclaimerLink: {
    fontWeight: 'bold',
    textDecorationLine: 'underline',
  },
});

export default EditTaskScreen;
