import { GoogleSignin } from '@react-native-google-signin/google-signin';

export const configureGoogleSignIn = () => {
  GoogleSignin.configure({
    webClientId:
      '513711750326-cim84g85urtac13qhu2mrt8sg6c10tkl.apps.googleusercontent.com',
    offlineAccess: true,
  });
};
