import { CameraView, useCameraPermissions } from 'expo-camera';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { CAMERA_LIGHT } from '@/game/config';
import { frameStatsFromBase64Jpeg, medianOf, type FrameStats } from '@/game/camera-luma';
import type { Env } from '@/game/types';

export type CameraLightStatus = 'pending' | 'active' | 'unavailable';

/** Raw internals of the covered-lens decision, for the hidden dev panel -
 *  the only way to actually see this pipeline's numbers on a real device,
 *  since there's no way to attach a debugger to it mid-gesture. */
export type CameraDebugInfo =
  | ({ kind: 'reading'; baseline: number | null; covered: boolean; streak: number } & FrameStats)
  | { kind: 'error'; message: string };

/** Whether this frame looks like a finger over the lens - see the comment on
 *  `coveredMaxStdDev` in `config.ts` for why brightness alone isn't enough. */
function looksCovered({ luma, lumaStdDev, redRatio }: FrameStats, baseline: number | null): boolean {
  const hasBaseline = baseline !== null && baseline >= CAMERA_LIGHT.coveredBaselineMin;
  // A big drop in a room that was lit counts on its own.
  if (hasBaseline && luma <= baseline * CAMERA_LIGHT.coveredDropRatio) return true;
  // Otherwise the frame has to have lost its detail, plus either the red of
  // light through skin or at least a noticeable dimming.
  if (lumaStdDev > CAMERA_LIGHT.coveredMaxStdDev) return false;
  if (redRatio >= CAMERA_LIGHT.coveredMinRedRatio) return true;
  return hasBaseline && luma <= baseline * CAMERA_LIGHT.coveredSoftDropRatio;
}

type Props = {
  /** Only samples while true - stops the moment the run isn't playing. */
  enabled: boolean;
  onEnvChange: (env: Env) => void;
  onStatus: (status: CameraLightStatus) => void;
  onBrightness: (luma: number | null) => void;
  /** Fired once per covering, once the frame has looked like a finger over
   *  the lens (see `looksCovered`) for `coveredHoldTicks` samples in a row -
   *  not merely because the room happens to be dark. */
  onSleep: () => void;
  onDebug?: (info: CameraDebugInfo) => void;
};

/**
 * The iOS (and general no-LightSensor) fallback for ambient light.
 *
 * Apple has never exposed the ambient light sensor's reading to third-party
 * apps in any framework, so there is no direct equivalent of Android's
 * `LightSensor` to call here. This samples the camera feed instead - a real
 * phone sensor genuinely reacting to the room's light, just read indirectly.
 * If the camera is denied or unavailable, `onStatus('unavailable')` tells the
 * caller to fall back further, to the manual curtains toggle.
 *
 * Because it's reading the lens rather than a dedicated sensor, it can also
 * tell a covered lens apart from a merely dark room - see `onSleep`.
 *
 * The `CameraView` is mounted off-screen (not just invisible in place -
 * shifted well outside the viewport) at a real, ordinary size. A 2x2px view
 * seemed like an obvious way to keep it small, but on-device it read as a
 * frozen, unchanging frame no matter what the lens actually saw - a
 * degenerate size like that likely isn't something the platform's camera
 * pipeline treats as a genuine live surface.
 *
 * Uses the **front** camera specifically: when a phone is set down the
 * ordinary way (screen up), the front camera looks up at the room, while the
 * back camera looks down into the table and reads its surface instead of the
 * room's light - a wrong reading, not an imprecise one.
 */
export function CameraLightSensor({ enabled, onEnvChange, onStatus, onBrightness, onSleep, onDebug }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [ready, setReady] = useState(false);
  /** Smallest picture size the camera offers, once known - decoding a
   *  full-resolution photo in JS every sample is what heated the phone up. */
  const [pictureSize, setPictureSize] = useState<string | undefined>(undefined);
  const cameraRef = useRef<CameraView>(null);
  const lastEnv = useRef<Env | null>(null);
  const requestedRef = useRef(false);
  const sizedRef = useRef(false);
  /** Last few readings, so one blurry or transiently-occluded frame - the
   *  phone mid-motion while being set down, a hand passing over the lens -
   *  can't flip the room state on its own. */
  const recentLumas = useRef<number[]>([]);
  /** Rolling estimate of this room's normal (uncovered) brightness, only
   *  updated while not currently reading as covered - otherwise a sustained
   *  covering would drag the baseline down to meet itself, and never again
   *  register as a "drop". */
  const baselineLuma = useRef<number | null>(null);
  /** Consecutive samples reading as covered relative to the baseline, for
   *  `onSleep`. */
  const coveredStreak = useRef(0);
  /** Set once `onSleep` has fired for the current covering, so holding the
   *  lens covered scores one nap, not one per sample. Clears the moment the
   *  lens uncovers again. */
  const sleepFired = useRef(false);

  const onEnvChangeRef = useRef(onEnvChange);
  const onStatusRef = useRef(onStatus);
  const onBrightnessRef = useRef(onBrightness);
  const onSleepRef = useRef(onSleep);
  const onDebugRef = useRef(onDebug);
  useEffect(() => {
    onEnvChangeRef.current = onEnvChange;
    onStatusRef.current = onStatus;
    onBrightnessRef.current = onBrightness;
    onSleepRef.current = onSleep;
    onDebugRef.current = onDebug;
  });

  // Ask for permission once, lazily, only once the run actually needs it -
  // never at cold start, before the player has even tapped Start.
  useEffect(() => {
    if (!enabled || requestedRef.current || !permission) return;
    if (permission.granted) return;
    if (!permission.canAskAgain) {
      onStatusRef.current('unavailable');
      return;
    }
    requestedRef.current = true;
    requestPermission().then((next) => {
      if (!next.granted) onStatusRef.current('unavailable');
    });
  }, [enabled, permission, requestPermission]);

  useEffect(() => {
    if (!enabled || !permission?.granted || !ready) {
      if (enabled && permission && !permission.granted && permission.canAskAgain === false) {
        onStatusRef.current('unavailable');
      }
      return;
    }

    onStatusRef.current('active');

    if (!sizedRef.current && cameraRef.current) {
      sizedRef.current = true;
      cameraRef.current
        .getAvailablePictureSizesAsync()
        .then((sizes) => {
          const smallest = sizes
            .map((s) => {
              const [w, h] = s.split('x').map(Number);
              return { s, area: (w || 0) * (h || 0) };
            })
            .filter((x) => x.area > 0)
            .sort((a, b) => a.area - b.area)[0];
          if (smallest) setPictureSize(smallest.s);
        })
        .catch(() => {
          // No size list: sample at the default size. Slower, still correct.
        });
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    // A self-scheduling loop, not `setInterval`: the next capture is only
    // requested once this one has fully finished (however long that took).
    // `setInterval` fires on a fixed clock regardless of whether the
    // previous `takePictureAsync` call is still in flight - if a capture
    // ever takes longer than `intervalMs` (as happened once `skipProcessing`
    // was removed), calls stack up and back the camera's own capture queue
    // up behind them, and by the time it works through that backlog, "now"
    // no longer means what the reading claims it does.
    const tick = async () => {
      if (cancelled || !cameraRef.current) return;
      try {
        // `pictureRef: true` routes through a different native return path
        // than a plain `takePictureAsync` call - tried after on-device
        // testing showed the plain path returning the same stale frame
        // indefinitely while the live preview itself updated correctly.
        const ref = await cameraRef.current.takePictureAsync({ skipProcessing: true, pictureRef: true });
        if (cancelled) return;
        const saved = await ref.savePictureAsync({ base64: true, quality: CAMERA_LIGHT.jpegQuality });
        if (cancelled) return;
        if (!saved.base64) {
          onDebugRef.current?.({ kind: 'error', message: 'savePictureAsync returned no base64' });
          return;
        }

        const stats = frameStatsFromBase64Jpeg(saved.base64);
        if (stats === null) {
          onDebugRef.current?.({ kind: 'error', message: 'JPEG decode failed' });
          return;
        }
        const { luma } = stats;
        onBrightnessRef.current(luma);

        // Checked before the baseline below is updated, so a covered reading
        // never gets to count as evidence of the room's normal brightness.
        const isCovered = looksCovered(stats, baselineLuma.current);

        if (!isCovered) {
          // A brighter reading replaces the baseline outright; a dimmer one
          // only decays it - see `baselineDecay` on why the two aren't
          // symmetric.
          baselineLuma.current =
            baselineLuma.current === null
              ? luma
              : Math.max(luma, baselineLuma.current * CAMERA_LIGHT.baselineDecay);
        }

        if (isCovered) {
          coveredStreak.current += 1;
          if (!sleepFired.current && coveredStreak.current >= CAMERA_LIGHT.coveredHoldTicks) {
            sleepFired.current = true;
            onSleepRef.current();
            // Covering the lens should visibly put the plant to sleep the
            // moment it's detected, not whenever the separate smoothed
            // day/night median below happens to agree - that's a several-
            // sample lag this already-confident signal shouldn't have to
            // wait on.
            if (lastEnv.current !== 'dark') {
              lastEnv.current = 'dark';
              onEnvChangeRef.current('dark');
            }
          }
        } else {
          // Just uncovered: forget the readings from before/while covered,
          // so the very next frames decide whether the room is actually
          // light or dark again, instead of a median still half-full of a
          // fingertip.
          if (sleepFired.current) recentLumas.current = [];
          coveredStreak.current = 0;
          sleepFired.current = false;
        }

        onDebugRef.current?.({
          kind: 'reading',
          ...stats,
          baseline: baselineLuma.current,
          covered: isCovered,
          streak: coveredStreak.current,
        });

        // While the lens is covered, the ordinary day/night check stays out
        // of it. A covered frame is often still bright (auto-exposure), so
        // left running it would call the room "day" on the very next sample
        // and wake the plant straight back up while the finger's still there.
        if (isCovered) return;

        recentLumas.current = [...recentLumas.current, luma].slice(-CAMERA_LIGHT.smoothingWindow);
        const smoothed = medianOf(recentLumas.current);

        const next: Env | null =
          smoothed <= CAMERA_LIGHT.darkLuma
            ? 'dark'
            : smoothed >= CAMERA_LIGHT.brightLuma
              ? 'day'
              : null;
        if (next && next !== lastEnv.current) {
          lastEnv.current = next;
          onEnvChangeRef.current(next);
        }
      } catch (e) {
        // One missed frame doesn't matter; the next tick tries again.
        onDebugRef.current?.({ kind: 'error', message: e instanceof Error ? e.message : String(e) });
      } finally {
        if (!cancelled) timer = setTimeout(tick, CAMERA_LIGHT.intervalMs);
      }
    };

    timer = setTimeout(tick, CAMERA_LIGHT.intervalMs);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [enabled, permission, ready]);

  if (!enabled || !permission?.granted) return null;

  return (
    // `collapsable={false}` keeps this out of view-flattening on the New
    // Architecture, which on-device testing traced back to the actual bug
    // here (see `tick` above): a flattened wrapper let the CameraView's
    // capture session end up serving stale frames indefinitely.
    <View style={styles.hidden} pointerEvents="none" collapsable={false}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing="front"
        pictureSize={pictureSize}
        onCameraReady={() => setReady(true)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  hidden: { position: 'absolute', top: -1000, left: -1000, width: 40, height: 40, overflow: 'hidden' },
  camera: { width: 40, height: 40 },
});
