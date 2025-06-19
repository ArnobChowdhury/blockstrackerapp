import React, { useState, useMemo, useLayoutEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Rect, G, Text as SvgText } from 'react-native-svg';
import dayjs from 'dayjs';
import { Task, TaskCompletionStatusEnum } from '../../types'; // Import Task and Enum
import { scoreColorConfigs } from '../constants';

interface HabitHeatmapProps {
  tasks: Task[];
  endDate?: Date | string;
  squareSize?: number;
  numDays?: number;
  onDayPress?: (date: string, task: Task | undefined) => void;
  showMonthLabels?: boolean;
  showDayLabels?: boolean;
}

const DEFAULT_SQUARE_SIZE = 16;
const DEFAULT_SQUARE_MARGIN = 4;
const DAYS_IN_WEEK = 7;
const MONTH_LABEL_HEIGHT = 20;
const DAY_LABEL_WIDTH = 30;
const NUM_DAYS_TO_DISPLAY = 120;

const getColorForTask = (task: Task | undefined): string => {
  if (!task || task.completionStatus === TaskCompletionStatusEnum.INCOMPLETE) {
    return scoreColorConfigs.noActivity;
  }

  if (task.completionStatus === TaskCompletionStatusEnum.FAILED) {
    return scoreColorConfigs.failed;
  }

  if (
    task.completionStatus === TaskCompletionStatusEnum.COMPLETE &&
    !task.shouldBeScored
  ) {
    return scoreColorConfigs.score4;
  }

  if (task.completionStatus === TaskCompletionStatusEnum.COMPLETE) {
    const score = task.shouldBeScored ? (task as any).score ?? 0 : 0;
    switch (score) {
      case 0:
        return scoreColorConfigs.score0;
      case 1:
        return scoreColorConfigs.score1;
      case 2:
        return scoreColorConfigs.score2;
      case 3:
        return scoreColorConfigs.score3;
      case 4:
        return scoreColorConfigs.score4;
      default:
        return scoreColorConfigs.noActivity;
    }
  }
  return scoreColorConfigs.noActivity;
};

const DAY_DISPLAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_LABEL_INDICES_TO_SHOW = [0, 1, 2, 3, 4, 5, 6];

const HabitHeatmap: React.FC<HabitHeatmapProps> = ({
  tasks,
  endDate: propEndDate = dayjs().toDate(),
  squareSize = DEFAULT_SQUARE_SIZE, // todo no need for this prop
  onDayPress,
  numDays = NUM_DAYS_TO_DISPLAY,
  showMonthLabels = true,
  showDayLabels = true,
}) => {
  const [viewWidth, setViewWidth] = useState<number | null>(null);
  const [dynamicSquareSize, setDynamicSquareSize] =
    useState<number>(squareSize);

  const taskMap = useMemo(() => {
    const map = new Map<string, Task>();
    tasks.forEach(task => {
      try {
        if (task.dueDate) {
          const parsedDayjsDate = dayjs(task.dueDate);
          if (parsedDayjsDate.isValid()) {
            map.set(parsedDayjsDate.format('YYYY-MM-DD'), task);
          } else {
            console.warn(
              `[HabitHeatmap] Invalid task.dueDate date: ${task.dueDate}`,
            );
          }
        }
      } catch (e) {
        console.warn(
          `[HabitHeatmap] Error processing task date: ${task.dueDate}`,
          e,
        );
      }
    });

    return map;
  }, [tasks]); // Depend on tasks prop

  // todo: optimization: we don't need a propEndDate. It will always be today. (At least for now.)
  const djsEndDate = dayjs(propEndDate);
  const djsDisplayDataEndDate = djsEndDate;
  const djsDisplayDataStartDate = djsDisplayDataEndDate.subtract(
    numDays - 1,
    'day',
  );

  const calendarGridStartDate = djsDisplayDataStartDate.startOf('week');

  const endWeekForCalc = djsDisplayDataEndDate.startOf('week');
  const numWeeksToRender =
    endWeekForCalc.diff(calendarGridStartDate, 'week') + 1;

  const totalCellSize = dynamicSquareSize + DEFAULT_SQUARE_MARGIN;
  const dayLabelOffset = showDayLabels ? DAY_LABEL_WIDTH : 0;
  const monthLabelOffset = showMonthLabels ? MONTH_LABEL_HEIGHT : 0;

  const weeksGrid: dayjs.Dayjs[][] = [];
  for (let weekIdx = 0; weekIdx < numWeeksToRender; weekIdx++) {
    const firstDayOfThisGridWeek = calendarGridStartDate.add(
      weekIdx * DAYS_IN_WEEK,
      'day',
    );
    const weekDays: dayjs.Dayjs[] = [];
    for (let dayOfWeekIdx = 0; dayOfWeekIdx < DAYS_IN_WEEK; dayOfWeekIdx++) {
      weekDays.push(firstDayOfThisGridWeek.add(dayOfWeekIdx, 'day'));
    }
    weeksGrid.push(weekDays);
  }

  const monthLabels: { text: string; x: number }[] = [];
  if (showMonthLabels) {
    let lastMonthLabeled = -1;
    weeksGrid.forEach((week, weekIdx) => {
      let monthLabelDate: dayjs.Dayjs | null = null;

      for (const dayInWeek of week) {
        if (
          dayInWeek.date() === 1 &&
          dayInWeek.month() !== lastMonthLabeled &&
          !dayInWeek.isBefore(djsDisplayDataStartDate, 'day') &&
          !dayInWeek.isAfter(djsDisplayDataEndDate, 'day')
        ) {
          monthLabelDate = dayInWeek;
          break;
        }
      }

      if (!monthLabelDate && weekIdx === 0) {
        const firstDayInGrid = week[0];
        if (
          !firstDayInGrid.isBefore(djsDisplayDataStartDate, 'day') &&
          !firstDayInGrid.isAfter(djsDisplayDataEndDate, 'day')
        ) {
          monthLabelDate = firstDayInGrid;
        }
      }

      if (monthLabelDate && monthLabelDate.month() !== lastMonthLabeled) {
        const newLabelX = dayLabelOffset + weekIdx * totalCellSize;
        const currentMonthText = monthLabelDate.format('MMM');

        if (monthLabels.length > 0) {
          const prevLabel = monthLabels[monthLabels.length - 1];
          if (
            newLabelX - prevLabel.x < 2 * totalCellSize &&
            currentMonthText === prevLabel.text
          ) {
            // Skip
          } else {
            monthLabels.push({ text: currentMonthText, x: newLabelX });
            lastMonthLabeled = monthLabelDate.month();
          }
        } else {
          monthLabels.push({ text: currentMonthText, x: newLabelX });
          lastMonthLabeled = monthLabelDate.month();
        }
      }
    });
  }

  const heatmapWidth =
    dayLabelOffset + numWeeksToRender * totalCellSize - DEFAULT_SQUARE_MARGIN;
  const heatmapHeight =
    monthLabelOffset + DAYS_IN_WEEK * totalCellSize - DEFAULT_SQUARE_MARGIN;

  const isDateInDataRange = (dateToCheck: dayjs.Dayjs): boolean => {
    return (
      !dateToCheck.isBefore(djsDisplayDataStartDate, 'day') &&
      !dateToCheck.isAfter(djsDisplayDataEndDate, 'day')
    );
  };

  useLayoutEffect(() => {
    if (viewWidth && numWeeksToRender > 0) {
      const CONTAINER_PADDING_HORIZONTAL = 20;
      const availableWidthForSvgContent =
        viewWidth - 2 * CONTAINER_PADDING_HORIZONTAL;

      const currentDayLabelOffset = showDayLabels ? DAY_LABEL_WIDTH : 0;

      const widthForSquaresAndTheirMargins =
        availableWidthForSvgContent - currentDayLabelOffset;

      let newSquareSize =
        (widthForSquaresAndTheirMargins + DEFAULT_SQUARE_MARGIN) /
          numWeeksToRender -
        DEFAULT_SQUARE_MARGIN;

      newSquareSize = Math.max(newSquareSize, 2);

      setDynamicSquareSize(newSquareSize);
    }
  }, [numWeeksToRender, showDayLabels, viewWidth]);

  return (
    <View
      style={styles.container}
      onLayout={e => setViewWidth(e.nativeEvent.layout.width)}>
      {viewWidth && (
        <Svg height={heatmapHeight} width={heatmapWidth}>
          <G>
            {/* Month Labels */}
            {showMonthLabels &&
              monthLabels.map((label, index) => (
                <SvgText
                  key={`month-${index}-${label.text}`}
                  x={label.x}
                  y={MONTH_LABEL_HEIGHT - 6}
                  fontSize={10}
                  fill="#586069"
                  textAnchor="start">
                  {label.text}
                </SvgText>
              ))}

            {showDayLabels &&
              DAY_LABEL_INDICES_TO_SHOW.map(dayIndex => (
                <SvgText
                  key={`day-label-${dayIndex}`}
                  x={DAY_LABEL_WIDTH - 10}
                  y={
                    monthLabelOffset +
                    dayIndex * totalCellSize +
                    squareSize / 2 +
                    4
                  }
                  fontSize={9}
                  fill="#586069"
                  textAnchor="end">
                  {DAY_DISPLAY_LABELS[dayIndex]}
                </SvgText>
              ))}

            {weeksGrid.map((weekDays, weekIdx) => (
              <G
                key={`week-${weekIdx}`}
                x={dayLabelOffset + weekIdx * totalCellSize}
                y={monthLabelOffset}>
                {weekDays.map((day, dayOfWeekIdx) => {
                  const dateStr = day.format('YYYY-MM-DD');
                  const taskForDay = taskMap.get(dateStr);

                  const isFirstDayOfMonth = day.date() === 1;
                  const showDateText =
                    isDateInDataRange(day) &&
                    isFirstDayOfMonth &&
                    dynamicSquareSize >= 15;

                  let cellColor: string;

                  if (isDateInDataRange(day)) {
                    cellColor = getColorForTask(taskForDay);
                  } else {
                    cellColor = scoreColorConfigs.padding;
                  }

                  return (
                    <G key={dateStr} y={dayOfWeekIdx * totalCellSize}>
                      <Rect
                        width={dynamicSquareSize}
                        height={dynamicSquareSize}
                        fill={cellColor}
                        rx={2}
                        ry={2}
                        onPress={() => {
                          if (isDateInDataRange(day) && onDayPress) {
                            onDayPress(dateStr, taskForDay);
                          }
                        }}
                        disabled={!isDateInDataRange(day) || !onDayPress}
                      />
                      {showDateText && (
                        <SvgText
                          x={dynamicSquareSize / 2}
                          y={dynamicSquareSize / 2}
                          fontSize={12}
                          fill="#333333"
                          alignmentBaseline="middle"
                          textAnchor="middle"
                          pointerEvents="none">
                          {day.format('DD')}
                        </SvgText>
                      )}
                    </G>
                  );
                })}
              </G>
            ))}
          </G>
        </Svg>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'flex-start',
    paddingHorizontal: 20,
  },
});

export default HabitHeatmap;
