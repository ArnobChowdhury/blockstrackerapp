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

apiClient.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config;
    console.log('[APIClient] Error response:', error.response);
    if (error.response.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const accessTokenCredentials = await Keychain.getGenericPassword();
        const refreshTokenCredentials = await Keychain.getGenericPassword({
          service: 'refreshToken',
        });
        console.log('accessTokenCredentials', accessTokenCredentials);
        console.log('refreshTokenCredentials', refreshTokenCredentials);

        if (!accessTokenCredentials || !refreshTokenCredentials) {
          console.log('No credentials found');
          return Promise.reject(error);
        }

        const accessToken = accessTokenCredentials.password;
        const refreshToken = refreshTokenCredentials.password;
        const response = await axios.post(
          `${API_BASE_URL}/api/v1/auth/refresh`,
          {
            accessToken,
            refreshToken,
          },
        );

        const newAccessToken = response.data.accessToken;
        const newRefreshToken = response.data.refreshToken;

        await Keychain.setGenericPassword(newAccessToken, 'user');
        await Keychain.setGenericPassword(newRefreshToken, 'refreshToken');

        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  },
);

export default apiClient;
