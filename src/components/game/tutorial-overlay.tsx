import type { ReactNode } from 'react';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { ActionIcon, type IconKind } from '@/components/game/action-icon';
import { LEVELS } from '@/game/copy';
import { family } from '@/game/fonts';
import type { Palette } from '@/game/theme';

/** How far down the screen the Close/Skip button is moved, as a fraction of its height. */
const SKIP_DROP = 0.2;

/** How far the demo "finger" travels along its track, in px. */
const DEMO_TRAVEL = 34;
const TRACK_SIZE = DEMO_TRAVEL + 10;

function IconChip({ icon, palette, size = 22 }: { icon: IconKind; palette: Palette; size?: number }) {
  return (
    <View style={[styles.iconChip, { borderColor: palette.line, backgroundColor: palette.paper }]}>
      <ActionIcon kind={icon} color={palette.ink} size={size} />
    </View>
  );
}

function Caption({ palette, children }: { palette: Palette; children: string }) {
  return (
    <Text style={[styles.demoCaption, { color: palette.dim, fontFamily: family('medium', false) }]}>
      {children}
    </Text>
  );
}

/**
 * A looping animated dot sliding toward the water/sun icon, in the actual
 * direction that gesture needs - the icon alone says "this is water", but
 * says nothing about *how* to trigger it. The motion is the instruction.
 */
function DragDemo({ direction, icon, palette }: { direction: 'down' | 'up'; icon: IconKind; palette: Palette }) {
  const t = useDerivedValue(() => withRepeat(withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) }), -1, false));

  const dotStyle = useAnimatedStyle(() => {
    const y =
      direction === 'down'
        ? interpolate(t.value, [0, 1], [0, DEMO_TRAVEL])
        : interpolate(t.value, [0, 1], [DEMO_TRAVEL, 0]);
    // Fades in just after resetting and out just before the loop cuts, so
    // the reset itself is never visible as a jump.
    const opacity = interpolate(t.value, [0, 0.12, 0.82, 1], [0, 1, 1, 0]);
    return { transform: [{ translateY: y }], opacity };
  });

  const chip = <IconChip icon={icon} palette={palette} size={26} />;
  const track = (
    <View style={styles.track}>
      <Animated.View style={[styles.dragDot, { backgroundColor: palette.accent }, dotStyle]} />
    </View>
  );

  return (
    <View style={styles.demoCol}>
      {direction === 'up' ? chip : null}
      {track}
      {direction === 'down' ? chip : null}
    </View>
  );
}

/**
 * A pulsing ring around a still fingertip - the visual for "press and hold",
 * timed to roughly the real hold duration so the loop itself hints at how
 * long is long enough.
 */
function HoldDemo({ palette }: { palette: Palette }) {
  const t = useDerivedValue(() => withRepeat(withTiming(1, { duration: 1200, easing: Easing.out(Easing.quad) }), -1, false));

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 0.35 + t.value }],
    opacity: interpolate(t.value, [0, 0.1, 0.7, 1], [0, 0.55, 0.2, 0]),
  }));

  return (
    <View style={styles.demoCol}>
      <View style={styles.track}>
        <Animated.View style={[styles.holdRing, { borderColor: palette.accent }, ringStyle]} />
        <View style={[styles.holdDot, { backgroundColor: palette.ink }]} />
      </View>
      <IconChip icon="stroke" palette={palette} size={26} />
    </View>
  );
}

/** A fingertip wiggling rapidly in place - shaking it by hand. */
function FingerShakeDemo({ palette }: { palette: Palette }) {
  const t = useDerivedValue(() => withRepeat(withTiming(1, { duration: 130, easing: Easing.linear }), -1, true));

  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(t.value, [0, 1], [-12, 12]) }],
  }));

  return (
    <View style={styles.demoCol}>
      <View style={styles.track}>
        <Animated.View style={[styles.shakeDot, { backgroundColor: palette.accent }, dotStyle]} />
      </View>
      <IconChip icon="shake" palette={palette} size={26} />
      <Caption palette={palette}>With your finger</Caption>
    </View>
  );
}

/** A little phone glyph rattling side to side - shaking the device itself. */
function PhoneShakeDemo({ palette }: { palette: Palette }) {
  const t = useDerivedValue(() => withRepeat(withTiming(1, { duration: 90, easing: Easing.linear }), -1, true));

  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(t.value, [0, 1], [-9, 9])}deg` }],
  }));

  return (
    <View style={styles.demoCol}>
      <View style={styles.track}>
        <Animated.View
          style={[styles.phoneGlyph, { borderColor: palette.ink, backgroundColor: palette.paper }, style]}
        />
      </View>
      {/* Spacer matching the height of the icon chip the other demos in this
       *  row have, so all three captions/rows still line up along the bottom. */}
      <View style={styles.phoneSpacer} />
      <Caption palette={palette}>Or shake the phone</Caption>
    </View>
  );
}

type Page = {
  title: string;
  body: string;
  icons?: IconKind[];
  /** Rendered instead of `icons` when present - see the `demo*` components
   *  above and `pagesFor`, which closes over the current `palette` so these
   *  never need to take it as an argument themselves. */
  demo?: () => ReactNode;
};

/** Built fresh on every render from the current `palette`, rather than a
 *  module-level constant - the demos need the live theme, and stashing it in
 *  an outside-of-render mutable variable would fight this project's React
 *  Compiler, which assumes render functions are pure. */
function pagesFor(palette: Palette): Page[] {
  return [
    {
      title: 'Water it',
      body: 'Drag down over it. It doesn’t have to start on the plant - anywhere above it works too, like pouring from a can.',
      demo: () => <DragDemo direction="down" icon="water" palette={palette} />,
    },
    {
      title: 'Give it light',
      body: 'Drag up over it to lift it toward the light.',
      demo: () => <DragDemo direction="up" icon="sun" palette={palette} />,
    },
    {
      title: 'Show it affection',
      body: 'Hold your finger still on it for about a second.',
      demo: () => <HoldDemo palette={palette} />,
    },
    {
      title: 'Handle it roughly',
      body: 'A fast drag or a couple of quick taps shakes it - so does shaking the phone itself. It remembers either way.',
      demo: () => (
        <>
          <FingerShakeDemo palette={palette} />
          <PhoneShakeDemo palette={palette} />
        </>
      ),
    },
    {
      title: 'It feels the real world',
      body: 'Walk around with it and it sways along. The room’s real light wakes it up or puts it to sleep.',
      icons: ['walk', 'moon'],
    },
    {
      title: 'Five stages, three fates',
      body: `${LEVELS.map((l) => l.name).join(' → ')}. How you treat it decides whether it blooms, gets by, or turns on you.`,
    },
  ];
}

type Props = {
  palette: Palette;
  visible: boolean;
  onFinish: () => void;
  /** `'onboarding'` (the default) precedes a run and its last page starts
   *  play. `'help'` is reopened mid-run from the Stage's "?" chip - same
   *  pages, but it's just a look-up, so the copy says so instead of implying
   *  a new run is about to begin. */
  mode?: 'onboarding' | 'help';
};

/**
 * A short, skippable walkthrough shown before every new run - first launch
 * and every "Start a new specimen" alike - and reachable again at any time
 * mid-run via the Stage's help chip (`mode: 'help'`). Six pages, one gesture
 * (or topic) each, forward-only, with Skip/Close pinned in the corner the
 * whole time: quick to click through, but there if it's needed.
 */
export function TutorialOverlay({ palette, visible, onFinish, mode = 'onboarding' }: Props) {
  const [page, setPage] = useState(0);
  const t = useDerivedValue(() =>
    withTiming(visible ? 1 : 0, { duration: 400, easing: Easing.out(Easing.quad) })
  );

  // Reset to page 0 the moment a fresh showing starts. Adjusting state while
  // rendering (rather than in an effect) is the supported way to react to a
  // prop change, and `lastVisible` being state rather than a ref means this
  // only fires on the actual false->true edge, not on every render.
  const [lastVisible, setLastVisible] = useState(visible);
  if (visible !== lastVisible) {
    setLastVisible(visible);
    if (visible) setPage(0);
  }

  const style = useAnimatedStyle(() => ({ opacity: t.value, display: t.value === 0 ? 'none' : 'flex' }));

  const { height: screenH } = useWindowDimensions();
  const pages = pagesFor(palette);
  const isLast = page === pages.length - 1;
  const current = pages[page];

  return (
    <Animated.View
      style={[styles.wrap, { backgroundColor: palette.screen }, style]}
      pointerEvents={visible ? 'auto' : 'none'}>
      <Pressable
        accessibilityRole="button"
        onPress={onFinish}
        // Dropped a fraction of the screen height below its base position,
        // well clear of the notch/status area where it was hard to reach.
        style={[styles.skip, { top: 18 + screenH * SKIP_DROP }]}
        hitSlop={10}>
        <ActionIcon kind={mode === 'help' ? 'close' : 'skip'} color={palette.dim} size={20} />
        <Text style={[styles.skipText, { color: palette.dim, fontFamily: family('semibold', false) }]}>
          {mode === 'help' ? 'Close' : 'Skip'}
        </Text>
      </Pressable>

      <View style={styles.body}>
        <Text style={[styles.title, { color: palette.ink, fontFamily: family('black', false) }]}>
          {current.title}
        </Text>
        <Text style={[styles.copy, { color: palette.ink, fontFamily: family('body', false) }]}>
          {current.body}
        </Text>

        {current.demo ? (
          <View style={styles.demoRow}>{current.demo()}</View>
        ) : current.icons && current.icons.length > 0 ? (
          <View style={styles.demoRow}>
            {current.icons.map((icon) => (
              <IconChip key={icon} icon={icon} palette={palette} size={24} />
            ))}
          </View>
        ) : null}
      </View>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {pages.map((_, i) => (
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
            {isLast ? (mode === 'help' ? 'Got it' : 'Start') : 'Next'}
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
  skip: { position: 'absolute', left: 20, zIndex: 1, padding: 8, flexDirection: 'row', alignItems: 'center', gap: 6 },
  skipText: { fontSize: 17.5 },
  body: { flex: 1, justifyContent: 'center', gap: 14 },
  title: { fontSize: 32, lineHeight: 36, letterSpacing: -0.6 },
  copy: { fontSize: 16.5, lineHeight: 25 },
  demoRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 22, marginTop: 10 },
  iconChip: {
    width: 52,
    height: 52,
    borderRadius: 18,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  demoCol: { alignItems: 'center', gap: 8 },
  track: { height: TRACK_SIZE, width: TRACK_SIZE, alignItems: 'center', justifyContent: 'center' },
  dragDot: { position: 'absolute', top: (TRACK_SIZE - DEMO_TRAVEL) / 2, width: 14, height: 14, borderRadius: 7 },
  holdRing: { position: 'absolute', width: 32, height: 32, borderRadius: 16, borderWidth: 2 },
  holdDot: { width: 12, height: 12, borderRadius: 6 },
  shakeDot: { width: 14, height: 14, borderRadius: 7 },
  phoneGlyph: { width: 22, height: 36, borderRadius: 5, borderWidth: 1.8 },
  phoneSpacer: { height: 52 },
  demoCaption: { fontSize: 11.5, maxWidth: 74, textAlign: 'center' },
  footer: { gap: 20, alignItems: 'center' },
  dots: { flexDirection: 'row', gap: 8 },
  dot: { width: 7, height: 7, borderRadius: 3.5 },
  btn: { alignSelf: 'stretch', paddingVertical: 15, borderRadius: 999, alignItems: 'center' },
  btnText: { fontSize: 16 },
});
