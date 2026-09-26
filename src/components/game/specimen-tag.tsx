import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';

import { family } from '@/game/fonts';
import type { Palette } from '@/game/theme';

type Props = {
  palette: Palette;
  evil: boolean;
  /** Displayed specimen number, stable for the run. */
  mark: string;
  level: number;
  latin: string;
  stageName: string;
  goal: string;
  /** How many specimens this device has raised, counting this one. Shown
   *  from the second onward - "Gen 1" would just be clutter on a first run. */
  generation: number;
  onSecretHold: () => void;
};

/**
 * The header reads as a botanical collection label: punched hole, specimen
 * number, species name. Long-pressing the number is the hidden demo control.
 */
export function SpecimenTag({
  palette,
  evil,
  mark,
  level,
  latin,
  stageName,
  goal,
  generation,
  onSecretHold,
}: Props) {
  return (
    <Animated.View
      layout={LinearTransition.duration(400)}
      style={[
        styles.tag,
        {
          backgroundColor: palette.paper,
          borderColor: palette.line,
          borderRadius: palette.radius,
        },
      ]}>
      <View style={[styles.hole, { backgroundColor: palette.screen, borderColor: palette.line }]} />

      <View style={styles.top}>
        <Pressable onLongPress={onSecretHold} delayLongPress={650} hitSlop={10}>
          <Text style={[styles.meta, { color: palette.dim, fontFamily: family('medium', evil) }]}>
            {mark}
          </Text>
        </Pressable>
        <Text style={[styles.meta, { color: palette.dim, fontFamily: family('medium', evil) }]}>
          Level {level} of 5{generation > 1 ? ` · Gen ${generation}` : ''}
        </Text>
      </View>

      <Text
        style={[
          styles.latin,
          { color: palette.ink, fontFamily: family('latin', evil), letterSpacing: palette.tracking },
        ]}>
        {latin}
      </Text>

      <Text style={[styles.goal, { color: palette.ink, fontFamily: family('body', evil) }]}>
        <Text style={{ fontFamily: family('bold', evil) }}>{stageName}.</Text> {goal}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  tag: {
    marginHorizontal: 16,
    borderWidth: 1.5,
    paddingTop: 11,
    paddingBottom: 12,
    paddingRight: 16,
    paddingLeft: 46,
  },
  hole: {
    position: 'absolute',
    left: 17,
    top: '50%',
    marginTop: -7,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
  },
  top: { flexDirection: 'row', justifyContent: 'space-between' },
  meta: { fontSize: 12 },
  latin: { marginTop: 2, fontSize: 28, lineHeight: 32 },
  goal: { marginTop: 5, fontSize: 13.5, lineHeight: 18 },
});
