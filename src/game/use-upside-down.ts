import { Accelerometer } from 'expo-sensors';
import { useEffect, useRef } from 'react';

import { FALL } from './config';

/**
 * Detects the phone being rotated 180° - held the way you'd hold an
 * upside-down book, screen still facing you but inverted - and sustained for
 * a moment rather than a brief fumble.
 *
 * This reads the raw accelerometer's gravity vector rather than
 * `DeviceMotion`'s `orientation` field. That field reflects the app's
 * *interface* orientation, which - because this app is locked to portrait
 * (`app.json`'s `orientation: "portrait"`) - never actually rotates to
 * upside-down no matter how the phone is physically held; the OS simply
 * never reports it. The accelerometer has no such notion of "interface": it
 * measures true physical orientation regardless of what the app supports.
 *
 * The player's starting orientation becomes the "upright" baseline (whatever
 * sign gravity's Y-component has at that moment), since there's no portable
 * way to know in advance which sign a given platform calls "up". A sustained
 * flip to the opposite sign is the trigger.
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
    let baselineSign: 1 | -1 | null = null;

    (async () => {
      const available = await Accelerometer.isAvailableAsync().catch(() => false);
      if (!available || cancelled) return;

      // Mirrors the guard already used in `useMotion` - avoids a crash where
      // the native module doesn't expose these (web, mismatched builds).
      if (typeof Accelerometer.addListener !== 'function') return;

      // Deliberately doesn't call `setUpdateInterval`: that setting is
      // global to the sensor, and `useMotion` (active at the same time)
      // already configures it. Setting it again here would just fight that.
      sub = Accelerometer.addListener(({ y }) => {
        if (fired || cancelled) return;

        // First reading becomes "upright" - the player is presumably
        // holding the phone normally when a run starts.
        baselineSign ??= y >= 0 ? 1 : -1;

        const flipped = Math.abs(y) > 0.6 && Math.sign(y) !== 0 && Math.sign(y) !== baselineSign;

        if (flipped) {
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
