import { CameraView, useCameraPermissions } from 'expo-camera';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { CAMERA_LIGHT } from '@/game/config';
import { averageLumaFromBase64Jpeg } from '@/game/camera-luma';
import type { Env } from '@/game/types';

export type CameraLightStatus = 'pending' | 'active' | 'unavailable';

type Props = {
  /** Only samples while true - stops the moment the run isn't playing. */
  enabled: boolean;
  onEnvChange: (env: Env) => void;
  onStatus: (status: CameraLightStatus) => void;
  onBrightness: (luma: number | null) => void;
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
 * The `CameraView` is mounted at 2x2px and fully transparent: large enough
 * that camera implementations reliably keep delivering frames, small enough
 * to be invisible in the UI.
 */
export function CameraLightSensor({ enabled, onEnvChange, onStatus, onBrightness }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [ready, setReady] = useState(false);
  /** Smallest picture size the camera offers, once known. */
  const [pictureSize, setPictureSize] = useState<string | undefined>(undefined);
  const cameraRef = useRef<CameraView>(null);
  const lastEnv = useRef<Env | null>(null);
  const sizedRef = useRef(false);
  const requestedRef = useRef(false);

  const onEnvChangeRef = useRef(onEnvChange);
  const onStatusRef = useRef(onStatus);
  const onBrightnessRef = useRef(onBrightness);
  useEffect(() => {
    onEnvChangeRef.current = onEnvChange;
    onStatusRef.current = onStatus;
    onBrightnessRef.current = onBrightness;
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

    // Use the smallest picture size the camera offers - decode time is the
    // real cost of this technique, and a smaller frame is the only lever
    // that actually shrinks it. `pictureSize` is a controlled prop, so the
    // result is applied by re-rendering with it rather than by an imperative
    // call, and this effect only needs to run the lookup once.
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
          // No size list available: sample at whatever the default is.
          // Slower, but still correct.
        });
    }

    let cancelled = false;
    const id = setInterval(async () => {
      if (cancelled || !cameraRef.current) return;
      try {
        const photo = await cameraRef.current.takePictureAsync({
          base64: true,
          quality: CAMERA_LIGHT.jpegQuality,
          skipProcessing: true,
          shutterSound: false,
        });
        if (cancelled || !photo?.base64) return;

        const luma = averageLumaFromBase64Jpeg(photo.base64);
        if (luma === null) return;
        onBrightnessRef.current(luma);

        const next: Env | null =
          luma <= CAMERA_LIGHT.darkLuma ? 'dark' : luma >= CAMERA_LIGHT.brightLuma ? 'day' : null;
        if (next && next !== lastEnv.current) {
          lastEnv.current = next;
          onEnvChangeRef.current(next);
        }
      } catch {
        // One missed frame doesn't matter; the next tick tries again.
      }
    }, CAMERA_LIGHT.intervalMs);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [enabled, permission, ready]);

  if (!enabled || !permission?.granted) return null;

  return (
    <View style={styles.hidden} pointerEvents="none">
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing="back"
        pictureSize={pictureSize}
        onCameraReady={() => setReady(true)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  hidden: { position: 'absolute', width: 2, height: 2, opacity: 0, overflow: 'hidden' },
  camera: { width: 2, height: 2 },
});
