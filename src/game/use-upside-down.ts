import { DeviceMotion } from 'expo-sensors';
import { useEffect, useRef } from 'react';

import { FALL } from './config';

/**
 * Detects the phone being rotated 180° - held the way you'd hold an
 * upside-down book, screen still facing you but inverted - and sustained for
 * a moment rather than a brief fumble. Uses `DeviceMotion`'s own screen
 * `orientation` field (`180` means portrait-upside-down) instead of reading
 * a raw accelerometer sign, since the OS has already done the calibration
 * work of deciding what "upright" means on this device.
 *
 * Fires `onFall` at most once per mount - the caller disables this hook
 * (via `enabled`) once the run has actually ended.
 */
export function useUpsideDown(enabled: boolean, onFall: () => void) {
  const onFallRef = useRef(onFall);
  useEffect(() => {
    onFallRef.current = onFall;
  });

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let sub: { remove: () => void } | undefined;
    let holdTimer: ReturnType<typeof setTimeout> | null = null;
    let fired = false;

    (async () => {
      const available = await DeviceMotion.isAvailableAsync().catch(() => false);
      if (!available || cancelled) return;

      // Guard against environments where the native module doesn't expose
      // these, mirroring the same defensive check used for the other
      // sensor hooks (web, mismatched native modules).
      if (
        typeof DeviceMotion.setUpdateInterval !== 'function' ||
        typeof DeviceMotion.addListener !== 'function'
      ) {
        return;
      }

      DeviceMotion.setUpdateInterval(200);
      sub = DeviceMotion.addListener(({ orientation }) => {
        if (fired || cancelled) return;

        if (orientation === 180) {
          holdTimer ??= setTimeout(() => {
            fired = true;
            onFallRef.current();
          }, FALL.holdMs);
        } else if (holdTimer) {
          clearTimeout(holdTimer);
          holdTimer = null;
        }
      });
    })();

    return () => {
      cancelled = true;
      if (holdTimer) clearTimeout(holdTimer);
      sub?.remove();
    };
  }, [enabled]);
}
