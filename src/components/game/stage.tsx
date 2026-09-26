import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useDerivedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { ActionIcon } from '@/components/game/action-icon';
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
  onOpenGallery: () => void;
  onOpenHelp: () => void;
  children: ReactNode;
};

function RestartIcon({ color }: { color: string }) {
  const p = { stroke: color, strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' } as const;
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24">
      {/* A counter-clockwise arrow: the hook and the arc share an endpoint
       *  (1,10), so the tail reads as one continuous stroke instead of a
       *  loose line poking out of the circle. */}
      <Path d="M1 4v6h6" {...p} />
      <Path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" {...p} />
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
  onOpenGallery,
  onOpenHelp,
  children,
}: Props) {
  // A new shakeKey restarts the judder; key 0 means "nothing has shaken yet".
  const shake = useDerivedValue(() =>
    shakeKey === 0
      ? 0
      : withSequence(
          withTiming(-1, { duration: 60, easing: Easing.linear }),
          withRepeat(withTiming(1, { duration: 55, easing: Easing.linear }), 5, true),
          withTiming(0, { duration: 60 })
        )
  );

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
        <View style={styles.topLeftRow}>
          <Pressable
            onPress={onRestart}
            disabled={restartDisabled}
            accessibilityRole="button"
            accessibilityLabel="Restart the game"
            hitSlop={6}
            style={[
              styles.chip,
              env === 'dark' && styles.chipDark,
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

          {/* Bigger and clearly a button - icon plus label, same pill
           *  language as Restart/the light toggle, not a bare glyph tucked
           *  into a text row where it reads as decoration. */}
          <Pressable
            onPress={onOpenGallery}
            accessibilityRole="button"
            accessibilityLabel="Past specimens"
            hitSlop={6}
            style={[styles.chip, env === 'dark' && styles.chipDark]}>
            <ActionIcon kind="gallery" color={env === 'dark' ? '#DCE6FF' : '#16251B'} size={16} />
            <Text
              style={[
                styles.envText,
                { fontFamily: family('semibold', false) },
                env === 'dark' && styles.envTextDark,
              ]}>
              Gallery
            </Text>
          </Pressable>

          {/* Icon-only: "?" needs no label to read as help, and keeps this
           *  row from crowding on narrower phones. Reopens the gesture
           *  tutorial without touching game state - see `onOpenHelp`. */}
          <Pressable
            onPress={onOpenHelp}
            accessibilityRole="button"
            accessibilityLabel="How to play"
            hitSlop={6}
            style={[styles.chip, styles.iconOnlyChip, env === 'dark' && styles.chipDark]}>
            <ActionIcon kind="help" color={env === 'dark' ? '#DCE6FF' : '#16251B'} size={18} />
          </Pressable>
        </View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  stage: { flex: 1, marginHorizontal: 16, marginTop: 12, overflow: 'hidden' },
  topLeftRow: {
    position: 'absolute',
    top: 12,
    left: 12,
    zIndex: 4,
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    minHeight: 36,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.72)',
  },
  chipDark: { backgroundColor: 'rgba(255,255,255,0.16)' },
  iconOnlyChip: { paddingHorizontal: 9, gap: 0 },
  restartDisabled: { opacity: 0.4 },
  envText: { fontSize: 12.5, color: '#16251B' },
  envTextDark: { color: '#DCE6FF' },
});
