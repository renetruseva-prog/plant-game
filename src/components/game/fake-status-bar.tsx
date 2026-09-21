import { StyleSheet, Text, View } from 'react-native';

import { family } from '@/game/fonts';
import type { Palette } from '@/game/theme';

/**
 * An in-app status strip. It exists so the evil plant has chrome to corrupt:
 * the clock, the carrier and the battery all turn against the player.
 */
export function FakeStatusBar({ palette, evil }: { palette: Palette; evil: boolean }) {
  const tint = evil ? '#FF6F95' : palette.ink;
  return (
    <View style={styles.bar}>
      <Text style={[styles.clock, { color: tint, fontFamily: family('semibold', evil) }]}>
        {evil ? '3:33' : '9:41'}
      </Text>
      <View style={styles.right}>
        <Text style={[styles.net, { color: tint, fontFamily: family('semibold', evil) }]}>
          {evil ? 'SPECIMEN' : 'LTE'}
        </Text>
        <View style={[styles.batt, { borderColor: tint }]}>
          <View
            style={[
              styles.battFill,
              { backgroundColor: evil ? '#FF3B6B' : tint, width: evil ? '6%' : '100%' },
            ]}
          />
        </View>
        <View style={[styles.battTip, { backgroundColor: tint }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: 28,
    paddingHorizontal: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  clock: { fontSize: 15 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  net: { fontSize: 13 },
  batt: { width: 26, height: 12, borderWidth: 1.5, borderRadius: 4, padding: 1.5, opacity: 0.9 },
  battFill: { height: '100%', borderRadius: 1.5 },
  battTip: { width: 2, height: 4, borderRadius: 1, marginLeft: -5 },
});
