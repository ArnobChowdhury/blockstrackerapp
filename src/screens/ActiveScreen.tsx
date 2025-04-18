import React from 'react';
import {StyleSheet, View} from 'react-native';
import {Text} from 'react-native-paper';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootTabParamList} from '../navigation/RootNavigator'; // Adjust path if needed

type Props = NativeStackScreenProps<RootTabParamList, 'Active'>;

const ActiveScreen = ({}: Props) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title} variant="headlineMedium">
        Active Tasks Screen
      </Text>
      <Text variant="bodyLarge">
        Displays all active (non-completed) tasks.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    marginBottom: 10,
    textAlign: 'center',
  },
});

export default ActiveScreen;
