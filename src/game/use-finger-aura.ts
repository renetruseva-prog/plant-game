import { Easing, cancelAnimation, useSharedValue, withTiming } from 'react-native-reanimated';

/**
 * What the aura currently looks like, driven by the same live classification
 * `TouchLayer` uses for the actual gesture - so the glow tells the player
 * what's about to happen before they even lift their finger.
 */
export type AuraKind = 'neutral' | 'water' | 'sun' | 'rough';

/** `auraKind` is a plain number, not a string, because it has to live in a
 *  shared value and be read back inside a `useAnimatedProps` worklet.
 *
 *  Index 1 is reserved for affection (pink), sitting between neutral and the
 *  rest: a hold slides `auraKind` continuously from 0 to 1, and the colour
 *  blends between the two as it goes. Nothing else lands on a fraction. */
const KIND_INDEX: Record<AuraKind, number> = { neutral: 0, water: 2, sun: 3, rough: 4 };

/**
 * Owns the finger-aura's shared values and hands back worklet functions that
 * close over them - the same shape as `useEyeTracking`, and for the same
 * reason: a component that only received the shared values as props
 * couldn't write to them.
 */
export function useFingerAura() {
  const auraX = useSharedValue(0);
  const auraY = useSharedValue(0);
  const auraOpacity = useSharedValue(0);
  const auraKind = useSharedValue(0);

  const showAura = (x: number, y: number) => {
    'worklet';
    auraX.value = x;
    auraY.value = y;
    auraKind.value = KIND_INDEX.neutral;
    cancelAnimation(auraOpacity);
    auraOpacity.value = withTiming(1, { duration: 120 });
  };

  /** Follows the finger. Leave `kind` out to move the glow without touching
   *  its colour - a finger holding still shouldn't restart the slow fade to
   *  pink every time it wobbles a pixel. */
  const moveAura = (x: number, y: number, kind?: AuraKind) => {
    'worklet';
    auraX.value = x;
    auraY.value = y;
    if (kind !== undefined) auraKind.value = KIND_INDEX[kind];
  };

  /** Slowly turns the glow pink over `durationMs`, for a held finger. Any
   *  later `moveAura` with a kind takes over immediately. */
  const startAuraHold = (durationMs: number) => {
    'worklet';
    auraKind.value = withTiming(1, { duration: durationMs, easing: Easing.linear });
  };

  const hideAura = () => {
    'worklet';
    cancelAnimation(auraOpacity);
    auraOpacity.value = withTiming(0, { duration: 220 });
  };

  return { auraX, auraY, auraOpacity, auraKind, showAura, moveAura, startAuraHold, hideAura };
}
