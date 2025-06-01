import { View, StyleSheet } from 'react-native';
import { Avatar, Icon, TouchableRipple } from 'react-native-paper';

export const scoreColors = [
  '#c0e8c2',
  '#7be187',
  '#24c241',
  '#019927',
  '#006620',
];

interface TaskScoringProps {
  selected?: number;
  onCirclePress: (index: number) => void;
}

const TaskScoring = ({ selected, onCirclePress }: TaskScoringProps) => {
  return (
    <View style={styles.circleContainer}>
      {scoreColors.map((color, index) => {
        return (
          <TouchableRipple
            key={index}
            style={styles.circle}
            onPress={() => {
              onCirclePress(index);
            }}
            borderless={true}
            rippleColor="rgba(255, 255, 255, .32)">
            <View>
              {index === selected && (
                <Avatar.Icon
                  style={[
                    {
                      backgroundColor: color,
                    },
                    styles.avatar,
                  ]}
                  size={24}
                  icon="check"
                />
              )}
              {index !== selected && (
                <Icon source="circle" size={28} color={color} />
              )}
            </View>
          </TouchableRipple>
        );
      })}
    </View>
  );
};

export default TaskScoring;

const styles = StyleSheet.create({
  circleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  circle: {
    marginRight: 5,
    borderRadius: 100,
  },
  avatar: {
    marginHorizontal: 2,
  },
});
