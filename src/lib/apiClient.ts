import axios from 'axios';
import * as Keychain from 'react-native-keychain';
import { API_BASE_URL } from '../config/apiRoutes';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

let onAuthFailure: () => void;
let onTokenRefreshed: (
  newAccessToken: string,
  newRefreshToken: string,
) => Promise<void>;

export const registerAuthFailureHandler = (handler: () => void) => {
  onAuthFailure = handler;
};

export const registerTokenRefreshHandler = (
  handler: (newAccessToken: string, newRefreshToken: string) => Promise<void>,
) => {
  onTokenRefreshed = handler;
};

let inMemoryToken: string | null = null;

export const setInMemoryToken = (token: string | null) => {
  inMemoryToken = token;
  console.log('[APIClient] In-memory token updated.');
};

apiClient.interceptors.request.use(
  config => {
    if (inMemoryToken) {
      config.headers.Authorization = `Bearer ${inMemoryToken}`;
    } else {
      console.log(
        '[APIClient] No in-memory token, request will be unauthenticated.',
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
          console.log('[APIClient] No refresh token found. Signing out.');
          onAuthFailure?.();
          return Promise.reject(error);
        }

        const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          accessToken: accessTokenCredentials.password,
          refreshToken: refreshTokenCredentials.password,
        });

        const newAccessToken = response.data.result.data.accessToken;
        const newRefreshToken = response.data.result.data.refreshToken;

        await onTokenRefreshed?.(newAccessToken, newRefreshToken);

        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        console.error(
          '[APIClient] Token refresh failed. Signing out.',
          refreshError,
        );
        onAuthFailure?.();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  },
);

export default apiClient;
