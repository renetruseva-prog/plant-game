import { CameraView, useCameraPermissions } from 'expo-camera';
// The legacy API: the promise-based calls always work in Expo Go, unlike the
// newer synchronous File classes (see the same choice in `gallery.tsx`).
import * as FileSystem from 'expo-file-system/legacy';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { MONO } from '@/game/fonts';
import { hapticAlarm } from '@/game/haptics';

/** Let the camera's exposure settle before the shutter, and give the player
 *  a beat of being watched. */
const SETTLE_MS = 1300;
/** How long the photo stays on screen. */
const SHOW_MS = 3000;
/** If anything in the capture stalls, the ending carries on without a photo
 *  rather than hanging on a black screen. */
const CAPTURE_TIMEOUT_MS = 9000;

type Phase = 'idle' | 'camera' | 'photo';

/**
 * Mounted only while it's running, so every showing starts from scratch.
 *
 * The bad ending's last move: after the fake permission dialog, the plant
 * opens the front camera, takes a photo of whoever is holding the phone, and
 * shows it under "you did this to me" for a few seconds.
 *
 * Only ever starts once the player has tapped Allow *and* the phone's real
 * camera permission is granted - a denial (or any failure) just skips
 * straight to `onDone`. The photo lives in memory and the cache for the
 * length of the reveal, then the file is deleted; nothing is saved or sent.
 */
export function EvilPhotoBooth({ onDone }: { onDone: () => void }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [phase, setPhase] = useState<Phase>('idle');
  const [uri, setUri] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const savedUriRef = useRef<string | null>(null);
  const flash = useSharedValue(0);

  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Always call the newest `onDone`, and read the newest permission state,
  // without the effects below restarting whenever either changes.
  const finish = useEffectEvent(onDone);
  const askPermission = useEffectEvent(async () => {
    if (permission?.granted) return true;
    try {
      return (await requestPermission()).granted;
    } catch {
      return false;
    }
  });

  // Asks for the real permission, then opens the camera.
  useEffect(() => {
    let cancelled = false;
    askPermission().then((granted) => {
      if (cancelled) return;
      if (granted) setPhase('camera');
      else finish();
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // With the camera up: wait a moment, then take the picture.
  useEffect(() => {
    if (phase !== 'camera' || !ready) return;
    let cancelled = false;

    const bail = setTimeout(() => {
      if (!cancelled) finish();
    }, CAPTURE_TIMEOUT_MS);

    const shutter = setTimeout(async () => {
      try {
        if (!cameraRef.current) throw new Error('no camera');
        // `pictureRef` + `savePictureAsync`, not a plain `takePictureAsync`:
        // the plain call returned stale frames on-device (see
        // `camera-light-sensor.tsx`).
        const ref = await cameraRef.current.takePictureAsync({ pictureRef: true });
        const saved = await ref.savePictureAsync({ quality: 0.7, base64: true });
        if (cancelled) return;
        savedUriRef.current = saved.uri;
        clearTimeout(bail);
        // Shown from the image data itself, not the saved file's path: the
        // `Image` came up empty when pointed at that path, with no error.
        const source = saved.base64 ? `data:image/jpeg;base64,${saved.base64}` : saved.uri;

        hapticAlarm();
        flash.value = 1;
        flash.value = withTiming(0, { duration: 500 });
        setUri(source);
        setPhase('photo');
        // The photo stays for exactly `SHOW_MS`. Started here, at the moment
        // it appears, and owned by a ref rather than this effect - the phase
        // change would otherwise run this effect's cleanup and cancel it.
        showTimerRef.current = setTimeout(() => finish(), SHOW_MS);
      } catch {
        if (!cancelled) finish();
      }
    }, SETTLE_MS);

    return () => {
      cancelled = true;
      clearTimeout(bail);
      clearTimeout(shutter);
    };
  }, [phase, ready, flash]);

  // Never keep the photo, or its timer, around once the booth is gone.
  useEffect(
    () => () => {
      if (showTimerRef.current) clearTimeout(showTimerRef.current);
      if (savedUriRef.current) FileSystem.deleteAsync(savedUriRef.current, { idempotent: true }).catch(() => {});
    },
    []
  );

  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.value }));

  if (phase === 'idle') return null;

  return (
    <View style={styles.wrap}>
      {phase === 'camera' ? (
        <>
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing="front"
            onCameraReady={() => setReady(true)}
          />
          <View style={styles.dim} pointerEvents="none" />
          <Text style={styles.watching}>hold still.</Text>
        </>
      ) : (
        <Animated.View entering={FadeIn.duration(200)} style={styles.photoScreen}>
          <Text style={styles.title}>you did this to me</Text>
          <View style={styles.photoFrame}>
            {uri ? (
              <Image
                source={{ uri }}
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
                onError={(e) => console.warn('[photo] failed to load:', e.nativeEvent.error)}
              />
            ) : null}
            {/* A wash of red so it reads as the plant's photo, not a selfie. */}
            <View style={styles.redWash} pointerEvents="none" />
          </View>
        </Animated.View>
      )}
      <Animated.View style={[StyleSheet.absoluteFill, styles.flash, flashStyle]} pointerEvents="none" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 65, backgroundColor: '#14001C' },
  dim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(20,0,28,0.35)' },
  watching: {
    position: 'absolute',
    bottom: 90,
    alignSelf: 'center',
    color: '#FF3B6B',
    fontFamily: MONO,
    fontSize: 20,
    letterSpacing: 1.5,
  },
  photoScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, gap: 26 },
  title: {
    color: '#FF3B6B',
    fontFamily: MONO,
    fontSize: 26,
    letterSpacing: 1,
    textAlign: 'center',
  },
  photoFrame: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#FF3B6B',
    overflow: 'hidden',
  },
  redWash: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(224,36,94,0.22)' },
  flash: { backgroundColor: '#fff' },
});
