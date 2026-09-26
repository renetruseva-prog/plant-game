import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import {
  cancelAnimation,
  runOnJS,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { TOUCH } from '@/game/config';
import type { AuraKind } from '@/game/use-finger-aura';
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
  /** A deliberate downward drag over the plant - pouring water on it. */
  onWater: () => void;
  /** A deliberate upward drag over the plant - lifting it toward the light. */
  onSun: () => void;
  /** Worklets, not the raw shared values - see `useEyeTracking`. */
  onTrackEyes: (dx: number, dy: number, pull: number) => void;
  onReleaseEyes: () => void;
  /** Worklets driving the finger-aura glow - see `useFingerAura`. Reported
   *  for every touch on the stage, not only ones that land on the plant. */
  onAuraShow: (x: number, y: number) => void;
  onAuraMove: (x: number, y: number, kind?: AuraKind) => void;
  onAuraHold: (durationMs: number) => void;
  onAuraHide: () => void;
};

/**
 * Lets the player touch the plant directly, on top of the Stroke/Shake
 * buttons and physically shaking the phone.
 *
 * A gentle touch or a short/ambiguous drag on the plant reads as a stroke; a
 * fast drag, or a few quick taps in a row, reads as a shake - the same
 * gentle/aggressive split the accelerometer already makes for physical
 * shaking. A longer drag that's clearly mostly-vertical instead reads as a
 * deliberate gesture: down to water it, up to lift it toward the light. A
 * two-finger pinch that starts on the plant squeezes its "cheeks" (see the
 * `pinchKey` squish in `Plant`) and counts as a stroke. Touching and sliding
 * anywhere else on the stage - not on the plant - makes its eyes follow the
 * finger instead of scoring anything, *unless* it's a downward drag that
 * lands on the plant - a pour doesn't have to start with a finger already on
 * it, the way a pet or a shake does; it can start anywhere above and travel
 * down onto it, like actually pouring from a watering can.
 */
export function TouchLayer({
  level,
  form,
  ending,
  disabled,
  onStroke,
  onShake,
  onPinch,
  onWater,
  onSun,
  onTrackEyes,
  onReleaseEyes,
  onAuraShow,
  onAuraMove,
  onAuraHold,
  onAuraHide,
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
  /** Set the instant a drag on the plant crosses the aggressive threshold,
   *  so the flinch fires live rather than waiting for the finger to lift,
   *  and `onEnd` doesn't then double-count the same rough slide. */
  const firedAggressive = useSharedValue(false);
  /** Set once a still hold on the plant has already scored as a stroke, so
   *  lifting the finger afterwards doesn't score it a second time. */
  const firedHold = useSharedValue(false);
  /** A dummy value whose only job is to carry a delayed animation - its
   *  completion callback is what actually fires the hold-stroke. */
  const holdTimer = useSharedValue(0);
  /** Counts quick taps in place; decays to 0 on its own if none follow
   *  within the window, via `withDelay` rather than a wall-clock read - a
   *  gesture worklet has no business calling `Date.now()`. */
  const tapCount = useSharedValue(0);
  /** Set the instant a drag that started off the plant pours onto it, so it
   *  can't fire twice for one touch and so `onEnd` knows not to treat the
   *  same touch as a plain eye-tracking release. */
  const firedPour = useSharedValue(false);

  /**
   * Whether the direction *so far* looks like a vertical drag, regardless of
   * how far it's actually travelled yet. Used to hold off the aggressive
   * live-fire below while a water/sun drag is still forming: that check's
   * own distance floor (`minDragForVelocity`, 18px) is smaller than the full
   * commit distance a directional drag needs (`directionalDragMinDistance`,
   * 30px) - without this, any brisk-but-straight drag gets judged a shake
   * the moment it crosses 18px, before it ever gets the chance to cross 30.
   */
  const looksVertical = (dx: number, dy: number): boolean => {
    'worklet';
    return Math.abs(dy) >= Math.abs(dx) * TOUCH.directionalAngleRatio;
  };

  /** Whether a drag has gone far enough, in a direction that's looked
   *  vertical the whole way, to commit to water/sun rather than a pet. */
  const isDirectional = (dx: number, dy: number, dist: number): boolean => {
    'worklet';
    return dist >= TOUCH.directionalDragMinDistance && looksVertical(dx, dy);
  };

  /** The same direction/speed read `onEnd` uses to score the gesture, run
   *  live on every move so the aura can preview what's about to happen. */
  const liveKind = (dx: number, dy: number, dist: number, speed: number): AuraKind => {
    'worklet';
    // Previews as soon as it's plausibly a vertical slide, well before the
    // gesture actually commits (see `directionalPreviewDistance`).
    if (dist >= TOUCH.directionalPreviewDistance && looksVertical(dx, dy)) {
      return dy < 0 ? 'sun' : 'water';
    }
    // Still forming, but heading somewhere vertical - don't flash red for a
    // gesture that might commit to water/sun a moment from now.
    if (looksVertical(dx, dy)) return 'neutral';
    if (firedAggressive.value || (dist >= TOUCH.minDragForVelocity && speed >= TOUCH.aggressiveVelocity)) {
      return 'rough';
    }
    return 'neutral';
  };

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
      firedAggressive.value = false;
      firedHold.value = false;
      firedPour.value = false;
      onAuraShow(e.x, e.y);

      if (!startOnPlant.value) {
        trackEyesAt(e.x, e.y);
        return;
      }

      // The aura slowly warms to pink over the same time it takes for the
      // hold to score, so the glow shows how far along the affection is.
      onAuraHold(TOUCH.holdDurationMs);

      // Holding still on the plant scores as a stroke on its own, live,
      // without waiting for the finger to lift - a long, gentle touch is
      // exactly the kind of thing that should count as one.
      cancelAnimation(holdTimer);
      holdTimer.value = withDelay(
        TOUCH.holdDurationMs,
        withTiming(1, { duration: 0 }, (finished) => {
          'worklet';
          if (finished && !firedHold.value && !firedAggressive.value) {
            firedHold.value = true;
            runOnJS(onStroke)();
          }
        })
      );
    })
    .onUpdate((e) => {
      'worklet';
      if (disabledRef.value) return;
      const speed = Math.hypot(e.velocityX, e.velocityY);
      if (speed > maxVelocity.value) maxVelocity.value = speed;

      if (!startOnPlant.value) {
        const dx = e.x - startX.value;
        const dy = e.y - startY.value;
        const dist = Math.hypot(dx, dy);

        // A pour: started off the plant, travelled far enough straight down,
        // and the finger is now actually over the plant. Fires live, the
        // moment it lands, the same way a hold or a shake reacts immediately
        // rather than waiting for release.
        if (!firedPour.value && dy > 0 && isDirectional(dx, dy, dist)) {
          const svg = toSvgSpace(containerW.value, containerH.value, e.x, e.y);
          if (isOnPlant(levelRef.value, formRef.value, endingRef.value, svg.x, svg.y)) {
            firedPour.value = true;
            onAuraMove(e.x, e.y, 'water');
            runOnJS(onWater)();
            return;
          }
        }

        trackEyesAt(e.x, e.y);
        // Blue for the whole slide, not just once it lands on the plant -
        // it's already rain from the moment it's clearly heading down, and
        // it should stay blue after the pour has fired rather than dropping
        // back to plain green mid-gesture.
        const raining =
          firedPour.value ||
          (dy > 0 && dist >= TOUCH.directionalPreviewDistance && looksVertical(dx, dy));
        onAuraMove(e.x, e.y, raining ? 'water' : 'neutral');
        return;
      }

      const dx = e.x - startX.value;
      const dy = e.y - startY.value;
      const dist = Math.hypot(dx, dy);
      // A finger still holding on the plant keeps its slow fade to pink;
      // only actual movement (or a gesture forming) sets a colour outright.
      const kind = liveKind(dx, dy, dist, speed);
      const stillHolding = dist < TOUCH.holdCancelDistance || firedHold.value;
      if (kind === 'neutral' && stillHolding) onAuraMove(e.x, e.y);
      else onAuraMove(e.x, e.y, kind);

      // It's no longer a still hold the moment there's real movement - a
      // much smaller bar than `minDragForVelocity`, which answers a
      // different question (tap vs. drag) and would otherwise let a slow
      // water/sun drag sit under it long enough for the hold to fire first.
      if (dist >= TOUCH.holdCancelDistance) cancelAnimation(holdTimer);

      // A rough slide flinches the moment it's rough, not once the finger
      // finally lifts - it should feel like an immediate reaction. Skipped
      // whenever the drag still looks vertical, not just once it's already
      // covered the full commit distance - see `looksVertical`. Covering the
      // 30px+ needed for water/sun in a hurry is still watering it, not
      // shaking it.
      if (
        !firedAggressive.value &&
        !looksVertical(dx, dy) &&
        dist >= TOUCH.minDragForVelocity &&
        speed >= TOUCH.aggressiveVelocity
      ) {
        firedAggressive.value = true;
        cancelAnimation(tapCount);
        tapCount.value = 0;
        runOnJS(onShake)();
      }
    })
    .onEnd((e) => {
      'worklet';
      if (disabledRef.value) return;
      if (!startOnPlant.value) {
        onReleaseEyes();
        return;
      }
      // Already reacted mid-gesture - a hold or a rough slide - so this
      // release shouldn't score the same touch a second time.
      if (firedAggressive.value || firedHold.value) return;

      const dx = e.x - startX.value;
      const dy = e.y - startY.value;
      const dist = Math.hypot(dx, dy);
      // Direction gets first say: `maxVelocity` only ever remembers a peak
      // speed, not which way the finger was going when it hit that peak, so
      // a fast-but-clean vertical drag must never be second-guessed into a
      // shake just because it also happened to cover ground quickly.
      const directional = isDirectional(dx, dy, dist);
      let aggressive = !directional && dist >= TOUCH.minDragForVelocity && maxVelocity.value >= TOUCH.aggressiveVelocity;

      if (dist < TOUCH.minDragForVelocity) {
        // A single gentle tap is a stroke; once a rapid streak reaches the
        // threshold, every further tap in that same streak reads as a shake
        // too - not just the one that happened to cross it - until a pause
        // lets the counter decay back down, or a real drag interrupts it.
        cancelAnimation(tapCount);
        tapCount.value += 1;
        if (tapCount.value >= TOUCH.rapidTapCount) aggressive = true;
        tapCount.value = withDelay(TOUCH.rapidTapWindowMs, withTiming(0, { duration: 0 }));
        if (aggressive) runOnJS(onShake)();
        else runOnJS(onStroke)();
        return;
      }

      cancelAnimation(tapCount);
      tapCount.value = 0;

      // A long, mostly-vertical drag reads as a deliberate gesture rather
      // than a pet: down to water, up toward the light - checked before
      // `aggressive`, so speed can't overrule a clean direction. Anything
      // shorter or more diagonal falls back to an ordinary stroke, or a
      // shake if it was genuinely fast and erratic.
      if (directional) {
        if (dy < 0) runOnJS(onSun)();
        else runOnJS(onWater)();
      } else if (aggressive) {
        runOnJS(onShake)();
      } else {
        runOnJS(onStroke)();
      }
    })
    // Fires for every way the gesture can conclude - a clean release, a
    // failure, or being pre-empted by the pinch winning the race - so the
    // hold timer can never keep ticking past a touch that's already over.
    .onFinalize(() => {
      'worklet';
      cancelAnimation(holdTimer);
      onAuraHide();
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
