import { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet,
  SectionList,
  FlatList,
  View,
  useWindowDimensions,
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
import { RepetitiveTaskTemplate } from '../types';
import { RepetitiveTaskTemplateRepository } from '../services/database/repository';
import RenderHtml from 'react-native-render-html';
import truncate from 'html-truncate';

type Props = NativeStackScreenProps<TrackerStackParamList, 'HabitsList'>;

export interface HabitsSection {
  title: 'Daily' | 'Specific Days in a Week';
  data: RepetitiveTaskTemplate[];
}

const HabitsScreen = ({ navigation }: Props) => {
  const { db, isLoading: isDbLoading, error: dbError } = useDatabase();
  const [
    repetitiveTaskTemplateRepository,
    setRepetitiveTaskTemplateRepository,
  ] = useState<RepetitiveTaskTemplateRepository | null>(null);

  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const [errorLoadingTasks, setErrorLoadingTasks] = useState<string | null>(
    null,
  );

  const [habitSections, setHabitSections] = useState<HabitsSection[]>([]);

  useEffect(() => {
    if (db && !dbError && !isDbLoading) {
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
        fetchHabits();
      } else {
        console.log('[Habits] Screen focused, but repository not ready yet.');
      }
    }, [fetchHabits, repetitiveTaskTemplateRepository]),
  );

  const theme = useTheme();

  const { width } = useWindowDimensions();
  const renderHabitCard = useCallback(
    ({ item }: { item: RepetitiveTaskTemplate }) => {
      const source = {
        html: item.description ? truncate(item.description, 60) : '',
      };
      const baseStyles = {
        fontSize: 16,
        color: theme.colors.onSurface,
        fontFamily: 'HankenGrotesk-Regular',
      };

      return (
        <Card
          style={styles.card}
          onPress={() => {
            console.log('[Habits] Navigating to Tracker screen...');
            navigation.navigate('Tracker', { habit: item });
          }}>
          <Card.Title title={<Text variant="titleMedium">{item.title}</Text>} />
          <Card.Content>
            <View style={styles.cardContentWrapper}>
              <RenderHtml
                baseStyle={baseStyles}
                contentWidth={width}
                source={source}
                systemFonts={['HankenGrotesk-Regular', 'sans-serif']}
                ignoredDomTags={['br']}
              />
            </View>
          </Card.Content>
        </Card>
      );
    },
    [navigation, theme.colors.onSurface, width],
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
          renderItem={() => null} // Prevent SectionList from rendering each item
          renderSectionFooter={({ section }) => (
            <FlatList
              data={section.data}
              renderItem={renderHabitCard}
              keyExtractor={item => `${item.id}`}
              numColumns={2}
              scrollEnabled={false}
              contentContainerStyle={styles.innerListContentContainer}
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
  innerListContentContainer: {
    // If you need specific padding for the items within the grid, add it here
    // paddingBottom: 8,
    // overflow: 'hidden',
  },
  sectionTitle: {
    textAlign: 'center',
    marginVertical: 16,
    fontSize: 20,
  },
  card: {
    flex: 1,
    margin: 8,
  },
  cardContentWrapper: {
    paddingBottom: 10,
    height: 100,
    overflow: 'hidden',
  },
});

export default HabitsScreen;
