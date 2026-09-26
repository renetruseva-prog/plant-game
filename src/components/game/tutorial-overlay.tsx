import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { ActionIcon, type IconKind } from '@/components/game/action-icon';
import { LEVELS } from '@/game/copy';
import { family } from '@/game/fonts';
import type { Palette } from '@/game/theme';

type Page = { title: string; body: string; icons: IconKind[] };

const PAGES: Page[] = [
  {
    title: 'Care for it',
    body: 'Water it, give it sunlight, or stroke it gently - all of it helps. Shake it and it will remember.',
    icons: ['water', 'sun', 'stroke', 'shake'],
  },
  {
    title: 'It feels the real world',
    body: 'Walk around with it and it sways along. The room’s real light wakes it up or puts it to sleep.',
    icons: ['walk', 'moon'],
  },
  {
    title: 'Five stages, three fates',
    body: `${LEVELS.map((l) => l.name).join(' → ')}. How you treat it decides whether it blooms, gets by, or turns on you.`,
    icons: [],
  },
];

type Props = {
  palette: Palette;
  visible: boolean;
  onFinish: () => void;
};

/**
 * A short, skippable walkthrough shown before every new run - first launch
 * and every "Start a new specimen" alike. Three pages, forward-only, with
 * Skip pinned in the corner the whole time: quick enough that skipping it
 * costs nothing, but there if the room hasn't seen the game before.
 */
export function TutorialOverlay({ palette, visible, onFinish }: Props) {
  const [page, setPage] = useState(0);
  const t = useSharedValue(visible ? 1 : 0);

  // Reset to page 0 the moment a fresh showing starts. Adjusting state while
  // rendering (rather than in an effect) is the supported way to react to a
  // prop change, and `lastVisible` being state rather than a ref means this
  // only fires on the actual false->true edge, not on every render.
  const [lastVisible, setLastVisible] = useState(visible);
  if (visible !== lastVisible) {
    setLastVisible(visible);
    if (visible) setPage(0);
  }

  useEffect(() => {
    t.value = withTiming(visible ? 1 : 0, { duration: 400, easing: Easing.out(Easing.quad) });
  }, [visible, t]);

  const style = useAnimatedStyle(() => ({ opacity: t.value, display: t.value === 0 ? 'none' : 'flex' }));

  const isLast = page === PAGES.length - 1;
  const current = PAGES[page];

  return (
    <Animated.View
      style={[styles.wrap, { backgroundColor: palette.screen }, style]}
      pointerEvents={visible ? 'auto' : 'none'}>
      <Pressable accessibilityRole="button" onPress={onFinish} style={styles.skip} hitSlop={10}>
        <Text style={[styles.skipText, { color: palette.dim, fontFamily: family('semibold', false) }]}>
          Skip
        </Text>
      </Pressable>

      <View style={styles.body}>
        <Text style={[styles.title, { color: palette.ink, fontFamily: family('black', false) }]}>
          {current.title}
        </Text>
        <Text style={[styles.copy, { color: palette.ink, fontFamily: family('body', false) }]}>
          {current.body}
        </Text>

        {current.icons.length > 0 ? (
          <View style={styles.icons}>
            {current.icons.map((icon) => (
              <View
                key={icon}
                style={[styles.iconChip, { borderColor: palette.line, backgroundColor: palette.paper }]}>
                <ActionIcon kind={icon} color={palette.ink} size={24} />
              </View>
            ))}
          </View>
        ) : null}
      </View>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {PAGES.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                { backgroundColor: i === page ? palette.accent : palette.line },
              ]}
            />
          ))}
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => (isLast ? onFinish() : setPage((p) => p + 1))}
          style={[styles.btn, { backgroundColor: palette.ink }]}>
          <Text style={[styles.btnText, { color: palette.screen, fontFamily: family('bold', false) }]}>
            {isLast ? 'Start' : 'Next'}
          </Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 31,
    justifyContent: 'space-between',
    paddingHorizontal: 30,
    paddingTop: 60,
    paddingBottom: 40,
  },
  skip: { position: 'absolute', top: 18, right: 20, zIndex: 1, padding: 8 },
  skipText: { fontSize: 14 },
  body: { flex: 1, justifyContent: 'center', gap: 14 },
  title: { fontSize: 32, lineHeight: 36, letterSpacing: -0.6 },
  copy: { fontSize: 16.5, lineHeight: 25 },
  icons: { flexDirection: 'row', gap: 10, marginTop: 6 },
  iconChip: {
    width: 52,
    height: 52,
    borderRadius: 18,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: { gap: 20, alignItems: 'center' },
  dots: { flexDirection: 'row', gap: 8 },
  dot: { width: 7, height: 7, borderRadius: 3.5 },
  btn: { alignSelf: 'stretch', paddingVertical: 15, borderRadius: 999, alignItems: 'center' },
  btnText: { fontSize: 16 },
});
