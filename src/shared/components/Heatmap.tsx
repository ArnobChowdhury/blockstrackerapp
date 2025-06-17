import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import dayjs from 'dayjs';
import { Task, TaskCompletionStatusEnum } from '../../types';
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

const scoreColors = ['#e8ffe9', '#7be187', '#24c241', '#019927', '#006620'];

const INCOMPLETE_COLOR = '#eeeeee';
const FAILED_COLOR = '#d43f3f';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const Heatmap: React.FC<Props> = ({ tasks, weeksToShow = 12 }) => {
  const today = dayjs();
  const startDate = today.subtract(weeksToShow * 7, 'day');

  const weeks: dayjs.Dayjs[] = [];
  for (let i = 0; i < weeksToShow + 1; i++) {
    weeks.push(startDate.add(i, 'week').startOf('week'));
  }

  const scoreMap: Record<string, string> = {};
  tasks.forEach(task => {
    if (task.dueDate) {
      const dateKey = dayjs(task.dueDate).format('YYYY-MM-DD');
      if (task.completionStatus === TaskCompletionStatusEnum.COMPLETE) {
        scoreMap[dateKey] = task.shouldBeScored
          ? scoreColors[task.score as number]
          : scoreColors[4];
      } else if (task.completionStatus === TaskCompletionStatusEnum.FAILED) {
        scoreMap[dateKey] = FAILED_COLOR;
      } else {
        scoreMap[dateKey] = INCOMPLETE_COLOR;
      }
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
              const bg = scoreMap[dateKey];
              const dateIsTodayOrEarlier =
                cellDate.isSame(today, 'day') ||
                cellDate.isBefore(today, 'day');

              console.log('bg', bg);

              return (
                <View
                  key={dayIdx}
                  style={[
                    styles.cell,
                    // eslint-disable-next-line react-native/no-inline-styles
                    {
                      backgroundColor: dateIsTodayOrEarlier
                        ? bg ?? INCOMPLETE_COLOR
                        : 'transparent',
                    },
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

const CELL_SIZE = 24;

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
