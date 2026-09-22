import Animated, { useAnimatedProps, type SharedValue } from 'react-native-reanimated';
import { Circle, G, Path } from 'react-native-svg';

import type { EndingKind, Mood } from '@/game/types';

const INK = '#16251B';
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type Props = {
  x: number;
  y: number;
  r: number;
  mood: Mood;
  form: EndingKind | null;
  ending: EndingKind | null;
  /** Live pupil offset while a finger drags elsewhere on the stage. Only the
   *  idle face has round pupils to actually shift; every other mood's eyes
   *  are drawn as curves with no "look direction" to redirect. */
  eyeX: SharedValue<number>;
  eyeY: SharedValue<number>;
};

/** The one pair of eyes that can plausibly "look" somewhere. */
function IdleEyes({
  x,
  y,
  r,
  fill,
  eyeX,
  eyeY,
}: {
  x: number;
  y: number;
  r: number;
  fill: string;
  eyeX: SharedValue<number>;
  eyeY: SharedValue<number>;
}) {
  const props = useAnimatedProps(() => ({
    cx: x + eyeX.value,
    cy: y + eyeY.value,
  }));
  return <AnimatedCircle animatedProps={props} r={r} fill={fill} />;
}

/**
 * The face is drawn from the head's centre and radius so it scales with the
 * plant across all five levels without a separate sprite per stage.
 */
export function Face({ x, y, r, mood, form, ending, eyeX, eyeY }: Props) {
  const evil = ending === 'bad';
  const stroke = evil ? '#FF4D7D' : INK;
  const dx = r * 0.38;
  const ey = y - r * 0.1;
  const er = Math.max(2.4, r * 0.13);
  const sw = Math.max(2, r * 0.08);
  const line = { stroke, strokeWidth: sw, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

  if (evil) {
    const brow = (s: number) => (
      <Path
        key={`e${s}`}
        d={`M${x + s * (dx + er * 1.7)} ${ey - er * 1.7}L${x + s * (dx - er * 1.7)} ${
          ey - er * 0.5
        }L${x + s * (dx + er)} ${ey + er * 1.5}Z`}
        fill="#FF3B6B"
      />
    );
    return (
      <G>
        {brow(-1)}
        {brow(1)}
        <Path
          d={`M${x - r * 0.5} ${y + r * 0.26}L${x - r * 0.3} ${y + r * 0.52}L${x - r * 0.1} ${
            y + r * 0.26
          }L${x + r * 0.1} ${y + r * 0.52}L${x + r * 0.3} ${y + r * 0.26}L${x + r * 0.5} ${
            y + r * 0.52
          }`}
          fill="none"
          {...line}
        />
      </G>
    );
  }

  if (ending === 'fell') {
    // Drooping, half-closed eyes and a deep frown - wilted, not wincing.
    return (
      <G>
        {[-1, 1].map((s) => (
          <Path
            key={s}
            d={`M${x + s * dx - er * 1.3} ${ey - er * 0.4}L${x + s * dx + er * 1.3} ${ey + er * 0.9}`}
            fill="none"
            {...line}
          />
        ))}
        <Path
          d={`M${x - r * 0.28} ${y + r * 0.5}Q${x} ${y + r * 0.22} ${x + r * 0.28} ${y + r * 0.5}`}
          fill="none"
          {...line}
        />
      </G>
    );
  }

  if (ending === 'carnivore') {
    // Sly, asymmetric eyes and a crooked, toothy grin - mischievous, not evil.
    return (
      <G>
        <Path
          d={`M${x - dx - er * 1.3} ${ey - er * 0.2}Q${x - dx} ${ey - er * 1.3} ${x - dx + er * 1.3} ${ey - er * 0.2}`}
          fill="none"
          {...line}
        />
        <Path
          d={`M${x + dx - er * 1.1} ${ey + er * 0.3}Q${x + dx} ${ey - er * 0.5} ${x + dx + er * 1.1} ${ey + er * 0.3}`}
          fill="none"
          {...line}
        />
        <Path
          d={`M${x - r * 0.3} ${y + r * 0.22}Q${x} ${y + r * 0.5} ${x + r * 0.36} ${y + r * 0.1}`}
          fill="none"
          {...line}
        />
        <Path
          d={`M${x + r * 0.08} ${y + r * 0.28}L${x + r * 0.14} ${y + r * 0.42}L${x + r * 0.2} ${y + r * 0.27}Z`}
          fill={stroke}
        />
      </G>
    );
  }

  if (ending === 'cactus') {
    // Closed, content eyes and a small settled smile - hardy, not sad.
    return (
      <G>
        {[-1, 1].map((s) => (
          <Path
            key={s}
            d={`M${x + s * dx - er * 1.3} ${ey}Q${x + s * dx} ${ey - er * 1.4} ${
              x + s * dx + er * 1.3
            } ${ey}`}
            fill="none"
            {...line}
          />
        ))}
        <Path
          d={`M${x - r * 0.22} ${y + r * 0.22}Q${x} ${y + r * 0.4} ${x + r * 0.22} ${y + r * 0.22}`}
          fill="none"
          {...line}
        />
      </G>
    );
  }

  if (mood === 'sleep') {
    return (
      <G>
        {[-1, 1].map((s) => (
          <Path
            key={s}
            d={`M${x + s * dx - er * 1.4} ${ey}Q${x + s * dx} ${ey + er * 1.7} ${
              x + s * dx + er * 1.4
            } ${ey}`}
            fill="none"
            {...line}
          />
        ))}
        <Path d={`M${x - r * 0.1} ${y + r * 0.34}L${x + r * 0.1} ${y + r * 0.34}`} fill="none" {...line} />
      </G>
    );
  }

  if (mood === 'happy' || mood === 'sway') {
    return (
      <G>
        {[-1, 1].map((s) => (
          <Path
            key={s}
            d={`M${x + s * dx - er * 1.4} ${ey + er * 0.7}Q${x + s * dx} ${ey - er * 1.7} ${
              x + s * dx + er * 1.4
            } ${ey + er * 0.7}`}
            fill="none"
            {...line}
          />
        ))}
        <Path
          d={`M${x - r * 0.32} ${y + r * 0.18}Q${x} ${y + r * 0.62} ${x + r * 0.32} ${y + r * 0.18}`}
          fill="none"
          {...line}
        />
        <Circle cx={x - r * 0.62} cy={y + r * 0.2} r={r * 0.13} fill="#FF8FA8" opacity={0.75} />
        <Circle cx={x + r * 0.62} cy={y + r * 0.2} r={r * 0.13} fill="#FF8FA8" opacity={0.75} />
      </G>
    );
  }

  if (mood === 'hurt') {
    return (
      <G>
        {[-1, 1].map((s) => (
          <Path
            key={s}
            d={`M${x + s * dx - er} ${ey - er}L${x + s * dx + er} ${ey + er}M${x + s * dx + er} ${
              ey - er
            }L${x + s * dx - er} ${ey + er}`}
            fill="none"
            {...line}
          />
        ))}
        <Path
          d={`M${x - r * 0.3} ${y + r * 0.42}Q${x - r * 0.15} ${y + r * 0.22} ${x} ${
            y + r * 0.42
          }Q${x + r * 0.15} ${y + r * 0.62} ${x + r * 0.3} ${y + r * 0.42}`}
          fill="none"
          {...line}
        />
      </G>
    );
  }

  // idle
  return (
    <G>
      {[-1, 1].map((s) => (
        <IdleEyes key={s} x={x + s * dx} y={ey} r={er} fill={stroke} eyeX={eyeX} eyeY={eyeY} />
      ))}
      <Path
        d={`M${x - r * 0.2} ${y + r * 0.25}Q${x} ${y + r * 0.42} ${x + r * 0.2} ${y + r * 0.25}`}
        fill="none"
        {...line}
      />
      {form === 'bad' && !ending ? (
        // The first hint of a scowl, before the plant has fully turned.
        <Path
          d={`M${x - dx - er * 1.6} ${ey - er * 2.6}L${x - dx + er * 1.6} ${ey - er * 1.6}M${
            x + dx + er * 1.6
          } ${ey - er * 2.6}L${x + dx - er * 1.6} ${ey - er * 1.6}`}
          fill="none"
          {...line}
        />
      ) : null}
    </G>
  );
}
