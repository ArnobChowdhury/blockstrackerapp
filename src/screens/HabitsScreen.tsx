import { View } from 'react-native';
import { Text } from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { RootTabParamList } from '../navigation/RootNavigator';
type Props = NativeStackScreenProps<RootTabParamList, 'Tracker'>;

const HabitsScreen = ({}: Props) => {
  return (
    <SafeAreaView>
      <View>
        <Text variant="titleLarge">Habits Screen</Text>
      </View>
    </SafeAreaView>
  );
};

export default HabitsScreen;
