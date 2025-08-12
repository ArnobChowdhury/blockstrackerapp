import React, { useState, useLayoutEffect } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { TextInput, Button, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'SignInOrSignup'>;

const SignInOrSignupScreen = ({ navigation, route }: Props) => {
  const { signUp } = route.params;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] =
    useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: signUp ? 'Create Account' : 'Sign In',
    });
  }, [navigation, signUp]);

  const handleSubmit = () => {
    setIsSubmitting(true);

    if (!email || !password) {
      Alert.alert('Missing Information', 'Email and password are required.');
      setIsSubmitting(false);
      return;
    }

    if (signUp && password !== confirmPassword) {
      Alert.alert(
        'Password Mismatch',
        "The passwords you entered don't match.",
      );
      setIsSubmitting(false);
      return;
    }

    // --- 🚀 SEND to your custom JWT backend ---
    // const endpoint = signUp ? '/api/auth/register' : '/api/auth/login';
    // const body = { email, password };
    // ... fetch logic ...
    // -----------------------------------------

    console.log({
      type: signUp ? 'Sign Up' : 'Sign In',
      email,
    });
    Alert.alert(
      'Success',
      `Form submitted for ${signUp ? 'Sign Up' : 'Sign In'}`,
    );
    setIsSubmitting(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <View style={styles.content}>
        <Text variant="headlineMedium" style={styles.title}>
          {signUp ? 'Create an Account' : 'Welcome Back'}
        </Text>
        <TextInput
          label="Email"
          value={email}
          onChangeText={setEmail}
          style={styles.input}
          keyboardType="email-address"
          autoCapitalize="none"
          disabled={isSubmitting}
        />
        <TextInput
          label="Password"
          value={password}
          onChangeText={setPassword}
          style={styles.input}
          secureTextEntry={!isPasswordVisible}
          disabled={isSubmitting}
          right={
            <TextInput.Icon
              icon={isPasswordVisible ? 'eye-off' : 'eye'}
              onPress={() => setIsPasswordVisible(prev => !prev)}
            />
          }
        />
        {signUp && (
          <TextInput
            label="Confirm Password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            style={styles.input}
            secureTextEntry={!isConfirmPasswordVisible}
            disabled={isSubmitting}
            right={
              <TextInput.Icon
                icon={isConfirmPasswordVisible ? 'eye-off' : 'eye'}
                onPress={() => setIsConfirmPasswordVisible(prev => !prev)}
              />
            }
          />
        )}
        <Button
          mode="contained"
          onPress={handleSubmit}
          loading={isSubmitting}
          disabled={isSubmitting || !email || !password}
          style={styles.button}>
          {signUp ? 'Create Account' : 'Sign In'}
        </Button>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  title: {
    textAlign: 'center',
    marginBottom: 24,
  },
  input: {
    marginBottom: 16,
  },
  button: {
    marginTop: 16,
    paddingVertical: 8,
  },
});

export default SignInOrSignupScreen;
