// src/screens/ActiveCategoryListScreen.tsx
import React from 'react';
import {StyleSheet} from 'react-native';
import {List, Divider} from 'react-native-paper';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {SafeAreaView} from 'react-native-safe-area-context';
import type {ActiveStackParamList} from '../navigation/RootNavigator'; // Import stack param list
import {TaskScheduleTypeEnum} from '../types'; // Import category types

type Props = NativeStackScreenProps<ActiveStackParamList, 'ActiveCategoryList'>;

const categoriesToDisplay: TaskScheduleTypeEnum[] = [
  TaskScheduleTypeEnum.Unscheduled,
  TaskScheduleTypeEnum.Once,
  TaskScheduleTypeEnum.Daily,
  TaskScheduleTypeEnum.SpecificDaysInAWeek,
];

const ActiveCategoryListScreen = ({navigation}: Props) => {
  const handleCategoryPress = (category: TaskScheduleTypeEnum) => {
    console.log(`[CategoryList] Navigating to tasks for: ${category}`);
    navigation.navigate('ActiveTaskList', {category});
  };

  return (
    <SafeAreaView>
      <List.Section>
        {categoriesToDisplay.map((categoryKey, index) => (
          <React.Fragment key={categoryKey}>
            <List.Item
              title={categoryKey}
              right={props => <List.Icon {...props} icon="chevron-right" />}
              onPress={() => handleCategoryPress(categoryKey)}
              style={styles.listItem}
            />
            {index < categoriesToDisplay.length - 1 && <Divider />}
          </React.Fragment>
        ))}
      </List.Section>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  listItem: {
    paddingHorizontal: 20,
  },
});

export default ActiveCategoryListScreen;
