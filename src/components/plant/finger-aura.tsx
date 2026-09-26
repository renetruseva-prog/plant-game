import { StyleSheet, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';

/** Colour per `auraKind` index (0 neutral, 1 affection, 2 water, 3 sun,
 *  4 rough) - see `useFingerAura`. Kept in sync with that mapping by index, not by name,
 *  since the shared value it reads is a plain number. Neutral is a soft leaf
 *  green rather than a plain white, so a touch that hasn't resolved into a
 *  specific gesture yet still feels like it belongs to the plant. */
const CORE_COLORS = ['#8FCB8F', '#FF7FA8', '#4FA6E8', '#F2B23A', '#E8493A'];

/**
 * Three concentric circles, largest and faintest on the outside, give a soft
 * glow without an SVG gradient - Reanimated can only animate props on an
 * actual rendered host component (a `View`, an SVG `Circle`...), and an SVG
 * `RadialGradient`/`Stop` never renders one, so those can't be driven from a
 * shared value directly. Plain `View`s sidestep that entirely, same as
 * `Particles`/`PulseRing` elsewhere in this folder.
 */
const LAYERS = [
  { size: 132, opacity: 0.09 },
  { size: 86, opacity: 0.18 },
  { size: 46, opacity: 0.42 },
];

type Props = {
  auraX: SharedValue<number>;
  auraY: SharedValue<number>;
  auraOpacity: SharedValue<number>;
  auraKind: SharedValue<number>;
};

function AuraLayer({
  size,
  baseOpacity,
  auraX,
  auraY,
  auraOpacity,
  auraKind,
}: Props & { size: number; baseOpacity: number }) {
  const style = useAnimatedStyle(() => ({
    opacity: baseOpacity * auraOpacity.value,
    backgroundColor: interpolateColor(auraKind.value, [0, 1, 2, 3, 4], CORE_COLORS),
    transform: [
      { translateX: auraX.value - size / 2 },
      { translateY: auraY.value - size / 2 },
    ],
  }));

  return (
    <Animated.View
      style={[styles.layer, { width: size, height: size, borderRadius: size / 2 }, style]}
    />
  );
}

/**
 * A soft glow that follows the finger anywhere on the stage, so it's always
 * visually obvious where the touch is landing. Colour previews the gesture
 * being read live, mirroring `TouchLayer`'s classification: white-ish while
 * merely touching, blue once a drag reads as watering, gold for sunlight,
 * red the instant it turns rough.
 */
export function FingerAura(props: Props) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {LAYERS.map((layer) => (
        <AuraLayer key={layer.size} size={layer.size} baseOpacity={layer.opacity} {...props} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', top: 0, left: 0 },
});
