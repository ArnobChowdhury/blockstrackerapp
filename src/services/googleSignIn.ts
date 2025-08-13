import { GoogleSignin } from '@react-native-google-signin/google-signin';

export const configureGoogleSignIn = () => {
  GoogleSignin.configure({
    webClientId:
      '513711750326-uppblult7i4m91tq66at4g30tfcin4ck.apps.googleusercontent.com',
    offlineAccess: true,
  });
};
