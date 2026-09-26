import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useDerivedValue, withTiming } from 'react-native-reanimated';

import { THRESHOLDS } from '@/game/config';
import { LEVELS } from '@/game/copy';
import { family } from '@/game/fonts';
import type { Palette } from '@/game/theme';

type Props = { palette: Palette; evil: boolean; level: number; count: number };

function Segment({ filled, palette }: { filled: boolean; palette: Palette }) {
  const t = useDerivedValue(() => withTiming(filled ? 1 : 0, { duration: 400 }), [filled]);
  const style = useAnimatedStyle(() => ({ transform: [{ scaleX: t.value }] }));
  return (
    <View style={[styles.seg, { backgroundColor: palette.line }]}>
      <Animated.View style={[styles.segFill, { backgroundColor: palette.accent }, style]} />
    </View>
  );
}

function Node({ state, palette }: { state: 'done' | 'cur' | 'todo'; palette: Palette }) {
  const active = state !== 'todo';
  return (
    <View
      style={[
        styles.node,
        {
          backgroundColor: active ? palette.accent : palette.screen,
          borderColor: active ? palette.accent : palette.line,
        },
        state === 'cur' && { shadowColor: palette.accent, ...styles.nodeCurrent },
      ]}
    />
  );
}

/** The five-stage track, plus how many touches remain until the next stage. */
export function Progress({ palette, evil, level, count }: Props) {
  const remaining = level < 5 ? THRESHOLDS[level] - count : 0;

  return (
    <View style={styles.wrap}>
      <View style={styles.track}>
        {LEVELS.map((_, i) => {
          const n = i + 1;
          return (
            <View key={n} style={[styles.trackItem, n === 5 && styles.trackItemLast]}>
              <Node state={n < level ? 'done' : n === level ? 'cur' : 'todo'} palette={palette} />
              {n < 5 ? <Segment filled={n < level} palette={palette} /> : null}
            </View>
          );
        })}
      </View>

      <View style={styles.names}>
        {LEVELS.map((l, i) => (
          <Text
            key={l.name}
            numberOfLines={1}
            style={[
              styles.name,
              {
                color: i + 1 === level ? palette.ink : palette.dim,
                fontFamily: family(i + 1 === level ? 'bold' : 'body', evil),
              },
            ]}>
            {l.name}
          </Text>
        ))}
      </View>

      <Text style={[styles.remain, { color: palette.dim, fontFamily: family('body', evil) }]}>
        {level < 5
          ? `${remaining} more ${remaining === 1 ? 'interaction' : 'interactions'} until ${LEVELS[level].name}.`
          : 'Final form.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginHorizontal: 24, marginTop: 6 },
  track: { flexDirection: 'row', alignItems: 'center' },
  trackItem: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  // The last node has no trailing segment, so it must not claim a share.
  trackItemLast: { flex: 0 },
  node: { width: 14, height: 14, borderRadius: 7, borderWidth: 2 },
  nodeCurrent: { shadowOpacity: 0.35, shadowRadius: 5, shadowOffset: { width: 0, height: 0 }, elevation: 4 },
  seg: { flex: 1, height: 2, overflow: 'hidden' },
  segFill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, transformOrigin: 'left' },
  names: { flexDirection: 'row', marginTop: 6, marginHorizontal: -22 },
  name: { flex: 1, fontSize: 11, textAlign: 'center' },
  remain: { marginTop: 8, textAlign: 'center', fontSize: 12.5, minHeight: 16 },
});
