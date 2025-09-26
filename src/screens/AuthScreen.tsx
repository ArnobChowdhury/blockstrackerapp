import React, { useState, useMemo } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { Text, Button, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import {
  GoogleSignin,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { useAppContext } from '../shared/contexts/useAppContext';
import { API_URL } from '@env';
import { jwtDecode } from 'jwt-decode';
import { UserService } from '../services/UserService';

type Props = NativeStackScreenProps<RootStackParamList, 'Auth'>;

const AuthScreen = ({ navigation }: Props) => {
  const theme = useTheme();
  const { signIn } = useAppContext();
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const userService = useMemo(() => new UserService(), []);

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    try {
      await GoogleSignin.hasPlayServices({
        showPlayServicesUpdateDialog: true,
      });
      const { type, data } = await GoogleSignin.signIn();

      console.log('[AuthScreen] Google Sign-In result:', type, data);
      if (type === 'cancelled') {
        throw new Error('User canceled Google Sign-In.');
      }

      const { idToken } = data;

      if (!idToken) {
        throw new Error('Google Sign-In failed: No ID token received.');
      }

      const response = await fetch(`${API_URL}/api/v1/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: idToken }),
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(
          responseData.result?.message || 'Failed to sign in with Google.',
        );
      }

      const { accessToken, refreshToken } = responseData.result.data;
      try {
        const decoded = jwtDecode<{ email: string; user_id: string }>(
          accessToken,
        );

        if (!decoded.user_id || !decoded.email) {
          throw new Error('Invalid token received from server.');
        }

        await userService.saveUserLocally({
          id: decoded.user_id,
          email: decoded.email,
        });

        await signIn(accessToken, refreshToken);
      } catch (localError: any) {
        console.error(
          'Failed to process token or save user locally:',
          localError,
        );
        throw new Error(
          'Failed to set up your account locally. Please try again.',
        );
      }
    } catch (error: any) {
      console.log('error', error);
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        console.log('User cancelled the login flow');
      } else if (error.code === statusCodes.IN_PROGRESS) {
        console.log('Sign in is in progress already');
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        Alert.alert(
          'Sign-In Error',
          'Google Play Services not available or outdated.',
        );
      } else {
        Alert.alert('Sign-In Error', error.message);
        console.error('Google Sign-In Error:', error);
      }
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <View style={styles.content}>
        <Text variant="headlineMedium" style={styles.title}>
          Sign In or Sign Up
        </Text>
        <Text
          variant="bodyLarge"
          style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
          Having an account is optional and is mainly for enabling premium
          features like data sync. By default, all your data is stored locally
          on this device.
        </Text>

        <Button
          icon="email"
          mode="outlined"
          onPress={() =>
            navigation.navigate('SignInOrSignup', { signUp: false })
          }
          style={styles.button}>
          Sign In with Email
        </Button>

        <Button
          icon="account-plus"
          mode="outlined"
          onPress={() =>
            navigation.navigate('SignInOrSignup', { signUp: true })
          }
          style={styles.button}>
          Sign Up with Email
        </Button>

        <View style={styles.dividerContainer}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        <Button
          icon="google"
          mode="contained"
          onPress={handleGoogleSignIn}
          style={[styles.button]}
          labelStyle={styles.buttonLabel}
          loading={isGoogleLoading}>
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
  buttonLabel: { color: '#fff' },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#ccc',
  },
  dividerText: {
    marginHorizontal: 10,
    color: '#888',
  },
});

export default AuthScreen;
