import React from 'react';
import {View, Text, StyleSheet, Button} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack'; // Import props type
import type {RootTabParamList} from '../navigation/RootNavigator'; // Import param list type

type Props = NativeStackScreenProps<RootTabParamList, 'Today'>;

const TodayScreen = ({navigation}: Props) => {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Today Screen</Text>
      <Text>Displays tasks scheduled for today.</Text>
      <Button
        title="Go to Active Tasks"
        onPress={() => navigation.navigate('Active')}
      />
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

export default TodayScreen;
