import { Dayjs } from 'dayjs';
import { DaysInAWeek, RepetitiveTaskTemplate } from '../../types';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const capitalize = (s: string) => {
  if (typeof s !== 'string') {
    return '';
  }
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
};

export const formatDate = (day: Dayjs) => {
  return day.format('dddd, MMMM D, YYYY');
};

export const truncateString = (
  text: string,
  maxLength: number,
  suffix: string = '...',
): string => {
  maxLength = Math.max(maxLength, 0);

  if (text.length <= maxLength) {
    return text;
  }

  if (maxLength <= suffix.length) {
    return text.substring(0, maxLength);
  }

  const charactersToKeep = maxLength - suffix.length;
  const truncatedText = text.substring(0, charactersToKeep);
  return truncatedText + suffix;
};

export const getScheduledWeekDaysFromRepetitiveTask = (
  repetitiveTaskTemplate: RepetitiveTaskTemplate,
) => {
  const days: DaysInAWeek[] = [];
  Object.values(DaysInAWeek).forEach(day => {
    if (repetitiveTaskTemplate[day]) {
      days.push(day);
    }
  });

  return days;
};

export const storeData = async (key: string, value: string) => {
  try {
    await AsyncStorage.setItem(key, value);
    console.log('Data saved successfully!');
  } catch (e) {
    console.error('Failed to save data.', e);
  }
};

export const readData = async (key: string) => {
  try {
    const value = await AsyncStorage.getItem(key);
    if (value !== null) {
      console.log('Retrieved data:', value);
      return value;
    }
  } catch (e) {
    console.error('Failed to read data.', e);
  }
};

export const removeData = async (key: string) => {
  try {
    await AsyncStorage.removeItem(key);
    console.log('Data removed successfully!');
  } catch (e) {
    console.error('Failed to remove data.', e);
  }
};
