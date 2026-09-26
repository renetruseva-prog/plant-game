import { Accelerometer, Gyroscope } from 'expo-sensors';
import { useEffect, useEffectEvent, useRef } from 'react';
import { useSharedValue } from 'react-native-reanimated';

import { MOTION } from './config';

type MotionEvents = {
  onWalk: () => void;
  onNudge: () => void;
  onJolt: () => void;
};

const medianOf = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
};

/**
 * Turns the raw accelerometer (and, where available, gyroscope) stream into
 * three discrete game events.
 *
 * The accelerometer reports gravity too, so at rest the magnitude sits at
 * ~1g - but not at *exactly* 1g on every device, since real sensors carry a
 * small per-device bias. The first few samples after `enabled` turns on
 * (typically while the player is still reading the intro card) calibrate
 * that device's actual resting magnitude instead of assuming a textbook
 * exact 1, so `delta = |magnitude - restMagnitude|` means the same thing on
 * every phone this runs on.
 *
 *  - jolt  : delta over `joltDelta`, at least twice inside a short window,
 *            *and* corroborated by real rotation on the gyroscope (a shake
 *            tumbles the phone, not just accelerates it) where one's
 *            available - so a single hard bump with no rotation doesn't
 *            ruin a run either.
 *  - walk  : a run of small rhythmic peaks inside the gentle band - the gait
 *            signature. Safer than the Pedometer, which needs permissions.
 *  - nudge : sustained gentle movement that never becomes rhythmic.
 *
 * Returns a shared value carrying the live tilt so the plant can lean with the
 * device without re-rendering React on every sample.
 */
export function useMotion(enabled: boolean, events: MotionEvents) {
  const tilt = useSharedValue(0);

  // Always call the newest callbacks, without the sensor subscription below
  // having to restart whenever they change.
  const emitWalk = useEffectEvent(events.onWalk);
  const emitNudge = useEffectEvent(events.onNudge);
  const emitJolt = useEffectEvent(events.onJolt);

  const peaks = useRef<number[]>([]);
  const spikes = useRef<number[]>([]);
  const gentleSince = useRef<number | null>(null);
  const above = useRef(false);
  const lastWalk = useRef(0);
  const lastNudge = useRef(0);
  const lastJolt = useRef(0);

  /** Low-passed x reading the plant leans with; see `MOTION.tiltSmoothing`. */
  const smoothedX = useRef(0);

  /** Per-device resting magnitude, filled in by the calibration samples. */
  const restMagnitude = useRef(1);
  const calibrating = useRef(true);
  const calibrationSamples = useRef<number[]>([]);

  /** Recent gyroscope rotation-rate magnitudes, trimmed to the jolt spike
   *  window - corroborating evidence for a jolt, not a detector of its own. */
  const gyroSamples = useRef<{ t: number; mag: number }[]>([]);
  const gyroAvailable = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let accelSub: { remove: () => void } | undefined;
    let gyroSub: { remove: () => void } | undefined;

    calibrating.current = true;
    calibrationSamples.current = [];
    gyroSamples.current = [];

    (async () => {
      const available = await Accelerometer.isAvailableAsync().catch(() => false);
      if (!available || cancelled) return;

      Accelerometer.setUpdateInterval(MOTION.intervalMs);

      // The gyroscope is optional corroboration, not a requirement - plenty
      // of real devices don't have one, and jolt detection falls back to the
      // accelerometer alone when it's missing.
      const gyroAvailableNow = await Gyroscope.isAvailableAsync().catch(() => false);
      gyroAvailable.current = gyroAvailableNow;
      if (gyroAvailableNow) {
        try {
          Gyroscope.setUpdateInterval(MOTION.intervalMs);
          gyroSub = Gyroscope.addListener(({ x, y, z }) => {
            const now = Date.now();
            const mag = Math.sqrt(x * x + y * y + z * z);
            gyroSamples.current = [...gyroSamples.current, { t: now, mag }].filter(
              (s) => now - s.t < MOTION.joltSpikeWindowMs
            );
          });
        } catch {
          // No gyroscope in practice despite reporting available: proceed
          // without corroboration rather than crashing the run.
          gyroAvailable.current = false;
        }
      }

      try {
        accelSub = Accelerometer.addListener(({ x, y, z }) => {
          const now = Date.now();
          const magnitude = Math.sqrt(x * x + y * y + z * z);

          // Live lean, clamped so a violent shake doesn't fling the plant
          // away - kept live even during calibration so the plant doesn't
          // freeze while it settles.
          smoothedX.current += (x - smoothedX.current) * MOTION.tiltSmoothing;
          tilt.value = Math.max(-1, Math.min(1, smoothedX.current * 2));

          if (calibrating.current) {
            calibrationSamples.current.push(magnitude);
            if (calibrationSamples.current.length >= MOTION.calibrationSamples) {
              restMagnitude.current = medianOf(calibrationSamples.current);
              calibrating.current = false;
            }
            return;
          }

          const delta = Math.abs(magnitude - restMagnitude.current);

          // --- aggressive ---
          if (delta > MOTION.joltDelta) {
            spikes.current = [...spikes.current, now].filter(
              (t) => now - t < MOTION.joltSpikeWindowMs
            );
            const rotating =
              !gyroAvailable.current || gyroSamples.current.some((s) => s.mag >= MOTION.joltGyroMin);
            if (
              spikes.current.length >= MOTION.joltSpikesRequired &&
              rotating &&
              now - lastJolt.current > MOTION.joltCooldownMs
            ) {
              lastJolt.current = now;
              spikes.current = [];
              peaks.current = [];
              gentleSince.current = null;
              emitJolt();
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
            emitWalk();
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
            emitNudge();
          }
        });
      } catch (e) {
        // No usable accelerometer here (e.g. web): play on without motion.
        console.warn('Accelerometer.addListener failed:', e);
      }
    })().catch(() => {
      // Sensors missing or unusable here (e.g. web): play on without motion.
    });

    return () => {
      cancelled = true;
      accelSub?.remove();
      gyroSub?.remove();
    };
  }, [enabled, tilt]);

  return tilt;
}
