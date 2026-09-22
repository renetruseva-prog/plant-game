import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { family } from '@/game/fonts';
import type { Palette } from '@/game/theme';
import type { Env } from '@/game/types';

type Props = {
  palette: Palette;
  evil: boolean;
  env: Env;
  /** A real light sensor is driving the room; the badge becomes a read-out. */
  sensorDriven: boolean;
  /** Live lux reading while sensor-driven, for the read-out label. */
  lux: number | null;
  onToggleEnv: () => void;
  /** Bumped to shake the whole stage on a rough interaction. */
  shakeKey: number;
  children: ReactNode;
};

export function Stage({
  palette,
  evil,
  env,
  sensorDriven,
  lux,
  onToggleEnv,
  shakeKey,
  children,
}: Props) {
  const shake = useSharedValue(0);

  useEffect(() => {
    if (shakeKey === 0) return;
    shake.value = withSequence(
      withTiming(-1, { duration: 60, easing: Easing.linear }),
      withRepeat(withTiming(1, { duration: 55, easing: Easing.linear }), 5, true),
      withTiming(0, { duration: 60 })
    );
  }, [shakeKey, shake]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: shake.value * 7 }, { translateY: shake.value * -2 }],
  }));

  return (
    <Animated.View
      style={[styles.stage, { borderRadius: palette.radius + 8 }, style]}
      collapsable={false}>
      <Svg style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="bg" x1="0" y1="0" x2="0.35" y2="1">
            <Stop offset="0" stopColor={palette.stageTop} />
            <Stop offset="1" stopColor={palette.stageBottom} />
          </LinearGradient>
          <LinearGradient id="sheen" x1="0" y1="0" x2="1" y2="0.4">
            <Stop offset="0.28" stopColor="#ffffff" stopOpacity={0} />
            <Stop offset="0.4" stopColor="#ffffff" stopOpacity={0.42} />
            <Stop offset="0.52" stopColor="#ffffff" stopOpacity={0.12} />
            <Stop offset="0.62" stopColor="#ffffff" stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width="100%" height="100%" fill="url(#bg)" />
        {/* A shaft of daylight across the glass; gone at night and in the dark ending. */}
        {env === 'day' && !evil ? (
          <Rect x={0} y={0} width="100%" height="100%" fill="url(#sheen)" />
        ) : null}
      </Svg>

      {children}

      {!evil ? (
        <Pressable
          // Sensor-driven rooms aren't tappable: a manual override would just
          // be reverted by the next real reading a fraction of a second
          // later, which reads as a bug rather than as the sensor working.
          onPress={sensorDriven ? undefined : onToggleEnv}
          disabled={sensorDriven}
          accessibilityRole={sensorDriven ? 'text' : 'switch'}
          accessibilityState={sensorDriven ? undefined : { checked: env === 'day' }}
          accessibilityLabel={sensorDriven ? 'Room light, from the light sensor' : 'Room light'}
          style={[styles.env, env === 'dark' && styles.envDark]}>
          <Text
            style={[
              styles.envText,
              { fontFamily: family('semibold', false) },
              env === 'dark' && styles.envTextDark,
            ]}>
            {sensorDriven
              ? `${env === 'day' ? 'Bright' : 'Dark'} · ${lux !== null ? `${Math.round(lux)} lux` : '…'}`
              : env === 'day'
                ? 'Curtains open'
                : 'Curtains shut'}
          </Text>
          <View style={[styles.knob, env === 'dark' && styles.knobDark]}>
            <View style={[styles.knobDot, env === 'dark' && styles.knobDotDark]} />
          </View>
        </Pressable>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  stage: { flex: 1, marginHorizontal: 16, marginTop: 12, overflow: 'hidden' },
  env: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingLeft: 12,
    paddingRight: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.72)',
  },
  envDark: { backgroundColor: 'rgba(255,255,255,0.16)' },
  envText: { fontSize: 12.5, color: '#16251B' },
  envTextDark: { color: '#DCE6FF' },
  knob: { width: 34, height: 20, borderRadius: 999, backgroundColor: '#F6C945', justifyContent: 'center' },
  knobDark: { backgroundColor: '#4A5B8C' },
  knobDot: { position: 'absolute', left: 16, width: 16, height: 16, borderRadius: 8, backgroundColor: '#fff' },
  knobDotDark: { left: 2 },
});
