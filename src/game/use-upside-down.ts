import { Accelerometer } from 'expo-sensors';
import { useEffect, useEffectEvent } from 'react';
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

  // Always calls the newest `onFall`, without the subscription restarting.
  const emitFall = useEffectEvent(onFall);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let sub: { remove: () => void } | undefined;
    let fired = false;
    let baseline: { x: number; y: number } | null = null;
    /** Low-passed gravity direction, so shaking doesn't whip the angle
     *  around - see `FALL.angleSmoothing`. */
    let smooth: { x: number; y: number } | null = null;
    /** When the current stretch of being flipped began, and when it was last
     *  actually seen flipped (for the grace period). */
    let flippedSince: number | null = null;
    let lastFlipped = 0;

    (async () => {
      const available = await Accelerometer.isAvailableAsync().catch(() => false);
      if (!available || cancelled) return;

      // Deliberately doesn't call `setUpdateInterval`: that setting is
      // global to the sensor, and `useMotion` (active at the same time)
      // already configures it. Setting it again here would just fight that.
      sub = Accelerometer.addListener(({ x, y }) => {
        if (fired || cancelled) return;

        const mag = Math.hypot(x, y) || 1;
        const rx = x / mag;
        const ry = y / mag;

        smooth = smooth
          ? {
              x: smooth.x + (rx - smooth.x) * FALL.angleSmoothing,
              y: smooth.y + (ry - smooth.y) * FALL.angleSmoothing,
            }
          : { x: rx, y: ry };
        const sMag = Math.hypot(smooth.x, smooth.y) || 1;
        const nx = smooth.x / sMag;
        const ny = smooth.y / sMag;

        if (!baseline) baseline = { x: nx, y: ny };

        const cross = baseline.x * ny - baseline.y * nx;
        const dot = baseline.x * nx + baseline.y * ny;
        const angleDeg = Math.atan2(cross, dot) * (180 / Math.PI);
        fallAngle.value = angleDeg;

        // Checked on every sample rather than with a timer that a single dip
        // can cancel: it counts once the phone has been upside down for
        // `holdMs`, forgiving dips shorter than `graceMs` (shaking it).
        const now = Date.now();
        if (Math.abs(angleDeg) > FALL.angleThreshold) {
          flippedSince ??= now;
          lastFlipped = now;
          if (now - flippedSince >= FALL.holdMs) {
            fired = true;
            emitFall();
          }
        } else if (flippedSince !== null && now - lastFlipped > FALL.graceMs) {
          flippedSince = null;
        }
      });
    })().catch(() => {
      // Sensor missing or unusable here (e.g. web): the fall just never fires.
    });

    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, [enabled, fallAngle]);

  return { fallAngle };
}
