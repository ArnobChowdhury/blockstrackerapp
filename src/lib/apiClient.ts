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

let isRefreshing = false;
let failedQueue: {
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
}[] = [];

const processQueue = (error: Error | null, token: string | null = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
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

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(token => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return apiClient(originalRequest);
          })
          .catch(err => {
            return Promise.reject(err);
          });
      }

      isRefreshing = true;
      console.log('[APIClient] Received 401. Attempting to refresh token...');

      return new Promise(async (resolve, reject) => {
        try {
          const accessTokenCredentials = await Keychain.getGenericPassword();
          const refreshTokenCredentials = await Keychain.getGenericPassword({
            service: 'refreshToken',
          });

          if (!accessTokenCredentials || !refreshTokenCredentials) {
            throw new Error(
              'No access or refresh token found for refresh attempt.',
            );
          }

          const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            accessToken: accessTokenCredentials.password,
            refreshToken: refreshTokenCredentials.password,
          });

          const { accessToken: newAccessToken, refreshToken: newRefreshToken } =
            response.data.result.data;

          await onTokenRefreshed?.(newAccessToken, newRefreshToken);

          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          processQueue(null, newAccessToken);
          resolve(apiClient(originalRequest));
        } catch (refreshError: any) {
          console.error(
            '[APIClient] Token refresh failed. Triggering auth failure.',
            refreshError,
          );
          processQueue(refreshError, null);
          onAuthFailure?.();
          reject(refreshError);
        } finally {
          isRefreshing = false;
        }
      });
    }

    return Promise.reject(error);
  },
);

export default apiClient;
