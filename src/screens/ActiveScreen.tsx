import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootTabParamList} from '../navigation/RootNavigator'; // Adjust path if needed

// Define props type for the screen, including navigation
type Props = NativeStackScreenProps<RootTabParamList, 'Active'>;

// const ActiveScreen = ({navigation}: Props) => {
const ActiveScreen = ({}: Props) => {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Active Tasks Screen</Text>
      <Text>Displays all active (non-completed) tasks.</Text>
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
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
});

export default ActiveScreen;
