import axios from 'axios';
import * as Keychain from 'react-native-keychain';
import { API_BASE_URL } from '../config/apiRoutes';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

apiClient.interceptors.request.use(
  async config => {
    try {
      const credentials = await Keychain.getGenericPassword();
      if (credentials) {
        config.headers.Authorization = `Bearer ${credentials.password}`;
        console.log('[APIClient] Auth token added to request headers.');
      }
    } catch (error) {
      console.error(
        '[APIClient] Error retrieving auth token from Keychain:',
        error,
      );
    }
    return config;
  },
  error => Promise.reject(error),
);

export default apiClient;
