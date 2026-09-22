import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';

import { FALL } from '@/game/config';
import { getPlantGeometry, VIEW_H, VIEW_W } from '@/game/plant-geometry';
import type { EndingKind, Mood } from '@/game/types';

import { Face } from './face';

const INK = '#16251B';
export { VIEW_H, VIEW_W };

const hexToRgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

function mix(a: string, b: string, k: number) {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  return (
    '#' +
    A.map((v, i) => Math.round(v + (B[i] - v) * k).toString(16).padStart(2, '0')).join('')
  );
}

type Props = {
  level: number;
  mood: Mood;
  /** Tendency at level 4, or the locked-in ending at level 5. */
  form: EndingKind | null;
  ending: EndingKind | null;
  /** 0..1 share of the run that was rough. Tints the head as it sours. */
  roughRatio: number;
  /** Bumped on every level-up to fire the pop. */
  popKey: number;
  /** Bumped whenever the plant is pinched, to fire the cheek-squeeze. */
  pinchKey: number;
  /** Live device tilt, -1..1. */
  tilt?: SharedValue<number>;
  /** Live pupil offset while a finger drags elsewhere on the stage. */
  eyeX: SharedValue<number>;
  eyeY: SharedValue<number>;
  /** Live rotation (degrees, signed, roughly ±180) as the phone turns - see
   *  `useUpsideDown`. Lets the plant visibly follow the gesture in real
   *  time, rather than only reacting once the fall is already decided. */
  fallAngle?: SharedValue<number>;
};

export function Plant({
  level,
  mood,
  form,
  ending,
  roughRatio,
  popKey,
  pinchKey,
  tilt,
  eyeX,
  eyeY,
  fallAngle,
}: Props) {
  const breathe = useSharedValue(0);
  const sway = useSharedValue(0);
  const jitter = useSharedValue(0);
  const pop = useSharedValue(1);
  const squish = useSharedValue(1);
  /** 0 = normal/alive, 1 = fully showing the toppled scene. Animates the
   *  crossfade between them once the fall is confirmed. */
  const fellReveal = useSharedValue(0);

  // One looping driver per mood; the unused ones are parked at 0 so the styles
  // below can simply sum their contributions.
  useEffect(() => {
    cancelAnimation(breathe);
    cancelAnimation(sway);
    cancelAnimation(jitter);

    if (ending === 'fell') {
      // Dead and still - no breathing, no sway, no jitter.
      breathe.value = withTiming(0, { duration: 200 });
      sway.value = withTiming(0, { duration: 200 });
      jitter.value = withTiming(0, { duration: 200 });
      return;
    }

    const slow = mood === 'sleep';
    breathe.value = 0;
    breathe.value = withRepeat(
      withTiming(1, { duration: slow ? 3500 : 2000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );

    if (mood === 'happy' || mood === 'sway') {
      sway.value = withRepeat(
        withTiming(1, { duration: 550, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );
    } else {
      sway.value = withTiming(0, { duration: 260 });
    }

    if (mood === 'hurt') {
      jitter.value = withRepeat(withTiming(1, { duration: 80, easing: Easing.linear }), -1, true);
    } else {
      jitter.value = withTiming(0, { duration: 160 });
    }
  }, [mood, ending, breathe, sway, jitter]);

  // Skip the very first pass so the plant doesn't pop just for existing.
  const settled = useRef(false);
  useEffect(() => {
    if (!settled.current) {
      settled.current = true;
      return;
    }
    pop.value = 0.86;
    pop.value = withSpring(1, { damping: 7, stiffness: 190, mass: 0.6 });
  }, [popKey, pop]);

  // A pinch squeezes it sideways and lets it bounce back, distinct from the
  // level-up pop: cheeks compress in, then spring out again.
  const settledPinch = useRef(false);
  useEffect(() => {
    if (!settledPinch.current) {
      settledPinch.current = true;
      return;
    }
    squish.value = 0.8;
    squish.value = withSpring(1, { damping: 5, stiffness: 260, mass: 0.5 });
  }, [pinchKey, squish]);

  // Reveals the fallen scene once the ending actually locks in, fading the
  // live plant out as the toppled one fades in underneath. Skipped on a
  // fresh mount that's already fallen (a restored, already-finished run) -
  // there's nothing to animate into, and reset instantly on a new specimen.
  const settledFall = useRef(false);
  useEffect(() => {
    if (!settledFall.current) {
      settledFall.current = true;
      fellReveal.value = ending === 'fell' ? 1 : 0;
      return;
    }
    if (ending === 'fell') {
      fellReveal.value = withDelay(
        FALL.revealDelayMs,
        withTiming(1, { duration: FALL.revealDurationMs, easing: Easing.out(Easing.quad) })
      );
    } else {
      fellReveal.value = 0;
    }
  }, [ending, fellReveal]);

  const style = useAnimatedStyle(() => {
    const swayDeg = (sway.value * 2 - 1) * 3.5;
    const jitterDeg = (jitter.value * 2 - 1) * 2;
    const jitterX = (jitter.value * 2 - 1) * 3;
    const leanDeg = (tilt?.value ?? 0) * 3;

    // Ordinary handling shifts the phone's angle constantly; only a real,
    // deliberate turn beyond the deadzone should visibly tip the plant, and
    // it should track the rest of that turn directly, 1:1.
    const raw = fallAngle?.value ?? 0;
    const fallDeg = Math.sign(raw) * Math.max(0, Math.abs(raw) - FALL.deadzoneDeg);

    // Once it's actually fallen, keep drooping and dropping a little further
    // as the toppled scene fades in, rather than freezing mid-motion.
    const dropDeg = fellReveal.value * 22;
    const dropY = fellReveal.value * 34;

    return {
      opacity: 1 - fellReveal.value,
      transform: [
        { translateX: jitterX },
        { translateY: dropY },
        { rotate: `${swayDeg + jitterDeg + leanDeg + fallDeg + dropDeg}deg` },
        { scaleX: pop.value * squish.value * (1 + breathe.value * 0.015) },
        { scaleY: pop.value * (2 - squish.value) * (1 + breathe.value * 0.03) },
      ],
    };
  });

  const potFadeStyle = useAnimatedStyle(() => ({ opacity: 1 - fellReveal.value }));
  const fellFadeStyle = useAnimatedStyle(() => ({ opacity: fellReveal.value }));

  const { cx, cy, r, stemH } = getPlantGeometry(level, form, ending);

  let head =
    ending === 'fell'
      ? '#A98F63'
      : level === 1
        ? '#9A7449'
        : ending === 'bad'
          ? '#2B1140'
          : ending === 'good'
            ? '#F6C945'
            : ending === 'neutral'
              ? '#8DBF6A'
              : mix('#86CF74', '#6D4C93', Math.min(1, roughRatio * 2.2));
  if (form === 'bad' && !ending) head = mix(head, '#3A1858', 0.5);

  const stemC = ending === 'bad' ? '#3B1D57' : '#3E9B57';
  const leafC = ending === 'bad' ? '#4A2270' : ending === 'good' ? '#4DB262' : '#5FAE5B';

  /** Point a fraction `f` up the stem, following its curve. */
  const at = (f: number): [number, number] => [150 + (cx - 150) * f * f, 300 - stemH * f];

  const leafPath = (size: number) =>
    `M0 0C${size * 0.4} ${-size * 0.55} ${size * 0.95} ${-size * 0.4} ${size} ${-size * 0.05}C${
      size * 0.6
    } ${size * 0.3} ${size * 0.2} ${size * 0.25} 0 0Z`;

  const bladePath = (dx: number, h: number, cv: number) =>
    `M${150 + dx} 304Q${150 + dx + cv * 0.4} ${304 - h * 0.6} ${150 + dx + cv} ${304 - h}`;

  const leaves: [number, number, number][] =
    level === 2
      ? [
          [0.8, 1, 26],
          [0.8, -1, 26],
        ]
      : level === 3
        ? [
            [0.4, 1, 38],
            [0.4, -1, 38],
            [0.72, 1, 34],
            [0.72, -1, 34],
          ]
        : [
            [0.28, 1, 50],
            [0.28, -1, 50],
            [0.52, 1, 46],
            [0.52, -1, 46],
            [0.76, 1, 40],
            [0.76, -1, 40],
          ];

  const stemD = `M150 302Q150 ${300 - stemH * 0.5} ${cx} ${cy}`;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Upright pot: visible through normal play, and still through a live
          upside-down gesture (it hasn't tipped yet, only the plant is
          leaning) - fades out once it's actually fallen. */}
      <Animated.View style={[StyleSheet.absoluteFill, potFadeStyle]}>
        <Svg style={StyleSheet.absoluteFill} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="xMidYMax meet">
          <Ellipse cx={150} cy={370} rx={76} ry={7} fill="rgba(0,0,0,0.16)" />
          <Path
            d="M94 306h112l-11 62h-90z"
            fill="#F4F6F0"
            stroke={INK}
            strokeWidth={2.4}
            strokeLinejoin="round"
          />
          <Rect x={88} y={298} width={124} height={14} rx={6} fill="#F4F6F0" stroke={INK} strokeWidth={2.4} />
          <Ellipse cx={150} cy={300} rx={58} ry={7} fill="#4A3B2F" />
        </Svg>
      </Animated.View>

      {ending === 'fell' ? (
        <Animated.View style={[StyleSheet.absoluteFill, fellFadeStyle]}>
          <Svg style={StyleSheet.absoluteFill} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="xMidYMax meet">
            {/* Knocked on its side, the soil pouring out and across the shelf. */}
            <Ellipse cx={150} cy={372} rx={92} ry={8} fill="rgba(0,0,0,0.14)" />
            <G transform="rotate(-12 95 320)">
              <Rect x={40} y={296} width={112} height={52} rx={16} fill="#F4F6F0" stroke={INK} strokeWidth={2.4} />
              <Ellipse cx={44} cy={322} rx={14} ry={24} fill="#F4F6F0" stroke={INK} strokeWidth={2.4} />
            </G>
            <Ellipse cx={162} cy={326} rx={20} ry={22} fill="#4A3B2F" />
            <Ellipse cx={198} cy={332} rx={36} ry={15} fill="#4A3B2F" />
            <Ellipse cx={236} cy={336} rx={28} ry={10} fill="#4A3B2F" opacity={0.85} />
            <Ellipse cx={212} cy={318} rx={9} ry={6} fill="#3A2E22" opacity={0.7} />
            <Ellipse cx={246} cy={328} rx={7} ry={5} fill="#3A2E22" opacity={0.6} />
          </Svg>
        </Animated.View>
      ) : null}

      <Animated.View style={[StyleSheet.absoluteFill, styles.origin, style]}>
        <Svg style={StyleSheet.absoluteFill} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="xMidYMax meet">
          <Defs>
            <RadialGradient id="redglow">
              <Stop offset="0" stopColor="#FF3B6B" stopOpacity={0.75} />
              <Stop offset="1" stopColor="#FF3B6B" stopOpacity={0} />
            </RadialGradient>
          </Defs>

          {ending === 'bad' ? <Circle cx={cx} cy={cy} r={r * 2.6} fill="url(#redglow)" /> : null}

          {ending === 'neutral' ? (
            <G>
              {/* Ordinary grass: a flat tuft of blades, no stem at all. */}
              {(
                [
                  [-46, 70, -14],
                  [-32, 98, -8],
                  [-18, 124, -4],
                  [-6, 86, 10],
                  [8, 134, 6],
                  [20, 106, 14],
                  [34, 90, 10],
                  [48, 66, 16],
                  [-58, 54, -20],
                ] as [number, number, number][]
              ).map(([dx, h, cv], i) => (
                <Path
                  key={i}
                  d={bladePath(dx, h, cv)}
                  stroke={['#4DA85A', '#6DBB5E', '#3E9B57'][i % 3]}
                  strokeWidth={6}
                  fill="none"
                  strokeLinecap="round"
                />
              ))}
              <Circle cx={150} cy={286} r={r} fill={head} stroke={INK} strokeWidth={2.4} />
              <Face x={150} y={286} r={r} mood={mood} form={form} ending={ending} eyeX={eyeX} eyeY={eyeY} />
            </G>
          ) : (
            <G>
              {level >= 2 ? (
                <G>
                  <Path d={stemD} stroke={INK} strokeWidth={10} fill="none" strokeLinecap="round" />
                  <Path d={stemD} stroke={stemC} strokeWidth={6} fill="none" strokeLinecap="round" />
                  {leaves.map(([f, side, size], i) => {
                    const [lx, ly] = at(f);
                    return (
                      <Path
                        key={i}
                        d={leafPath(size * (ending === 'good' ? 1.1 : 1))}
                        fill={leafC}
                        stroke={INK}
                        strokeWidth={1.6}
                        strokeLinejoin="round"
                        transform={`translate(${lx} ${ly}) scale(${side} 1) rotate(-22)`}
                      />
                    );
                  })}
                  {level === 4 && form === 'neutral'
                    ? (
                        [
                          [-40, 40, -10],
                          [-20, 56, -4],
                          [22, 52, 6],
                          [42, 38, 12],
                          [0, 46, 2],
                        ] as [number, number, number][]
                      ).map(([dx, h, cv], i) => (
                        <Path
                          key={`b${i}`}
                          d={bladePath(dx, h, cv)}
                          stroke="#5FAE5B"
                          strokeWidth={5}
                          fill="none"
                          strokeLinecap="round"
                        />
                      ))
                    : null}
                </G>
              ) : null}

              <G transform={`translate(${cx} ${cy})`}>
                {form === 'good' && level >= 4
                  ? Array.from({ length: ending ? 14 : 8 }, (_, i) => {
                      const n = ending ? 14 : 8;
                      const len = ending ? r * 1.15 : r * 0.75;
                      const w = ending ? 9 : 6;
                      return (
                        <Ellipse
                          key={i}
                          cx={0}
                          cy={-(r + len * 0.42)}
                          rx={w}
                          ry={len * 0.55}
                          fill="#fff"
                          stroke={INK}
                          strokeWidth={1.6}
                          opacity={ending ? 1 : 0.9}
                          transform={`rotate(${(i * 360) / n})`}
                        />
                      );
                    })
                  : null}
                {form === 'bad' && level >= 4
                  ? Array.from({ length: ending ? 12 : 8 }, (_, i) => {
                      const n = ending ? 12 : 8;
                      const h = ending ? r * 0.6 : r * 0.32;
                      return (
                        <Path
                          key={i}
                          d={`M${-r * 0.17} ${-r + 3}L0 ${-r - h}L${r * 0.17} ${-r + 3}Z`}
                          fill={ending ? '#E0245E' : '#7B3AA8'}
                          stroke="#16051F"
                          strokeWidth={1.5}
                          strokeLinejoin="round"
                          transform={`rotate(${(i * 360) / n + 180 / n})`}
                        />
                      );
                    })
                  : null}
                <Circle r={r} fill={head} stroke={INK} strokeWidth={2.4} />
              </G>

              <Face x={cx} y={cy} r={r} mood={mood} form={form} ending={ending} eyeX={eyeX} eyeY={eyeY} />

              {/* At seed stage the soil sits in front, so it reads as half-buried. */}
              {level === 1 ? <Path d="M112 306Q150 282 188 306Z" fill="#4A3B2F" /> : null}
            </G>
          )}
        </Svg>
      </Animated.View>

      {ending === 'fell' ? (
        <Animated.View style={[StyleSheet.absoluteFill, fellFadeStyle]}>
          <Svg style={StyleSheet.absoluteFill} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="xMidYMax meet">
            {/* Slumped in the spilled soil: a short wilted stem, a head
                resting on its side. Not animated - it's already landed. */}
            <Path
              d="M165 306Q185 330 205 340Q215 344 220 336"
              stroke={INK}
              strokeWidth={9}
              fill="none"
              strokeLinecap="round"
            />
            <Path
              d="M165 306Q185 330 205 340Q215 344 220 336"
              stroke="#6B5A3A"
              strokeWidth={5}
              fill="none"
              strokeLinecap="round"
            />
            <Path
              d={leafPath(28)}
              fill="#7A6A46"
              stroke={INK}
              strokeWidth={1.6}
              strokeLinejoin="round"
              transform="translate(192 335) rotate(150)"
            />
            <Path
              d={leafPath(24)}
              fill="#7A6A46"
              stroke={INK}
              strokeWidth={1.6}
              strokeLinejoin="round"
              transform="translate(178 320) rotate(210) scale(-1,1)"
            />
            <Circle cx={230} cy={330} r={r} fill={head} stroke={INK} strokeWidth={2.4} />
            <Face x={230} y={330} r={r} mood={mood} form={form} ending={ending} eyeX={eyeX} eyeY={eyeY} />
          </Svg>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // Anchor the growth at the soil line (y=300 of 380) rather than the centre.
  origin: { transformOrigin: '50% 79%' },
});

/** Sleepy "z"s float beside the head; rendered outside the SVG so they can fade. */
export function SleepZs({ visible }: { visible: boolean }) {
  const a = useSharedValue(0);
  useEffect(() => {
    cancelAnimation(a);
    if (visible) {
      a.value = withRepeat(withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }), -1, true);
    } else {
      a.value = withTiming(0, { duration: 200 });
    }
  }, [visible, a]);

  const one = useAnimatedStyle(() => ({ opacity: a.value * 0.9, transform: [{ translateY: -a.value * 10 }] }));
  const two = useAnimatedStyle(() => ({
    opacity: (1 - a.value) * 0.7,
    transform: [{ translateY: -(1 - a.value) * 14 }],
  }));

  if (!visible) return null;
  return (
    <View style={zStyles.wrap} pointerEvents="none">
      <Animated.Text style={[zStyles.z, one]}>z</Animated.Text>
      <Animated.Text style={[zStyles.z, zStyles.small, two]}>z</Animated.Text>
    </View>
  );
}

const zStyles = StyleSheet.create({
  wrap: { position: 'absolute', top: '24%', right: '30%', flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  z: { color: '#DCE6FF', fontSize: 22, fontStyle: 'italic', fontWeight: '600' },
  small: { fontSize: 15 },
});
