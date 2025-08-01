import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  StyleSheet,
  SectionList,
  FlatList,
  View,
  Dimensions,
} from 'react-native';
import {
  Text,
  Card,
  ActivityIndicator,
  IconButton,
  useTheme,
} from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { TrackerStackParamList } from '../navigation/RootNavigator';
import { useDatabase } from '../shared/hooks';
import { RepetitiveTaskTemplate, Task } from '../types';
import {
  RepetitiveTaskTemplateRepository,
  TaskRepository,
} from '../services/database/repository';
import HabitHeatmap from '../shared/components/HabitHeatmap';
import { useAppContext } from '../shared/contexts/useAppContext';

const screenWidth = Dimensions.get('window').width;
const numColumns = 2;
const cardMarginVal = 8;
const listPaddingHorizontalVal = 8;

const flatListAvailableContentWidth =
  screenWidth - listPaddingHorizontalVal * 2;

const calculatedCardWidth =
  flatListAvailableContentWidth / numColumns - cardMarginVal * 2;

type Props = NativeStackScreenProps<TrackerStackParamList, 'HabitsList'>;

export interface HabitsSection {
  title: 'Daily' | 'Specific Days in a Week';
  data: RepetitiveTaskTemplate[];
}

interface HabitCardItemProps {
  habit: RepetitiveTaskTemplate;
  isViewable: boolean;
  taskRepository: TaskRepository | null;
  onPress: () => void;
  activityBgColor?: string;
}

const HabitCardItem: React.FC<HabitCardItemProps> = React.memo(
  ({ habit, isViewable, taskRepository, onPress, activityBgColor }) => {
    const FETCH_TASKS_LIMIT = 50;
    const [heatmapTasks, setHeatmapTasks] = useState<Task[]>([]);
    const [isLoadingHeatmap, setIsLoadingHeatmap] = useState(false);
    const [hasFetched, setHasFetched] = useState(false);

    useEffect(() => {
      if (isViewable && taskRepository && !hasFetched && !isLoadingHeatmap) {
        const fetchHeatmapData = async () => {
          console.log(`[HabitCardItem-${habit.id}] Fetching heatmap data...`);
          setIsLoadingHeatmap(true);
          try {
            const fetched =
              await taskRepository.getActiveTasksByRepetitiveTaskTemplateId(
                habit.id,
                FETCH_TASKS_LIMIT,
              );
            setHeatmapTasks(fetched);
            setHasFetched(true);
          } catch (e: any) {
            // todo: we can think of error handling and showing it to the user
            console.error(
              `[HabitCardItem-${habit.id}] Error fetching heatmap data:`,
              e,
            );
          } finally {
            setIsLoadingHeatmap(false);
          }
        };
        fetchHeatmapData();
      }
    }, [isViewable, habit.id, taskRepository, hasFetched, isLoadingHeatmap]);

    return (
      <Card style={[styles.card]} onPress={onPress}>
        <Card.Title title={<Text variant="titleMedium">{habit.title}</Text>} />
        <Card.Content
          style={[
            styles.cardContent,
            activityBgColor ? { backgroundColor: activityBgColor } : null,
          ]}>
          {isLoadingHeatmap && (
            <ActivityIndicator size="small" style={styles.heatmapLoader} />
          )}
          {!isLoadingHeatmap && hasFetched && heatmapTasks.length > 0 && (
            <HabitHeatmap tasks={heatmapTasks} numDays={FETCH_TASKS_LIMIT} />
          )}
          {!isLoadingHeatmap && hasFetched && heatmapTasks.length === 0 && (
            <Text style={styles.noActivityText}>No recent activity</Text>
          )}
        </Card.Content>
      </Card>
    );
  },
);

const HabitsScreen = ({ navigation }: Props) => {
  const { db, isLoading: isDbLoading, error: dbError } = useDatabase();
  const [
    repetitiveTaskTemplateRepository,
    setRepetitiveTaskTemplateRepository,
  ] = useState<RepetitiveTaskTemplateRepository | null>(null);

  const { isDarkMode } = useAppContext();
  const theme = useTheme();

  const [taskRepository, setTaskRepository] = useState<TaskRepository | null>(
    null,
  );
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const [errorLoadingTasks, setErrorLoadingTasks] = useState<string | null>(
    null,
  );

  const [habitSections, setHabitSections] = useState<HabitsSection[]>([]);

  useEffect(() => {
    if (db && !dbError && !isDbLoading) {
      setTaskRepository(new TaskRepository(db));
      setRepetitiveTaskTemplateRepository(
        new RepetitiveTaskTemplateRepository(db),
      );
    } else {
      setRepetitiveTaskTemplateRepository(null);
    }
  }, [db, dbError, isDbLoading]);

  const fetchHabits = useCallback(async () => {
    if (!repetitiveTaskTemplateRepository) {
      console.log('[Habits] fetchTasks called, but repository not ready.');
      return;
    }

    console.log('[Habits] Fetching tasks...');

    setErrorLoadingTasks(null);

    try {
      const dailies =
        await repetitiveTaskTemplateRepository.getAllActiveDailyRepetitiveTaskTemplates();
      const weeklies =
        await repetitiveTaskTemplateRepository.getAllActiveSpecificDaysInAWeekRepetitiveTaskTemplates();

      console.log('[Habits] Fetched daily tasks count:', dailies.length);
      console.log(
        '[Habits] Fetched specific days in a week tasks count:',
        weeklies.length,
      );
      const hbtSections: HabitsSection[] = [
        {
          title: 'Daily',
          data: dailies,
        },
        {
          title: 'Specific Days in a Week',
          data: weeklies,
        },
      ];
      setHabitSections(hbtSections);
    } catch (error: any) {
      console.error('[Habits] Failed to fetch tasks:', error);
      setErrorLoadingTasks(
        error.message || 'An unknown error occurred while fetching tasks.',
      );
      setHabitSections([]);
    } finally {
      setIsLoadingTasks(false);
    }
  }, [repetitiveTaskTemplateRepository]);

  useFocusEffect(
    useCallback(() => {
      console.log('[Habits] Screen focused.');
      if (repetitiveTaskTemplateRepository) {
        setHabitSections([]);
        fetchHabits();
      } else {
        console.log('[Habits] Screen focused, but repository not ready yet.');
      }
    }, [fetchHabits, repetitiveTaskTemplateRepository]),
  );

  const [viewableItems, setViewableItems] = useState<number[]>([]);
  const viewabilityConfig = {
    itemVisiblePercentThreshold: 50,
  };
  const viewabilityConfigRef = useRef(viewabilityConfig);

  const renderHabitCard = useCallback(
    ({ item }: { item: RepetitiveTaskTemplate }) => {
      const isViewable = viewableItems.includes(item.id);
      return (
        <HabitCardItem
          activityBgColor={
            isDarkMode ? undefined : theme.colors.onPrimaryContainer
          }
          habit={item}
          isViewable={isViewable}
          taskRepository={taskRepository}
          onPress={() => {
            console.log('[Habits] Navigating to Tracker screen...');
            navigation.navigate('Tracker', { habit: item });
          }}
        />
      );
    },
    [
      viewableItems,
      isDarkMode,
      theme.colors.onPrimaryContainer,
      taskRepository,
      navigation,
    ],
  );

  if (isDbLoading) {
    return (
      <SafeAreaView
        style={styles.centered}
        edges={['top', 'bottom', 'left', 'right']}>
        <ActivityIndicator size="large" />
        <Text style={styles.infoText}>Connecting to Database...</Text>
      </SafeAreaView>
    );
  }
  if (dbError) {
    return (
      <SafeAreaView
        style={styles.centered}
        edges={['top', 'bottom', 'left', 'right']}>
        <Text style={styles.errorText}>Database Connection Error</Text>
        <Text style={styles.errorText}>{dbError.message}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={['top', 'bottom', 'left', 'right']}>
      {isLoadingTasks ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" />
          <Text style={styles.infoText}>Loading Today's Tasks...</Text>
        </View>
      ) : errorLoadingTasks ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>Failed to Load Tasks</Text>
          <Text style={styles.errorText}>{errorLoadingTasks}</Text>
          <IconButton icon="refresh" size={30} onPress={fetchHabits} />
        </View>
      ) : (
        <SectionList
          sections={habitSections}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          renderSectionHeader={({ section: { title } }) => (
            <Text variant="headlineMedium" style={styles.sectionTitle}>
              {title}
            </Text>
          )}
          renderItem={() => null}
          renderSectionFooter={({ section }) => (
            <FlatList
              data={section.data}
              renderItem={renderHabitCard}
              keyExtractor={item => `${item.id}`}
              numColumns={2}
              scrollEnabled={false}
              viewabilityConfig={viewabilityConfigRef.current}
              onViewableItemsChanged={({
                viewableItems: currentlyViewable,
              }) => {
                const newViewableIds = currentlyViewable.map(
                  item => item.item.id,
                );
                setViewableItems(newViewableIds);
              }}
              ListEmptyComponent={() => (
                <View style={styles.centered}>
                  <Text style={styles.infoText}>
                    Add repetitive tasks to start tracking
                  </Text>
                </View>
              )}
            />
          )}
          contentContainerStyle={styles.listContentContainer}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  errorText: {
    color: 'red',
    textAlign: 'center',
    marginBottom: 5,
    fontSize: 16,
    fontWeight: 'bold',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  infoText: {
    marginTop: 10,
    fontSize: 16,
    color: 'grey',
  },
  listContentContainer: {
    paddingHorizontal: 8,
  },
  sectionTitle: {
    textAlign: 'center',
    marginVertical: 16,
    fontSize: 20,
  },
  card: {
    width: calculatedCardWidth,
    margin: cardMarginVal,
  },
  cardContent: {
    margin: 8,
    padding: 8,
    height: 100,
  },
  heatmapLoader: {
    marginVertical: 20,
  },
  noActivityText: {
    textAlign: 'center',
    color: 'grey',
    marginVertical: 20,
    fontSize: 12,
  },
  heatmapPlaceholder: {
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
  },
  heatmapPlaceholderText: {
    color: '#a0a0a0',
    fontSize: 12,
  },
});

export default HabitsScreen;
