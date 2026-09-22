import { Accelerometer } from 'expo-sensors';
import { useEffect, useRef } from 'react';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';

import { FALL } from './config';

/**
 * Detects the phone being rotated 180° - held the way you'd hold an
 * upside-down book, screen still facing you but inverted - and sustained for
 * a moment rather than a brief fumble. Also exposes the live rotation as it
 * happens, so the plant can visibly follow the phone turning rather than
 * just cutting to a result once the threshold is crossed.
 *
 * This reads the raw accelerometer's gravity vector rather than
 * `DeviceMotion`'s `orientation` field. That field reflects the app's
 * *interface* orientation, which - because this app is locked to portrait
 * (`app.json`'s `orientation: "portrait"`) - never actually rotates to
 * upside-down no matter how the phone is physically held; the OS simply
 * never reports it. The accelerometer has no such notion of "interface": it
 * measures true physical orientation regardless of what the app supports.
 *
 * The player's first reading becomes the "upright" baseline. Every
 * subsequent reading is turned into a signed angle (degrees) *relative* to
 * that baseline via the angle-between-two-vectors formula
 * (`atan2(cross, dot)`), which stays correct regardless of which raw sign a
 * given platform happens to call "up" - it only ever measures how far the
 * device has turned from wherever it started.
 */
export function useUpsideDown(enabled: boolean, onFall: () => void): { fallAngle: SharedValue<number> } {
  const fallAngle = useSharedValue(0);

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
    let baseline: { x: number; y: number } | null = null;

    (async () => {
      const available = await Accelerometer.isAvailableAsync().catch(() => false);
      if (!available || cancelled) return;

      // Mirrors the guard already used in `useMotion` - avoids a crash where
      // the native module doesn't expose these (web, mismatched builds).
      if (typeof Accelerometer.addListener !== 'function') return;

      // Deliberately doesn't call `setUpdateInterval`: that setting is
      // global to the sensor, and `useMotion` (active at the same time)
      // already configures it. Setting it again here would just fight that.
      sub = Accelerometer.addListener(({ x, y }) => {
        if (fired || cancelled) return;

        const mag = Math.hypot(x, y) || 1;
        const nx = x / mag;
        const ny = y / mag;

        if (!baseline) baseline = { x: nx, y: ny };

        const cross = baseline.x * ny - baseline.y * nx;
        const dot = baseline.x * nx + baseline.y * ny;
        const angleDeg = Math.atan2(cross, dot) * (180 / Math.PI);
        fallAngle.value = angleDeg;

        const flipped = Math.abs(angleDeg) > FALL.angleThreshold;
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
  }, [enabled, fallAngle]);

  return { fallAngle };
}
