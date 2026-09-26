import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage } from 'zustand/middleware';

/**
 * Zustand's persist storage over AsyncStorage, with a one-time way in for
 * data saved by the app before it used stores.
 *
 * Expo renders the web build once in Node ("static" output), where there is
 * no `window` and AsyncStorage's web backend throws on any read or write. In
 * that pass the storage is a no-op; the real one takes over on the client.
 */
const isServerRender = typeof window === 'undefined';

export function createStorage(legacyKey: string, wrapLegacy: (legacy: unknown) => unknown, version: number) {
  return createJSONStorage(() => ({
    getItem: async (name) => {
      if (isServerRender) return null;
      const own = await AsyncStorage.getItem(name);
      if (own !== null) return own;
      const legacy = await AsyncStorage.getItem(legacyKey);
      if (legacy === null) return null;
      try {
        return JSON.stringify({ state: wrapLegacy(JSON.parse(legacy)), version });
      } catch {
        return null;
      }
    },
    setItem: async (name, value) => {
      if (!isServerRender) await AsyncStorage.setItem(name, value);
    },
    removeItem: async (name) => {
      if (!isServerRender) await AsyncStorage.removeItem(name);
    },
  }));
}
