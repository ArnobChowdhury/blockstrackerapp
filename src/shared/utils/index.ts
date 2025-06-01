import { Dayjs } from 'dayjs';

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
