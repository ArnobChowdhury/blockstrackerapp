import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Button, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Auth'>;

const AuthScreen = ({ navigation: _navigation }: Props) => {
  const theme = useTheme();

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <View style={styles.content}>
        <Text variant="headlineMedium" style={styles.title}>
          Create an Account
        </Text>
        <Text
          variant="bodyLarge"
          style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
          Creating an account is optional and is mainly for enabling premium
          features like data sync across devices. By default, all your data is
          stored locally on this device.
        </Text>
        <Button
          icon="email"
          mode="outlined"
          onPress={() => console.log('Sign in with email pressed')}
          style={styles.button}>
          Sign in or Sign up with email
        </Button>
        <Button
          icon="google"
          mode="contained"
          onPress={() => console.log('Continue with Google pressed')}
          style={[styles.button]}
          labelStyle={styles.containedButton}>
          Continue with Google
        </Button>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 20,
  },
  title: { textAlign: 'center', marginBottom: 8 },
  subtitle: { textAlign: 'center', marginBottom: 32 },
  button: { marginVertical: 8 },
  containedButton: { color: 'white' },
});

export default AuthScreen;
