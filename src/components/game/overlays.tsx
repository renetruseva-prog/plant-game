import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';

import { ENDINGS } from '@/game/copy';
import { family } from '@/game/fonts';
import type { Palette } from '@/game/theme';
import type { EndingKind, Scores } from '@/game/types';

/** The seed, drawn once for the title card. */
function SeedMark() {
  return (
    <Svg width={86} height={86} viewBox="0 0 86 86">
      <Ellipse cx={43} cy={46} rx={26} ry={20} fill="#9A7449" stroke="#16251B" strokeWidth={2.5} />
      <Circle cx={34} cy={43} r={3.2} fill="#16251B" />
      <Circle cx={52} cy={43} r={3.2} fill="#16251B" />
      <Path d="M37 53q6 5 12 0" stroke="#16251B" strokeWidth={2.5} fill="none" strokeLinecap="round" />
    </Svg>
  );
}

export function IntroOverlay({
  palette,
  visible,
  onStart,
}: {
  palette: Palette;
  visible: boolean;
  onStart: () => void;
}) {
  const t = useSharedValue(visible ? 1 : 0);

  useEffect(() => {
    t.value = withTiming(visible ? 1 : 0, { duration: 480, easing: Easing.out(Easing.quad) });
  }, [visible, t]);

  // Kept mounted so it can fade out; pointer events follow `visible`.
  const style = useAnimatedStyle(() => ({ opacity: t.value, display: t.value === 0 ? 'none' : 'flex' }));

  return (
    <Animated.View
      style={[styles.intro, { backgroundColor: palette.screen }, style]}
      pointerEvents={visible ? 'auto' : 'none'}>
      <SeedMark />
      <Text style={[styles.introTitle, { color: palette.ink, fontFamily: family('black', false) }]}>
        Specimen
      </Text>
      <Text style={[styles.introLatin, { color: palette.dim, fontFamily: family('latin', false) }]}>
        Planta incognita
      </Text>
      <Text style={[styles.introBody, { color: palette.ink, fontFamily: family('body', false) }]}>
        A specimen arrived. Nobody knows what it will grow into. Look after it and find out.
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={onStart}
        style={[styles.btn, { backgroundColor: palette.ink }]}>
        <Text style={[styles.btnText, { color: palette.screen, fontFamily: family('bold', false) }]}>
          Start
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const STAT_ROWS: [keyof Scores, string][] = [
  ['care', 'Care'],
  ['light', 'Light'],
  ['attention', 'Attention'],
  ['roughness', 'Rough'],
];

export function EndingSheet({
  palette,
  evil,
  kind,
  visible,
  scores,
  onRestart,
  onOpenGallery,
}: {
  palette: Palette;
  evil: boolean;
  kind: EndingKind | null;
  visible: boolean;
  scores: Scores;
  onRestart: () => void;
  onOpenGallery: () => void;
}) {
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = withTiming(visible ? 1 : 0, {
      duration: 550,
      easing: Easing.bezier(0.2, 0.9, 0.3, 1),
    });
  }, [visible, t]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - t.value) * 520 }],
  }));

  if (!kind) return null;
  const copy = ENDINGS[kind];

  return (
    <Animated.View
      style={[
        styles.sheet,
        { backgroundColor: palette.paper, borderColor: palette.line, borderRadius: palette.radius + 12 },
        style,
      ]}
      pointerEvents={visible ? 'auto' : 'none'}>
      <Text style={[styles.sheetTitle, { color: palette.ink, fontFamily: family('black', evil) }]}>
        {copy.title}
      </Text>
      <Text style={[styles.sheetLatin, { color: palette.dim, fontFamily: family('latin', evil) }]}>
        {copy.latin}
      </Text>
      <Text style={[styles.sheetBody, { color: palette.ink, fontFamily: family('body', evil) }]}>
        {copy.body}
      </Text>

      <View style={styles.stats}>
        {STAT_ROWS.map(([key, label]) => (
          <View key={key} style={[styles.stat, { borderColor: palette.line, borderRadius: palette.radius - 4 }]}>
            <Text style={[styles.statValue, { color: palette.ink, fontFamily: family('bold', evil) }]}>
              {scores[key]}
            </Text>
            <Text style={[styles.statLabel, { color: palette.dim, fontFamily: family('body', evil) }]}>
              {label}
            </Text>
          </View>
        ))}
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={onRestart}
        style={[styles.btn, styles.sheetBtn, { backgroundColor: evil ? '#FF3B6B' : palette.ink }]}>
        <Text
          style={[
            styles.btnText,
            { color: evil ? '#14001C' : palette.screen, fontFamily: family('bold', evil) },
          ]}>
          Start a new specimen
        </Text>
      </Pressable>

      <Pressable accessibilityRole="button" onPress={onOpenGallery} style={styles.galleryLink} hitSlop={8}>
        <Text style={[styles.galleryLinkText, { color: palette.dim, fontFamily: family('semibold', evil) }]}>
          View past specimens
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  intro: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 30,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 34,
    gap: 14,
  },
  introTitle: { fontSize: 46, lineHeight: 50, letterSpacing: -1.4 },
  introLatin: { fontSize: 19 },
  introBody: { fontSize: 16, lineHeight: 24, textAlign: 'center', maxWidth: 300 },
  btn: { paddingVertical: 15, paddingHorizontal: 34, borderRadius: 999, marginTop: 10 },
  btnText: { fontSize: 16 },

  sheet: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 10,
    zIndex: 25,
    borderWidth: 1.5,
    padding: 22,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -10 },
    elevation: 12,
  },
  sheetTitle: { fontSize: 30, lineHeight: 34, letterSpacing: -0.6 },
  sheetLatin: { fontSize: 18, marginTop: 4, marginBottom: 10 },
  sheetBody: { fontSize: 15, lineHeight: 22, marginBottom: 14 },
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, borderWidth: 1.5, paddingVertical: 8, alignItems: 'center' },
  statValue: { fontSize: 22 },
  statLabel: { fontSize: 11.5 },
  sheetBtn: { width: '100%', alignItems: 'center' },
  galleryLink: { alignSelf: 'center', marginTop: 12, padding: 4 },
  galleryLinkText: { fontSize: 13 },
});
