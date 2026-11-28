import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/** Small key-value store: the device keychain on Android/iOS, localStorage on the web build. */
export const storage = {
  async get(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      try {
        return window.localStorage.getItem(key);
      } catch {
        return null;
      }
    }
    return SecureStore.getItemAsync(key);
  },
  async set(key: string, value: string) {
    if (Platform.OS === 'web') {
      try {
        window.localStorage.setItem(key, value);
      } catch {
        /* private mode: stays signed in for this tab only */
      }
      return;
    }
    await SecureStore.setItemAsync(key, value);
  },
  async remove(key: string) {
    if (Platform.OS === 'web') {
      try {
        window.localStorage.removeItem(key);
      } catch {
        /* ignore */
      }
      return;
    }
    await SecureStore.deleteItemAsync(key);
  },
};
