import { Accelerometer } from 'expo-sensors';
import { useEffect, useRef } from 'react';
import { useSharedValue } from 'react-native-reanimated';

import { MOTION } from './config';

type MotionEvents = {
  onWalk: () => void;
  onNudge: () => void;
  onJolt: () => void;
};

/**
 * Turns the raw accelerometer stream into three discrete game events.
 *
 * The accelerometer reports gravity too, so at rest the magnitude sits at ~1g.
 * Everything below keys off `delta = |magnitude - 1|`:
 *
 *  - jolt  : delta over `joltDelta`, at least twice inside a short window, so a
 *            single dropped phone doesn't ruin a run.
 *  - walk  : a run of small rhythmic peaks inside the gentle band - the gait
 *            signature. Safer than the Pedometer, which needs permissions.
 *  - nudge : sustained gentle movement that never becomes rhythmic.
 *
 * Returns a shared value carrying the live tilt so the plant can lean with the
 * device without re-rendering React on every sample.
 */
export function useMotion(enabled: boolean, events: MotionEvents) {
  const tilt = useSharedValue(0);

  // Keep the latest callbacks without resubscribing the sensor.
  const handlers = useRef(events);
  useEffect(() => {
    handlers.current = events;
  });

  const peaks = useRef<number[]>([]);
  const spikes = useRef<number[]>([]);
  const gentleSince = useRef<number | null>(null);
  const above = useRef(false);
  const lastWalk = useRef(0);
  const lastNudge = useRef(0);
  const lastJolt = useRef(0);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let sub: { remove: () => void } | undefined;

    (async () => {
      const available = await Accelerometer.isAvailableAsync().catch(() => false);
      if (!available || cancelled) return;

      // Guard against environments where the native module doesn't expose
      // `addListener`, preventing "this._nativeModule.addListener is not a
      // function" errors when running on web or with mismatched native modules.
      if (typeof Accelerometer.setUpdateInterval !== 'function') {
        return;
      }

      Accelerometer.setUpdateInterval(MOTION.intervalMs);

      try {
        if (typeof Accelerometer.addListener !== 'function') return;
        sub = Accelerometer.addListener(({ x, y, z }) => {
          const now = Date.now();
        const delta = Math.abs(Math.sqrt(x * x + y * y + z * z) - 1);

        // Live lean, clamped so a violent shake doesn't fling the plant away.
        tilt.value = Math.max(-1, Math.min(1, x * 2));

        // --- aggressive ---
        if (delta > MOTION.joltDelta) {
          spikes.current = [...spikes.current, now].filter(
            (t) => now - t < MOTION.joltSpikeWindowMs
          );
          if (
            spikes.current.length >= MOTION.joltSpikesRequired &&
            now - lastJolt.current > MOTION.joltCooldownMs
          ) {
            lastJolt.current = now;
            spikes.current = [];
            peaks.current = [];
            gentleSince.current = null;
            handlers.current.onJolt();
          }
          return;
        }

        // --- rhythmic (walking) ---
        // Count upward crossings of the gentle band as gait peaks.
        const inBand = delta > MOTION.gentleMin && delta < MOTION.gentleMax;
        if (inBand && !above.current) {
          above.current = true;
          peaks.current.push(now);
        } else if (delta < MOTION.gentleMin * 0.6) {
          above.current = false;
        }
        peaks.current = peaks.current.filter((t) => now - t < MOTION.walkWindowMs);

        if (inBand) {
          gentleSince.current ??= now;
        } else if (delta < MOTION.gentleMin * 0.6) {
          gentleSince.current = null;
        }

        if (
          peaks.current.length >= MOTION.walkMinPeaks &&
          now - lastWalk.current > MOTION.walkCooldownMs
        ) {
          lastWalk.current = now;
          lastNudge.current = now; // a walk already covers the gentle reaction
          peaks.current = [];
          gentleSince.current = null;
          handlers.current.onWalk();
          return;
        }

        // --- gentle but not rhythmic ---
        if (
          gentleSince.current !== null &&
          now - gentleSince.current > 900 &&
          now - lastNudge.current > MOTION.nudgeCooldownMs
        ) {
          lastNudge.current = now;
          gentleSince.current = null;
          handlers.current.onNudge();
        }
        });
      } catch (e) {
        // If the native implementation is missing or throws, avoid crashing
        // the JS runtime — log and bail out; the app should continue with
        // graceful fallback behavior.
        // eslint-disable-next-line no-console
        console.warn('Accelerometer.addListener failed:', e);
        return;
      }
    })();

    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, [enabled, tilt]);

  return tilt;
}
