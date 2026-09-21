import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { FONTS } from '@/game/fonts';
import type { EndingKind } from '@/game/types';

type Props = {
  visible: boolean;
  onJump: (level: number) => void;
  onForce: (ending: EndingKind) => void;
  onReset: () => void;
  onClose: () => void;
};

function DevButton({ label, hot, onPress }: { label: string; hot?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.btn, hot && styles.btnHot]}>
      <Text style={styles.btnText}>{label}</Text>
    </Pressable>
  );
}

/**
 * Demo recovery controls, reachable only by long-pressing the specimen number.
 * Not a player-facing feature: it exists so a live demo can jump straight to a
 * level or an ending instead of tapping eighteen times.
 */
export function DevPanel({ visible, onJump, onForce, onReset, onClose }: Props) {
  if (!visible) return null;
  return (
    <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(150)} style={styles.panel}>
      <Text style={styles.heading}>Demo controls</Text>

      <View style={styles.row}>
        {[1, 2, 3, 4].map((n) => (
          <DevButton key={n} label={`Level ${n}`} onPress={() => onJump(n)} />
        ))}
      </View>

      <View style={styles.row}>
        <DevButton label="Good ending" onPress={() => onForce('good')} />
        <DevButton label="Neutral ending" onPress={() => onForce('neutral')} />
        <DevButton label="Bad ending" hot onPress={() => onForce('bad')} />
      </View>

      <View style={styles.row}>
        <DevButton label="Reset" onPress={onReset} />
        <DevButton label="Close" onPress={onClose} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    left: 14,
    right: 14,
    top: 52,
    zIndex: 60,
    backgroundColor: '#0F1611',
    borderRadius: 18,
    padding: 14,
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 16,
  },
  heading: { color: '#E4ECE6', fontSize: 13, fontFamily: FONTS.bold },
  row: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  btn: {
    borderWidth: 1,
    borderColor: '#3A4A3F',
    backgroundColor: '#18221B',
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 11,
  },
  btnHot: { backgroundColor: '#E0245E', borderColor: '#E0245E' },
  btnText: { color: '#E4ECE6', fontSize: 13, fontFamily: FONTS.medium },
});
