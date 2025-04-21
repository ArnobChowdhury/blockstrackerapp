import React, {useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootTabParamList} from '../navigation/RootNavigator';
import {TextInput, Text, Chip, Checkbox} from 'react-native-paper';
import {TaskScheduleTypeEnum, TimeOfDay} from '../types';

type Props = NativeStackScreenProps<RootTabParamList, 'AddTask'>;

// Helper function to capitalize
const capitalize = (s: string) => {
  if (typeof s !== 'string') return '';
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
};

const AddTaskScreen = ({}: Props) => {
  const [taskName, setTaskName] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [selectedScheduleType, setSelectedScheduleType] =
    useState<TaskScheduleTypeEnum>(TaskScheduleTypeEnum.Unscheduled);
  const [selectedTimeOfDay, setSelectedTimeOfDay] = useState<TimeOfDay | null>(
    null,
  );

  const [shouldBeScored, setShouldBeScored] = useState(false);

  const handleFrequencySelect = (frequency: TaskScheduleTypeEnum) => {
    // if (frequency !== selectedScheduleType) {
    //   handleReset();
    // }
    // if (frequency === TaskScheduleTypeEnum.Once) {
    //   setDateAnchorEl(e.currentTarget);
    // } else {
    //   setSelectedTypeFrequency(frequency);
    // }
    setSelectedScheduleType(frequency);
  };

  const handleTimeToggle = (time: TimeOfDay) => {
    setSelectedTimeOfDay(prev => (prev === time ? null : time));
  };

  const handleShouldBeScored = () => {
    setShouldBeScored(prev => !prev);
  };

  return (
    <SafeAreaView style={styles.container}>
      <TextInput
        label="Task Name"
        value={taskName}
        onChangeText={txt => setTaskName(txt)}
        style={styles.textInput}
      />
      <TextInput
        label="Task Description"
        value={taskDescription}
        onChangeText={txt => setTaskDescription(txt)}
        multiline={true}
        numberOfLines={4}
        style={styles.textInput}
      />
      <Text variant="titleMedium" style={styles.inputHeader}>
        Schedule
      </Text>
      <View style={styles.scheduleContainer}>
        {Object.values(TaskScheduleTypeEnum).map((option, index) => (
          <Chip
            key={index}
            mode="outlined"
            style={[styles.chipBase, index < 3 && styles.marginBottom]}
            selected={option === selectedScheduleType}
            showSelectedOverlay={true}
            compact={true}
            onPress={() => handleFrequencySelect(option)}>
            {option}
          </Chip>
        ))}
      </View>
      <Text variant="titleMedium" style={styles.inputHeader}>
        Time of day
      </Text>
      <View style={styles.scheduleContainer}>
        {Object.values(TimeOfDay).map((time, index) => (
          <Chip
            key={index}
            mode="outlined"
            style={styles.chipBase}
            selected={time === selectedTimeOfDay}
            showSelectedOverlay={true}
            compact={true}
            onPress={() => handleTimeToggle(time)}>
            {capitalize(time)}
          </Chip>
        ))}
      </View>

      {(selectedScheduleType === TaskScheduleTypeEnum.Daily ||
        selectedScheduleType === TaskScheduleTypeEnum.SpecificDaysInAWeek) && (
        <View style={styles.scheduleContainer}>
          <Checkbox
            status={shouldBeScored ? 'checked' : 'unchecked'}
            onPress={handleShouldBeScored}
          />
          <Text variant="bodyMedium" onPress={handleShouldBeScored}>
            Should be scored
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
  },
  textInput: {
    marginBottom: 20,
  },
  inputHeader: {
    marginBottom: 10,
  },
  scheduleContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
    alignItems: 'center',
  },
  chipBase: {
    marginRight: 8,
  },
  marginBottom: {
    marginBottom: 8,
  },
});

export default AddTaskScreen;
