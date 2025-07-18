import React, { useCallback, useState, useEffect } from 'react';
import { StyleSheet, ScrollView, View } from 'react-native';
import { SpaceRepository } from '../services/database/repository';
import {
  Text,
  List,
  Divider,
  Snackbar,
  ProgressBar,
  Badge,
  useTheme,
} from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ActiveStackParamList } from '../navigation/RootNavigator';
import { TaskScheduleTypeEnum, Space } from '../types';
import { useDatabase } from '../shared/hooks/useDatabase';
import { useFocusEffect } from '@react-navigation/native';
import {
  TaskRepository,
  RepetitiveTaskTemplateRepository,
} from '../services/database/repository';

type Props = NativeStackScreenProps<ActiveStackParamList, 'ActiveCategoryList'>;

const categoriesToDisplay: TaskScheduleTypeEnum[] = [
  TaskScheduleTypeEnum.Unscheduled,
  TaskScheduleTypeEnum.Once,
  TaskScheduleTypeEnum.Daily,
  TaskScheduleTypeEnum.SpecificDaysInAWeek,
];

const ActiveCategoryListScreen = ({ navigation }: Props) => {
  const theme = useTheme();
  const [spaceRepository, setSpaceRepository] =
    useState<SpaceRepository | null>(null);
  const [allSpaces, setAllSpaces] = useState<Space[]>([]);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  const [isLoadingSpaces, setIsLoadingSpaces] = useState(true);

  const { db, isLoading: isDbLoading, error: dbError } = useDatabase();

  const [taskRepository, setTaskRepository] = useState<TaskRepository | null>(
    null,
  );
  const [
    repetitiveTaskTemplateRepository,
    setRepetitiveTaskTemplateRepository,
  ] = useState<RepetitiveTaskTemplateRepository | null>(null);

  useEffect(() => {
    if (db && !dbError && !isDbLoading) {
      setTaskRepository(new TaskRepository(db));
    } else {
      setTaskRepository(null);
    }
  }, [db, dbError, isDbLoading]);

  useEffect(() => {
    if (db && !dbError && !isDbLoading) {
      setRepetitiveTaskTemplateRepository(
        new RepetitiveTaskTemplateRepository(db),
      );
    } else {
      setRepetitiveTaskTemplateRepository(null);
    }
  }, [db, dbError, isDbLoading]);

  useEffect(() => {
    if (db && !dbError && !isDbLoading) {
      setSpaceRepository(new SpaceRepository(db));
    } else {
      setSpaceRepository(null);
    }
  }, [db, dbError, isDbLoading]);

  const handleCategoryPress = (category: TaskScheduleTypeEnum) => {
    console.log(`[CategoryList] Navigating to tasks for: ${category}`);
    navigation.navigate('ActiveTaskList', { category });
  };

  const handleCategoryPressOfSpace = (
    category: TaskScheduleTypeEnum,
    spaceId: number,
  ) => {
    console.log(
      `[CategoryList] Navigating to tasks for space ${spaceId} for: ${category}`,
    );
    navigation.navigate('ActiveTaskList', { category, spaceId });
  };

  const loadAllSpaces = useCallback(async () => {
    if (!spaceRepository) {
      return;
    }

    setIsLoadingSpaces(true);

    try {
      const spaces = await spaceRepository.getAllSpaces();
      setAllSpaces(spaces);
    } catch (error: any) {
      setSnackbarVisible(true);
      setSnackbarMessage(
        `Failed to load spaces: ${error.message || 'Unknown error'}`,
      );

      console.error('[DB] Failed to fetch spaces:', error);
    } finally {
      setIsLoadingSpaces(false);
    }
  }, [spaceRepository]);

  const [countForCategories, setCountForCategories] =
    useState<Record<TaskScheduleTypeEnum, number>>();

  const getCountForAllCategory = useCallback(async () => {
    if (!taskRepository || !repetitiveTaskTemplateRepository) {
      return;
    }
    const countForNonRepetitiveTasks =
      await taskRepository.countAllActiveTasksByCategory();
    const countForRepetitiveTasks =
      await repetitiveTaskTemplateRepository.countAllActiveRepetitiveTasksByCategory();

    const counts = {
      ...countForNonRepetitiveTasks,
      ...countForRepetitiveTasks,
    };

    setCountForCategories(counts);
  }, [repetitiveTaskTemplateRepository, taskRepository]);

  useFocusEffect(
    useCallback(() => {
      if (spaceRepository) {
        getCountForAllCategory();
        loadAllSpaces();
      }
    }, [spaceRepository, getCountForAllCategory, loadAllSpaces]),
  );

  const onDismissSnackBar = () => {
    setSnackbarVisible(false);
    setSnackbarMessage('');
  };

  const [expandedSpaceId, setExpandedSpaceId] = useState<number | string>();

  const [countForSpace, setCountForSpace] =
    useState<Record<TaskScheduleTypeEnum, number>>();

  const getCountForSpace = useCallback(
    async (spaceId: number) => {
      if (!taskRepository || !repetitiveTaskTemplateRepository) {
        return;
      }
      const countForNonRepetitiveTasks =
        await taskRepository.countActiveTasksBySpaceId(spaceId);
      const countForRepetitiveTasks =
        await repetitiveTaskTemplateRepository.countActiveRepetitiveTasksBySpaceId(
          spaceId,
        );

      const counts = {
        ...countForNonRepetitiveTasks,
        ...countForRepetitiveTasks,
      };

      setCountForSpace(counts);
    },
    [repetitiveTaskTemplateRepository, taskRepository],
  );

  const handleSpaceExpansion = async (expandedId: string | number) => {
    if (expandedId === expandedSpaceId) {
      setExpandedSpaceId(undefined);
      return;
    }
    await getCountForSpace(allSpaces[Number(expandedId) - 1].id);
    setExpandedSpaceId(expandedId);
  };

  return (
    <SafeAreaView edges={['top', 'bottom', 'left', 'right']}>
      <ProgressBar indeterminate visible={isLoadingSpaces} />
      <ScrollView>
        <List.Section title="By schedule">
          {categoriesToDisplay.map((categoryKey, index) => (
            <React.Fragment key={categoryKey}>
              <List.Item
                title={
                  <View>
                    <Text variant="titleMedium">{categoryKey}</Text>
                    <Badge
                      style={[
                        {
                          backgroundColor: theme.colors.primary,
                          color: theme.colors.onPrimaryContainer,
                        },
                        styles.badge,
                      ]}>
                      {countForCategories?.[categoryKey]}
                    </Badge>
                  </View>
                }
                right={props => <List.Icon {...props} icon="chevron-right" />}
                onPress={() => handleCategoryPress(categoryKey)}
                style={styles.listItemLevelOne}
              />
              {index < categoriesToDisplay.length - 1 && <Divider />}
            </React.Fragment>
          ))}
        </List.Section>
        {allSpaces.length > 0 && (
          <List.Section title="By Space">
            <List.AccordionGroup
              expandedId={expandedSpaceId}
              onAccordionPress={handleSpaceExpansion}>
              {allSpaces.map((space, spaceIndex) => (
                <List.Accordion
                  id={spaceIndex + 1}
                  key={space.id}
                  title={<Text variant="titleMedium">{space.name}</Text>}
                  expanded={expandedSpaceId === spaceIndex + 1}
                  style={[
                    styles.listItemLevelOne,
                    expandedSpaceId === spaceIndex + 1 && {
                      backgroundColor: theme.colors.surfaceVariant,
                    },
                  ]}>
                  {categoriesToDisplay.map((categoryKey, index) => (
                    <React.Fragment key={categoryKey}>
                      <List.Item
                        title={
                          <View>
                            <Text variant="titleSmall">{categoryKey}</Text>
                            <Badge
                              style={[
                                {
                                  backgroundColor: theme.colors.primary,
                                  color: theme.colors.onPrimaryContainer,
                                },
                                styles.badge,
                              ]}>
                              {countForSpace?.[categoryKey]}
                            </Badge>
                          </View>
                        }
                        right={props => (
                          <List.Icon {...props} icon="chevron-right" />
                        )}
                        onPress={() =>
                          handleCategoryPressOfSpace(categoryKey, space.id)
                        }
                        style={styles.listItemLevelTwo}
                      />
                      {index < categoriesToDisplay.length - 1 && <Divider />}
                    </React.Fragment>
                  ))}
                </List.Accordion>
              ))}
            </List.AccordionGroup>
          </List.Section>
        )}
      </ScrollView>

      <Snackbar
        visible={snackbarVisible}
        onDismiss={onDismissSnackBar}
        duration={3000}
        onIconPress={onDismissSnackBar}>
        {snackbarMessage}
      </Snackbar>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  badge: {
    marginLeft: 5,
    position: 'absolute',
    top: -2,
    right: -24,
  },
  listItemLevelOne: {
    paddingHorizontal: 20,
  },
  listItemLevelTwo: {
    paddingHorizontal: 40,
  },
});

export default ActiveCategoryListScreen;
