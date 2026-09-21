import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useCallback, useRef, useState } from 'react';

import { OUTSIDE } from './config';
import { ANCHOR_KEY } from './state';

type Anchor = { lat: number; lon: number };

/** Metres between two coordinates (equirectangular is plenty at this scale). */
function distanceM(a: Anchor, b: Anchor) {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = (((b.lon - a.lon) * Math.PI) / 180) * Math.cos((a.lat * Math.PI) / 180);
  return Math.sqrt(dLat * dLat + dLon * dLon) * R;
}

export type OutsideResult =
  | { kind: 'moved'; metres: number }
  | { kind: 'anchored' }
  | { kind: 'too-close'; metres: number }
  | { kind: 'checkin' };

/**
 * "Take me outside."
 *
 * Outside is genuinely hard to detect, so this measures distance from wherever
 * the app was first opened. The first tap drops the anchor; a later tap from
 * far enough away is a real trip outdoors. If permission is denied or the fix
 * times out it degrades to an honest check-in, which still counts - the demo
 * must never dead-end on a permission dialog.
 */
export function useOutside() {
  const [busy, setBusy] = useState(false);
  const [granted, setGranted] = useState<boolean | null>(null);
  const anchor = useRef<Anchor | null>(null);

  const check = useCallback(async (): Promise<OutsideResult> => {
    setBusy(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      const ok = status === 'granted';
      setGranted(ok);
      if (!ok) return { kind: 'checkin' };

      const fix = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), OUTSIDE.timeoutMs)),
      ]);
      if (!fix) return { kind: 'checkin' };

      const here: Anchor = { lat: fix.coords.latitude, lon: fix.coords.longitude };

      if (!anchor.current) {
        const saved = await AsyncStorage.getItem(ANCHOR_KEY).catch(() => null);
        if (saved) anchor.current = JSON.parse(saved) as Anchor;
      }
      if (!anchor.current) {
        anchor.current = here;
        await AsyncStorage.setItem(ANCHOR_KEY, JSON.stringify(here)).catch(() => {});
        return { kind: 'anchored' };
      }

      const metres = distanceM(anchor.current, here);
      return metres >= OUTSIDE.distanceM
        ? { kind: 'moved', metres }
        : { kind: 'too-close', metres };
    } catch {
      return { kind: 'checkin' };
    } finally {
      setBusy(false);
    }
  }, []);

  return { check, busy, granted };
}
