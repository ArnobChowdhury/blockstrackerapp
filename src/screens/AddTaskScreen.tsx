import React from 'react';
import {StyleSheet, View} from 'react-native';
import {Text} from 'react-native-paper';
import type {NativeStackScreenProps} from '@react-navigation/native-stack'; // Import props type
import type {RootTabParamList} from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootTabParamList, 'AddTask'>;

const AddTaskScreen = ({}: Props) => {
  return (
    <View style={styles.container}>
      <Text variant="headlineMedium">Add Task Screen</Text>
      <Text variant="bodyLarge">Displays form to add a new task.</Text>
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
  text: {
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    marginBottom: 20,
    textAlign: 'center',
  },
  button: {
    marginTop: 10,
  },
});

export default AddTaskScreen;
