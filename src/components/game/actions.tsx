import { useCallback } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

import { ACTION_LABELS } from '@/game/copy';
import { family } from '@/game/fonts';
import type { Palette } from '@/game/theme';

export type TapKind = 'water' | 'sun' | 'stroke' | 'shake';

function Icon({ kind, color }: { kind: TapKind; color: string }) {
  const p = { stroke: color, strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' } as const;
  switch (kind) {
    case 'water':
      return (
        <Svg width={28} height={28} viewBox="0 0 24 24">
          <Path d="M12 3S5 11 5 15a7 7 0 0 0 14 0c0-4-7-12-7-12z" {...p} />
        </Svg>
      );
    case 'sun':
      return (
        <Svg width={28} height={28} viewBox="0 0 24 24">
          <Circle cx={12} cy={12} r={4} {...p} />
          <Path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" {...p} />
        </Svg>
      );
    case 'stroke':
      return (
        <Svg width={28} height={28} viewBox="0 0 24 24">
          <Path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" {...p} />
        </Svg>
      );
    case 'shake':
      return (
        <Svg width={28} height={28} viewBox="0 0 24 24">
          <Path d="M2 12l4-6 4 12 4-12 4 12 4-6" {...p} />
        </Svg>
      );
  }
}

function ActionButton({
  kind,
  palette,
  evil,
  disabled,
  onPress,
}: {
  kind: TapKind;
  palette: Palette;
  evil: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const pressed = useSharedValue(0);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: 1 - pressed.value * 0.06 }] }));
  const fillStyle = useAnimatedStyle(() => ({ opacity: pressed.value }));

  const onPressIn = useCallback(() => {
    pressed.set(withTiming(1, { duration: 90 }));
  }, [pressed]);

  const onPressOut = useCallback(() => {
    pressed.set(withSpring(0, { damping: 14, stiffness: 240 }));
  }, [pressed]);

  const label = ACTION_LABELS[evil ? 'evil' : 'normal'][kind];

  return (
    <Animated.View style={[styles.actWrap, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        disabled={disabled}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        onPress={onPress}
        style={[
          styles.act,
          {
            backgroundColor: palette.paper,
            borderColor: palette.line,
            borderRadius: palette.radius + 4,
            opacity: disabled ? 0.4 : 1,
          },
        ]}>
        {/* Inverts to the ink colour while held, matching the reference. */}
        <Animated.View
          style={[StyleSheet.absoluteFill, { backgroundColor: palette.ink, borderRadius: palette.radius + 4 }, fillStyle]}
          pointerEvents="none"
        />
        <Icon kind={kind} color={palette.ink} />
        <Text style={[styles.actLabel, { color: palette.ink, fontFamily: family('semibold', evil) }]}>
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

type Props = {
  palette: Palette;
  evil: boolean;
  disabled: boolean;
  onTap: (kind: TapKind) => void;
  onOutside: () => void;
  outsideBusy: boolean;
  outsideDone: boolean;
};

export function Actions({
  palette,
  evil,
  disabled,
  onTap,
  onOutside,
  outsideBusy,
  outsideDone,
}: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {(['water', 'sun', 'stroke', 'shake'] as TapKind[]).map((kind) => (
          <ActionButton
            key={kind}
            kind={kind}
            palette={palette}
            evil={evil}
            disabled={disabled}
            onPress={() => onTap(kind)}
          />
        ))}
      </View>

      {!evil ? (
        <Pressable
          accessibilityRole="button"
          disabled={disabled || outsideBusy}
          onPress={onOutside}
          style={[
            styles.outside,
            { borderColor: palette.line, backgroundColor: palette.paper, borderRadius: palette.radius + 4 },
            (disabled || outsideBusy) && { opacity: 0.5 },
          ]}>
          {outsideBusy ? (
            <ActivityIndicator size="small" color={palette.ink} />
          ) : (
            <Text style={[styles.outsideText, { color: palette.ink, fontFamily: family('semibold', evil) }]}>
              {outsideDone ? 'Take it outside again' : 'Take me outside'}
            </Text>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingTop: 12, gap: 10 },
  row: { flexDirection: 'row', gap: 10 },
  actWrap: { flex: 1 },
  act: {
    borderWidth: 1.5,
    paddingTop: 12,
    paddingBottom: 10,
    alignItems: 'center',
    gap: 6,
    overflow: 'hidden',
  },
  actLabel: { fontSize: 13 },
  outside: { borderWidth: 1.5, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', minHeight: 44 },
  outsideText: { fontSize: 13.5 },
});
