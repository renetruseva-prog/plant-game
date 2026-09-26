import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage } from 'zustand/middleware';

/**
 * Expo renders the web build once in Node ("static" output), where there is
 * no `window` and AsyncStorage's web backend throws on any read or write. In
 * that pass the storage is a no-op; the real one takes over on the client.
 */
const isServerRender = typeof window === 'undefined';

/** Zustand's persist storage, backed by AsyncStorage. */
export const storage = createJSONStorage(() => ({
  getItem: async (name) => (isServerRender ? null : AsyncStorage.getItem(name)),
  setItem: async (name, value) => {
    if (!isServerRender) await AsyncStorage.setItem(name, value);
  },
  removeItem: async (name) => {
    if (!isServerRender) await AsyncStorage.removeItem(name);
  },
}));
