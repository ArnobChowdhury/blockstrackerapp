import { Svg, Path, Text } from 'react-native-svg';
import { useAppContext } from '../../contexts/useAppContext';

interface ICalendarTodayProps {
  date: number;
  size: number;
  color: string;
}

function CalendarToday({ date, size, color }: ICalendarTodayProps) {
  const { isDarkMode } = useAppContext();

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        opacity="0.4"
        d="M3 9.25781V16.8708C3 20.0308 4.99561 22.0008 8.12733 22.0008H15.8628C19.0241 22.0008 21 20.0708 21 16.9318V9.25781H3Z"
        fill={color}
      />
      <Path
        d="M3.00391 9.25723C3.01675 8.67023 3.06615 7.50523 3.15901 7.13023C3.63321 5.02123 5.24353 3.68123 7.5454 3.49023H16.4565C18.7386 3.69123 20.3687 5.04023 20.8429 7.13023C20.9348 7.49523 20.9841 8.66923 20.997 9.25723H3.00391Z"
        fill={color}
      />
      <Path
        d="M8.30562 6.59C8.74031 6.59 9.06633 6.261 9.06633 5.82V2.771C9.06633 2.33 8.74031 2 8.30562 2C7.87094 2 7.54492 2.33 7.54492 2.771V5.82C7.54492 6.261 7.87094 6.59 8.30562 6.59"
        fill="#000000"
      />
      <Path
        d="M15.6943 6.59C16.1191 6.59 16.455 6.261 16.455 5.82V2.771C16.455 2.33 16.1191 2 15.6943 2C15.2596 2 14.9336 2.33 14.9336 2.771V5.82C14.9336 6.261 15.2596 6.59 15.6943 6.59"
        fill="#000000"
      />
      <Text
        x="50%"
        y="65%"
        textAnchor="middle"
        dy=".3em"
        fontFamily="Inter"
        fontSize="9"
        fontWeight="bold"
        fill={isDarkMode ? '#fff' : color}>
        {date}
      </Text>
    </Svg>
  );
}

export default CalendarToday;
