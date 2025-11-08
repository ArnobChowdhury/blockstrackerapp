import React, { useState, useMemo, useLayoutEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from 'react-native-paper';
import Svg, { Rect, G, Text as SvgText } from 'react-native-svg';
import dayjs from 'dayjs';
import {
  Task,
  TaskCompletionStatusEnum,
  RepetitiveTaskTemplate,
  DaysInAWeek,
  TaskScheduleTypeEnum,
} from '../../types';
import { scoreColorConfigs } from '../constants';

interface HabitHeatmapProps {
  repetitiveTaskTemplate?: RepetitiveTaskTemplate;
  tasks: Task[];
  endDate?: Date | string;
  squareSize?: number;
  numDays?: number;
  onDayPress?: (date: string, task: Task | undefined) => void;
  showMonthLabels?: boolean;
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
    return scoreColorConfigs.score5;
  }

  if (task.completionStatus === TaskCompletionStatusEnum.COMPLETE) {
    const score = task.shouldBeScored ? (task as any).score ?? 0 : 0;
    switch (score) {
      case 1:
        return scoreColorConfigs.score1;
      case 2:
        return scoreColorConfigs.score2;
      case 3:
        return scoreColorConfigs.score3;
      case 4:
        return scoreColorConfigs.score4;
      case 5:
        return scoreColorConfigs.score5;
      default:
        return scoreColorConfigs.noActivity;
    }
  }
  return scoreColorConfigs.noActivity;
};

const WEEK_DAY_CONFIG = [
  { label: 'Sun', key: DaysInAWeek.Sunday },
  { label: 'Mon', key: DaysInAWeek.Monday },
  { label: 'Tue', key: DaysInAWeek.Tuesday },
  { label: 'Wed', key: DaysInAWeek.Wednesday },
  { label: 'Thu', key: DaysInAWeek.Thursday },
  { label: 'Fri', key: DaysInAWeek.Friday },
  { label: 'Sat', key: DaysInAWeek.Saturday },
];

const HabitHeatmap: React.FC<HabitHeatmapProps> = ({
  repetitiveTaskTemplate,
  tasks,
  endDate: propEndDate = dayjs().toDate(),
  squareSize = DEFAULT_SQUARE_SIZE, // todo no need for this prop
  onDayPress,
  numDays = NUM_DAYS_TO_DISPLAY,
  showMonthLabels = false,
}) => {
  const [viewWidth, setViewWidth] = useState<number | null>(null);
  const [dynamicSquareSize, setDynamicSquareSize] =
    useState<number>(squareSize);

  const theme = useTheme();

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
  const dayLabelOffset = repetitiveTaskTemplate ? DAY_LABEL_WIDTH : 0;
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

      const currentDayLabelOffset = repetitiveTaskTemplate
        ? DAY_LABEL_WIDTH
        : 0;

      const widthForSquaresAndTheirMargins =
        availableWidthForSvgContent - currentDayLabelOffset;

      let newSquareSize =
        (widthForSquaresAndTheirMargins + DEFAULT_SQUARE_MARGIN) /
          numWeeksToRender -
        DEFAULT_SQUARE_MARGIN;

      newSquareSize = Math.max(newSquareSize, 2);

      setDynamicSquareSize(newSquareSize);
    }
  }, [numWeeksToRender, repetitiveTaskTemplate, viewWidth]);

  console.log('repetitiveTaskTemplate', repetitiveTaskTemplate);

  return (
    <View
      style={styles.container}
      onLayout={e => setViewWidth(e.nativeEvent.layout.width)}>
      {viewWidth && (
        <>
          <Svg height={heatmapHeight} width={heatmapWidth}>
            <G>
              {showMonthLabels &&
                monthLabels.map((label, index) => (
                  <SvgText
                    key={`month-${index}-${label.text}`}
                    x={label.x}
                    y={MONTH_LABEL_HEIGHT - 6}
                    fontSize={10}
                    fontFamily="HankenGrotesk-Medium"
                    fill="#888888"
                    textAnchor="start">
                    {label.text}
                  </SvgText>
                ))}

              {repetitiveTaskTemplate &&
                WEEK_DAY_CONFIG.map((dayConfig, index) => {
                  return (
                    <SvgText
                      key={`day-label-${index}`}
                      x={DAY_LABEL_WIDTH - 10}
                      y={
                        monthLabelOffset +
                        index * totalCellSize +
                        squareSize / 2 +
                        4
                      }
                      fontSize={9}
                      fontFamily="HankenGrotesk-Medium"
                      fill={
                        repetitiveTaskTemplate.schedule ===
                          TaskScheduleTypeEnum.SpecificDaysInAWeek &&
                        repetitiveTaskTemplate[dayConfig.key]
                          ? theme.colors.primary
                          : '#888888'
                      }
                      textAnchor="end">
                      {dayConfig.label}
                    </SvgText>
                  );
                })}

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
          {repetitiveTaskTemplate && (
            <View style={styles.legendWrapper}>
              <View style={styles.legendContainer}>
                <View
                  style={[
                    styles.legendBox,
                    { backgroundColor: scoreColorConfigs.failed },
                  ]}
                />
                {repetitiveTaskTemplate.shouldBeScored && (
                  <>
                    <View
                      style={[
                        styles.legendBox,
                        { backgroundColor: scoreColorConfigs.score1 },
                      ]}
                    />
                    <View
                      style={[
                        styles.legendBox,
                        { backgroundColor: scoreColorConfigs.score2 },
                      ]}
                    />
                    <View
                      style={[
                        styles.legendBox,
                        { backgroundColor: scoreColorConfigs.score3 },
                      ]}
                    />
                    <View
                      style={[
                        styles.legendBox,
                        { backgroundColor: scoreColorConfigs.score4 },
                      ]}
                    />
                  </>
                )}
                <View
                  style={[
                    styles.legendBox,
                    { backgroundColor: scoreColorConfigs.score5 },
                  ]}
                />
              </View>
            </View>
          )}
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'flex-start',
    paddingHorizontal: 20,
  },
  legendWrapper: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    width: '100%',
    paddingTop: 40,
  },
  legendContainer: {
    flexDirection: 'row',
  },
  legendBox: {
    height: 20,
    width: 20,
    margin: 2,
    borderRadius: 2,
  },
});

export default HabitHeatmap;
