import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import dayjs from 'dayjs';
import { Task } from '../../types';
import isoWeek from 'dayjs/plugin/isoWeek';
import weekday from 'dayjs/plugin/weekday';
import isBetween from 'dayjs/plugin/isBetween';

dayjs.extend(isoWeek);
dayjs.extend(weekday);
dayjs.extend(isBetween);

interface Props {
  tasks: Task[];
  weeksToShow?: number; // default: 12
}

const getScore = (task: Task): number => {
  // Replace with actual scoring logic if needed
  return (task as any).score ?? 0;
};

const getColorForScore = (score: number): string => {
  switch (score) {
    case 0:
      return '#eb1e1e';
    case 1:
      return '#ff8c42';
    case 2:
      return '#ffd93d';
    case 3:
      return '#a2d729';
    case 4:
      return '#28a745';
    default:
      return '#eeeeee';
  }
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const Heatmap: React.FC<Props> = ({ tasks, weeksToShow = 12 }) => {
  const today = dayjs();
  const startDate = today.subtract(weeksToShow * 7, 'day');

  const weeks: dayjs.Dayjs[] = [];
  for (let i = 0; i < weeksToShow; i++) {
    weeks.push(startDate.add(i, 'week').startOf('week'));
  }

  const scoreMap: Record<string, number> = {};
  tasks.forEach(task => {
    if (task.dueDate) {
      const dateKey = dayjs(task.dueDate).format('YYYY-MM-DD');
      scoreMap[dateKey] = getScore(task);
    }
  });

  return (
    <View style={styles.container}>
      <View style={styles.yAxis}>
        {DAYS.map(day => (
          <Text variant="bodyMedium" key={day} style={styles.dayLabel}>
            {day}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {weeks.map((weekStart, weekIdx) => (
          <View key={weekIdx} style={styles.weekColumn}>
            {DAYS.map((_, dayIdx) => {
              const cellDate = weekStart.add(dayIdx, 'day');
              const dateKey = cellDate.format('YYYY-MM-DD');
              const score = scoreMap[dateKey] ?? -1;
              return (
                <View
                  key={dayIdx}
                  style={[
                    styles.cell,
                    { backgroundColor: getColorForScore(score) },
                  ]}
                />
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
};

export default Heatmap;

const CELL_SIZE = 28;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
  },
  yAxis: {
    marginRight: 6,
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  dayLabel: {
    // fontSize: 10,
    // color: '#999',
    height: CELL_SIZE,
  },
  grid: {
    flexDirection: 'row',
  },
  weekColumn: {
    flexDirection: 'column',
    marginRight: 4,
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: 6,
    marginBottom: 4,
  },
});
