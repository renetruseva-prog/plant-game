import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage } from 'zustand/middleware';

/**
 * Zustand's persist storage over AsyncStorage, with a one-time way in for
 * data saved by the app before it used stores.
 *
 * The old code kept its data under different keys in its own shape. When a
 * store's own key is empty, this reads `legacyKey` instead and wraps it in
 * the envelope persist expects, so a player's saved run and gallery survive
 * the change. Once the store writes under its own key that one wins, and the
 * legacy key is never read again.
 */
export function createStorage(legacyKey: string, wrapLegacy: (legacy: unknown) => unknown, version: number) {
  return createJSONStorage(() => ({
    getItem: async (name) => {
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
    setItem: (name, value) => AsyncStorage.setItem(name, value),
    removeItem: (name) => AsyncStorage.removeItem(name),
  }));
}
