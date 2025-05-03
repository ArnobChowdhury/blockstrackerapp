import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, Button } from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack'; // Import props type
import type { RootTabParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootTabParamList, 'Today'>;

const TodayScreen = ({ navigation }: Props) => {
  return (
    <View style={styles.container}>
      <Text variant="headlineMedium">Today Screen</Text>
      <Text variant="bodyLarge">Displays tasks scheduled for today.</Text>
      <Button
        mode="contained"
        onPress={() => navigation.navigate('ActiveStack')}
        style={styles.button}>
        Go to Active Tasks
      </Button>
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

export default TodayScreen;
