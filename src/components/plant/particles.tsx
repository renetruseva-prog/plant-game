import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

export type ParticleKind = 'water' | 'sun' | 'heart' | 'petal' | 'thorn';

export type Burst = { id: number; kind: ParticleKind; count: number };

/** Falling particles come from the top, rising ones bloom out of the plant. */
const FALLS: Record<ParticleKind, boolean> = {
  water: true,
  petal: true,
  sun: false,
  heart: false,
  thorn: false,
};

const DURATION: Record<ParticleKind, number> = {
  water: 1000,
  petal: 2200,
  sun: 1200,
  heart: 1300,
  thorn: 900,
};

function Glyph({ kind }: { kind: ParticleKind }) {
  switch (kind) {
    case 'water':
      return (
        <Svg width={10} height={14} viewBox="0 0 10 14">
          <Path d="M5 0C5 0 0 6 0 9a5 5 0 0 0 10 0C10 6 5 0 5 0z" fill="#6BB6E8" />
        </Svg>
      );
    case 'sun':
      return (
        <Svg width={14} height={14} viewBox="0 0 14 14">
          <Path d="M7 0 8.7 5.3 14 7 8.7 8.7 7 14 5.3 8.7 0 7 5.3 5.3z" fill="#F6C945" />
        </Svg>
      );
    case 'heart':
      return (
        <Svg width={15} height={13} viewBox="0 0 14 12">
          <Path d="M7 12S0 7.6 0 3.6A3.6 3.6 0 0 1 7 2.2 3.6 3.6 0 0 1 14 3.6C14 7.6 7 12 7 12Z" fill="#FF6F91" />
        </Svg>
      );
    case 'petal':
      return (
        <Svg width={11} height={16} viewBox="0 0 11 16">
          <Path d="M5.5 0C8.5 4 11 7 11 10.5a5.5 5.5 0 0 1-11 0C0 7 2.5 4 5.5 0z" fill="#fff" stroke="#CFE0C8" strokeWidth={1.4} />
        </Svg>
      );
    case 'thorn':
      return (
        <Svg width={10} height={14} viewBox="0 0 10 14">
          <Path d="M5 0 10 14 5 10 0 14z" fill="#E0245E" />
        </Svg>
      );
  }
}

function Particle({ kind, index }: { kind: ParticleKind; index: number }) {
  const falls = FALLS[kind];
  // Flies once when the particle mounts; the parent unmounts it afterwards.
  const t = useDerivedValue(() =>
    withDelay(
      index * 80,
      withTiming(1, { duration: DURATION[kind], easing: falls ? Easing.in(Easing.quad) : Easing.out(Easing.quad) })
    )
  );

  // Fixed per particle so the drift doesn't resample on every render.
  const [seed] = useState(() => ({
    left: 28 + Math.random() * 44,
    dx: Math.random() * 70 - 35,
    rot: Math.random() * 120 - 60,
  }));

  const style = useAnimatedStyle(() => {
    const p = t.value;
    // Fade in quickly, then out across the rest of the flight.
    const opacity = p < 0.15 ? p / 0.15 : 1 - (p - 0.15) / 0.85;
    return {
      opacity,
      transform: [
        { translateX: seed.dx * p },
        { translateY: falls ? p * 230 - 10 : -p * 170 },
        { rotate: `${seed.rot * p}deg` },
        { scale: falls ? 1 : 0.6 + p * 0.5 },
      ],
    };
  });

  return (
    <Animated.View
      style={[styles.particle, { left: `${seed.left}%`, [falls ? 'top' : 'bottom']: falls ? '8%' : '34%' }, style]}
      pointerEvents="none">
      <Glyph kind={kind} />
    </Animated.View>
  );
}

export function Particles({ burst }: { burst: Burst | null }) {
  if (!burst || burst.count === 0) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {Array.from({ length: burst.count }, (_, i) => (
        // Keyed by burst id so a new burst mounts a fresh, re-animating set.
        <Particle key={`${burst.id}-${i}`} kind={burst.kind} index={i} />
      ))}
    </View>
  );
}

/** The expanding ring that marks a level-up. */
export function PulseRing({ pulseKey, color }: { pulseKey: number; color: string }) {
  const t = useSharedValue(1);

  // No ring on mount: it marks a change, not a starting state.
  const settled = useRef(false);
  useEffect(() => {
    if (!settled.current) {
      settled.current = true;
      return;
    }
    t.value = 0;
    t.value = withTiming(1, { duration: 800, easing: Easing.out(Easing.quad) });
  }, [pulseKey, t]);

  const style = useAnimatedStyle(() => ({
    opacity: (1 - t.value) * 0.9,
    transform: [{ scale: 0.4 + t.value * 6.6 }],
  }));

  return (
    <View style={styles.ringWrap} pointerEvents="none">
      <Animated.View style={[styles.ring, { borderColor: color }, style]} />
    </View>
  );
}

const styles = StyleSheet.create({
  particle: { position: 'absolute' },
  ringWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  ring: { width: 40, height: 40, borderRadius: 20, borderWidth: 3 },
});
