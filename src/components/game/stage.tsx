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
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { family } from '@/game/fonts';
import type { Palette } from '@/game/theme';
import type { Env } from '@/game/types';

type Props = {
  palette: Palette;
  evil: boolean;
  env: Env;
  /** Bumped to shake the whole stage on a rough interaction. */
  shakeKey: number;
  onRestart: () => void;
  restartDisabled: boolean;
  children: ReactNode;
};

function RestartIcon({ color }: { color: string }) {
  const p = { stroke: color, strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' } as const;
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24">
      <Path d="M4 12a8 8 0 1 1 2.5 5.8" {...p} />
      <Path d="M4 17v-5h5" {...p} />
    </Svg>
  );
}

export function Stage({
  palette,
  evil,
  env,
  shakeKey,
  onRestart,
  restartDisabled,
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
          onPress={onRestart}
          disabled={restartDisabled}
          accessibilityRole="button"
          accessibilityLabel="Restart the game"
          style={[
            styles.restart,
            env === 'dark' && styles.restartDark,
            restartDisabled && styles.restartDisabled,
          ]}>
          <RestartIcon color={env === 'dark' ? '#DCE6FF' : '#16251B'} />
          <Text
            style={[
              styles.envText,
              { fontFamily: family('semibold', false) },
              env === 'dark' && styles.envTextDark,
            ]}>
            Restart
          </Text>
        </Pressable>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  stage: { flex: 1, marginHorizontal: 16, marginTop: 12, overflow: 'hidden' },
  restart: {
    position: 'absolute',
    top: 12,
    left: 12,
    zIndex: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.72)',
  },
  restartDark: { backgroundColor: 'rgba(255,255,255,0.16)' },
  restartDisabled: { opacity: 0.4 },
  envText: { fontSize: 12.5, color: '#16251B' },
  envTextDark: { color: '#DCE6FF' },
});
