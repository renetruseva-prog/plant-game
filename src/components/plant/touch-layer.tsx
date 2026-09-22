import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { cancelAnimation, runOnJS, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { TOUCH } from '@/game/config';
import { getPlantGeometry, isOnPlant, toSvgSpace } from '@/game/plant-geometry';
import type { EndingKind } from '@/game/types';

type Props = {
  level: number;
  form: EndingKind | null;
  ending: EndingKind | null;
  /** True whenever a run isn't actively playable (intro, tutorial, ended). */
  disabled: boolean;
  onStroke: () => void;
  onShake: () => void;
  onPinch: () => void;
  /** Worklets, not the raw shared values - see `useEyeTracking`. */
  onTrackEyes: (dx: number, dy: number, pull: number) => void;
  onReleaseEyes: () => void;
};

/**
 * Lets the player touch the plant directly, on top of the Stroke/Shake
 * buttons and physically shaking the phone.
 *
 * A gentle touch or drag on the plant reads as a stroke; a fast drag, or a
 * few quick taps in a row, reads as a shake - the same gentle/aggressive
 * split the accelerometer already makes for physical shaking. A two-finger
 * pinch that starts on the plant squeezes its "cheeks" (see the `pinchKey`
 * squish in `Plant`) and counts as a stroke. Touching and sliding anywhere
 * else on the stage - not on the plant - makes its eyes follow the finger
 * instead of scoring anything.
 */
export function TouchLayer({
  level,
  form,
  ending,
  disabled,
  onStroke,
  onShake,
  onPinch,
  onTrackEyes,
  onReleaseEyes,
}: Props) {
  const containerW = useSharedValue(0);
  const containerH = useSharedValue(0);

  // Worklets close over these at gesture-creation time, so the latest props
  // are mirrored into shared values rather than read from a stale closure.
  const levelRef = useSharedValue(level);
  const formRef = useSharedValue<EndingKind | null>(form);
  const endingRef = useSharedValue<EndingKind | null>(ending);
  const disabledRef = useSharedValue(disabled);
  useEffect(() => {
    levelRef.value = level;
    formRef.value = form;
    endingRef.value = ending;
    disabledRef.value = disabled;
  });

  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const startOnPlant = useSharedValue(false);
  const maxVelocity = useSharedValue(0);
  const pinchOnPlant = useSharedValue(false);
  /** Counts quick taps in place; decays to 0 on its own if none follow
   *  within the window, via `withDelay` rather than a wall-clock read - a
   *  gesture worklet has no business calling `Date.now()`. */
  const tapCount = useSharedValue(0);

  const trackEyesAt = (x: number, y: number) => {
    'worklet';
    const svg = toSvgSpace(containerW.value, containerH.value, x, y);
    const { cx, cy } = getPlantGeometry(levelRef.value, formRef.value, endingRef.value);
    const dx = svg.x - cx;
    const dy = svg.y - cy;
    const mag = Math.hypot(dx, dy) || 1;
    // Full deflection by about a third of the stage's height away from the
    // plant; a finger right next to it doesn't need to swing the eyes hard.
    const pull = Math.min(1, mag / 120);
    onTrackEyes(dx / mag, dy / mag, pull);
  };

  const pan = Gesture.Pan()
    .maxPointers(1)
    .onBegin((e) => {
      'worklet';
      if (disabledRef.value) return;
      const svg = toSvgSpace(containerW.value, containerH.value, e.x, e.y);
      startOnPlant.value = isOnPlant(levelRef.value, formRef.value, endingRef.value, svg.x, svg.y);
      startX.value = e.x;
      startY.value = e.y;
      maxVelocity.value = 0;
      if (!startOnPlant.value) trackEyesAt(e.x, e.y);
    })
    .onUpdate((e) => {
      'worklet';
      if (disabledRef.value) return;
      const speed = Math.hypot(e.velocityX, e.velocityY);
      if (speed > maxVelocity.value) maxVelocity.value = speed;
      if (!startOnPlant.value) trackEyesAt(e.x, e.y);
    })
    .onEnd((e) => {
      'worklet';
      if (disabledRef.value) return;
      if (!startOnPlant.value) {
        onReleaseEyes();
        return;
      }

      const dist = Math.hypot(e.x - startX.value, e.y - startY.value);
      let aggressive = dist >= TOUCH.minDragForVelocity && maxVelocity.value >= TOUCH.aggressiveVelocity;

      if (dist < TOUCH.minDragForVelocity) {
        cancelAnimation(tapCount);
        tapCount.value += 1;
        if (tapCount.value >= TOUCH.rapidTapCount) {
          aggressive = true;
          tapCount.value = 0;
        } else {
          // Decays back to 0 unless another tap cancels this first.
          tapCount.value = withDelay(TOUCH.rapidTapWindowMs, withTiming(0, { duration: 0 }));
        }
      } else {
        cancelAnimation(tapCount);
        tapCount.value = 0;
      }

      if (aggressive) runOnJS(onShake)();
      else runOnJS(onStroke)();
    });

  const pinch = Gesture.Pinch()
    .onBegin((e) => {
      'worklet';
      if (disabledRef.value) return;
      const svg = toSvgSpace(containerW.value, containerH.value, e.focalX, e.focalY);
      pinchOnPlant.value = isOnPlant(levelRef.value, formRef.value, endingRef.value, svg.x, svg.y);
    })
    .onEnd(() => {
      'worklet';
      if (pinchOnPlant.value) {
        pinchOnPlant.value = false;
        runOnJS(onPinch)();
      }
    });

  // Pinch needs two fingers, Pan is capped at one, so whichever the touch
  // actually is naturally wins without the two ever fighting over it.
  const gesture = Gesture.Race(pinch, pan);

  return (
    <View
      style={StyleSheet.absoluteFill}
      onLayout={(e) => {
        containerW.value = e.nativeEvent.layout.width;
        containerH.value = e.nativeEvent.layout.height;
      }}>
      <GestureDetector gesture={gesture}>
        <View style={StyleSheet.absoluteFill} />
      </GestureDetector>
    </View>
  );
}
