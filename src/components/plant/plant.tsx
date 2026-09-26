import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg from 'react-native-svg';

import { FALL } from '@/game/config';
import { VIEW_H, VIEW_W } from '@/game/plant-geometry';
import type { EndingKind, Mood } from '@/game/types';

import { PlantArt, PotArt, SlumpedPlantArt, SpilledPotArt } from './plant-art';

/** How the plant follows the phone's motion - see `smoothTilt` in `Plant`. */
const TRACK_SPRING = { damping: 22, stiffness: 150, mass: 0.7 } as const;

export { VIEW_H, VIEW_W };

type Props = {
  level: number;
  mood: Mood;
  /** Tendency at level 4, or the locked-in ending at level 5. */
  form: EndingKind | null;
  ending: EndingKind | null;
  /** 0..1 share of the run that was rough. Tints the head as it sours. */
  roughRatio: number;
  /** Bumped on every level-up to fire the pop. */
  popKey: number;
  /** Bumped whenever the plant is pinched, to fire the cheek-squeeze. */
  pinchKey: number;
  /** Live device tilt, -1..1. */
  tilt?: SharedValue<number>;
  /** Live pupil offset while a finger drags elsewhere on the stage. */
  eyeX: SharedValue<number>;
  eyeY: SharedValue<number>;
  /** Live rotation (degrees, signed, roughly ±180) as the phone turns - see
   *  `useUpsideDown`. Lets the plant visibly follow the gesture in real
   *  time, rather than only reacting once the fall is already decided. */
  fallAngle?: SharedValue<number>;
};

export function Plant({
  level,
  mood,
  form,
  ending,
  roughRatio,
  popKey,
  pinchKey,
  tilt,
  eyeX,
  eyeY,
  fallAngle,
}: Props) {
  const breathe = useSharedValue(0);
  const sway = useSharedValue(0);
  const jitter = useSharedValue(0);
  const pop = useSharedValue(1);
  const squish = useSharedValue(1);
  /** 0 = normal/alive, 1 = fully showing the toppled scene. Animates the
   *  crossfade between them once the fall is confirmed. */
  const fellReveal = useSharedValue(0);

  // The sensors only report ~20 times a second, so following them directly
  // makes the plant move in 20Hz steps on a 60/120Hz screen. These follow
  // the raw values with a spring instead, so every frame in between is
  // interpolated. Slightly overdamped: tracking should feel fluid, not bouncy.
  const smoothTilt = useSharedValue(0);
  const smoothFall = useSharedValue(0);
  useAnimatedReaction(
    () => tilt?.value ?? 0,
    (target) => {
      smoothTilt.value = withSpring(target, TRACK_SPRING);
    }
  );
  useAnimatedReaction(
    () => fallAngle?.value ?? 0,
    (target, prev) => {
      // The angle wraps from +180 to -180; springing across that would spin
      // the plant the long way round, so a wrap snaps instead.
      if (prev !== null && Math.abs(target - prev) > 180) {
        cancelAnimation(smoothFall);
        smoothFall.value = target;
      } else {
        smoothFall.value = withSpring(target, TRACK_SPRING);
      }
    }
  );

  // One looping driver per mood; the unused ones are parked at 0 so the styles
  // below can simply sum their contributions.
  useEffect(() => {
    cancelAnimation(breathe);
    cancelAnimation(sway);
    cancelAnimation(jitter);

    if (ending === 'fell') {
      // Dead and still - no breathing, no sway, no jitter.
      breathe.value = withTiming(0, { duration: 200 });
      sway.value = withTiming(0, { duration: 200 });
      jitter.value = withTiming(0, { duration: 200 });
      return;
    }

    const slow = mood === 'sleep';
    breathe.value = 0;
    breathe.value = withRepeat(
      withTiming(1, { duration: slow ? 3500 : 2000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );

    if (mood === 'happy' || mood === 'sway') {
      sway.value = withRepeat(
        withTiming(1, { duration: 550, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );
    } else {
      sway.value = withTiming(0, { duration: 260 });
    }

    if (mood === 'hurt') {
      jitter.value = withRepeat(withTiming(1, { duration: 80, easing: Easing.linear }), -1, true);
    } else {
      jitter.value = withTiming(0, { duration: 160 });
    }
  }, [mood, ending, breathe, sway, jitter]);

  // Skip the very first pass so the plant doesn't pop just for existing.
  const settled = useRef(false);
  useEffect(() => {
    if (!settled.current) {
      settled.current = true;
      return;
    }
    pop.value = 0.86;
    pop.value = withSpring(1, { damping: 7, stiffness: 190, mass: 0.6 });
  }, [popKey, pop]);

  // A pinch squeezes it sideways and lets it bounce back, distinct from the
  // level-up pop: cheeks compress in, then spring out again.
  const settledPinch = useRef(false);
  useEffect(() => {
    if (!settledPinch.current) {
      settledPinch.current = true;
      return;
    }
    squish.value = 0.8;
    squish.value = withSpring(1, { damping: 5, stiffness: 260, mass: 0.5 });
  }, [pinchKey, squish]);

  // Reveals the fallen scene once the ending actually locks in, fading the
  // live plant out as the toppled one fades in underneath. Skipped on a
  // fresh mount that's already fallen (a restored, already-finished run) -
  // there's nothing to animate into, and reset instantly on a new specimen.
  const settledFall = useRef(false);
  useEffect(() => {
    if (!settledFall.current) {
      settledFall.current = true;
      fellReveal.value = ending === 'fell' ? 1 : 0;
      return;
    }
    if (ending === 'fell') {
      fellReveal.value = withDelay(
        FALL.revealDelayMs,
        withTiming(1, { duration: FALL.revealDurationMs, easing: Easing.out(Easing.quad) })
      );
    } else {
      fellReveal.value = 0;
    }
  }, [ending, fellReveal]);

  const style = useAnimatedStyle(() => {
    const swayDeg = (sway.value * 2 - 1) * 3.5;
    const jitterDeg = (jitter.value * 2 - 1) * 2;
    const jitterX = (jitter.value * 2 - 1) * 3;
    const leanDeg = smoothTilt.value * 3;

    // Ordinary handling shifts the phone's angle constantly; only a real,
    // deliberate turn beyond the deadzone should visibly tip the plant, and
    // it should track the rest of that turn directly, 1:1.
    const raw = smoothFall.value;
    const fallDeg = Math.sign(raw) * Math.max(0, Math.abs(raw) - FALL.deadzoneDeg);

    // Once it's actually fallen, keep drooping and dropping a little further
    // as the toppled scene fades in, rather than freezing mid-motion.
    const dropDeg = fellReveal.value * 22;
    const dropY = fellReveal.value * 34;

    return {
      opacity: 1 - fellReveal.value,
      transform: [
        { translateX: jitterX },
        { translateY: dropY },
        { rotate: `${swayDeg + jitterDeg + leanDeg + fallDeg + dropDeg}deg` },
        { scaleX: pop.value * squish.value * (1 + breathe.value * 0.015) },
        { scaleY: pop.value * (2 - squish.value) * (1 + breathe.value * 0.03) },
      ],
    };
  });

  const potFadeStyle = useAnimatedStyle(() => ({ opacity: 1 - fellReveal.value }));
  const fellFadeStyle = useAnimatedStyle(() => ({ opacity: fellReveal.value }));


  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Upright pot: visible through normal play, and still through a live
          upside-down gesture (it hasn't tipped yet, only the plant is
          leaning) - fades out once it's actually fallen. */}
      <Animated.View style={[StyleSheet.absoluteFill, potFadeStyle]}>
        <Svg style={StyleSheet.absoluteFill} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="xMidYMax meet">
          <PotArt />
        </Svg>
      </Animated.View>

      {ending === 'fell' ? (
        <Animated.View style={[StyleSheet.absoluteFill, fellFadeStyle]}>
          <Svg style={StyleSheet.absoluteFill} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="xMidYMax meet">
            <SpilledPotArt />
          </Svg>
        </Animated.View>
      ) : null}

      <Animated.View style={[StyleSheet.absoluteFill, styles.origin, style]}>
        <Svg style={StyleSheet.absoluteFill} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="xMidYMax meet">
          <PlantArt level={level} mood={mood} form={form} ending={ending} roughRatio={roughRatio} eyeX={eyeX} eyeY={eyeY} />
        </Svg>
      </Animated.View>

      {ending === 'fell' ? (
        <Animated.View style={[StyleSheet.absoluteFill, fellFadeStyle]}>
          <Svg style={StyleSheet.absoluteFill} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="xMidYMax meet">
            <SlumpedPlantArt level={level} mood={mood} form={form} ending={ending} roughRatio={roughRatio} eyeX={eyeX} eyeY={eyeY} />
          </Svg>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // Anchor the growth at the soil line (y=300 of 380) rather than the centre.
  origin: { transformOrigin: '50% 79%' },
});

/** Sleepy "z"s float beside the head; rendered outside the SVG so they can fade. */
export function SleepZs({ visible }: { visible: boolean }) {
  const a = useDerivedValue(() =>
    visible
      ? withRepeat(withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }), -1, true)
      : withTiming(0, { duration: 200 })
  );

  const one = useAnimatedStyle(() => ({ opacity: a.value * 0.9, transform: [{ translateY: -a.value * 10 }] }));
  const two = useAnimatedStyle(() => ({
    opacity: (1 - a.value) * 0.7,
    transform: [{ translateY: -(1 - a.value) * 14 }],
  }));

  if (!visible) return null;
  return (
    <View style={zStyles.wrap} pointerEvents="none">
      <Animated.Text style={[zStyles.z, one]}>z</Animated.Text>
      <Animated.Text style={[zStyles.z, zStyles.small, two]}>z</Animated.Text>
    </View>
  );
}

const zStyles = StyleSheet.create({
  wrap: { position: 'absolute', top: '24%', right: '30%', flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  z: { color: '#DCE6FF', fontSize: 22, fontStyle: 'italic', fontWeight: '600' },
  small: { fontSize: 15 },
});
