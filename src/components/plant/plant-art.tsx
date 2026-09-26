import type { SharedValue } from 'react-native-reanimated';
import { Circle, Defs, Ellipse, G, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { getPlantGeometry } from '@/game/plant-geometry';
import type { EndingKind, Mood } from '@/game/types';

import { Face } from './face';

/**
 * The plant's drawing, as plain SVG with no animation of its own - shared by
 * the live `Plant` (which wraps these pieces in animated views) and anywhere
 * that just needs the picture, like the gallery. One drawing, so a specimen
 * in the gallery is always the exact plant that was raised, never a copy
 * that has drifted from it.
 */

export const INK = '#16251B';

const hexToRgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

function mix(a: string, b: string, k: number) {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  return (
    '#' +
    A.map((v, i) => Math.round(v + (B[i] - v) * k).toString(16).padStart(2, '0')).join('')
  );
}

export type PlantArtProps = {
  level: number;
  mood: Mood;
  /** Tendency at level 4, or the locked-in ending at level 5. */
  form: EndingKind | null;
  ending: EndingKind | null;
  /** 0..1 share of the run that was rough. Tints the head as it sours. */
  roughRatio: number;
  /** Where the pupils sit; a resting `0` for anything not being touched. */
  eyeX: SharedValue<number>;
  eyeY: SharedValue<number>;
};

/** The upright pot. */
export function PotArt() {
  return (
    <>
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
    </>
  );
}

/** The pot knocked on its side, soil spilled across the shelf. */
export function SpilledPotArt() {
  return (
    <>
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
    </>
  );
}

/** Everything about how a given plant is drawn, shared by the pieces below. */
function useDrawing({ level, form, ending, roughRatio }: Pick<PlantArtProps, 'level' | 'form' | 'ending' | 'roughRatio'>) {
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
              : ending === 'carnivore'
                ? '#4A9A4E'
                : ending === 'cactus'
                  ? '#5FA05E'
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

  return { cx, cy, r, stemH, head, stemC, leafC, at, leafPath, bladePath, leaves, stemD };
}

/** The living plant: stem, leaves, head and face - or its ending's form. */
export function PlantArt({ level, mood, form, ending, roughRatio, eyeX, eyeY }: PlantArtProps) {
  const { cx, cy, r, head, stemC, leafC, at, leafPath, bladePath, leaves, stemD } = useDrawing({
    level,
    form,
    ending,
    roughRatio,
  });
  return (
    <>
      <Defs>
        <RadialGradient id="redglow">
          <Stop offset="0" stopColor="#FF3B6B" stopOpacity={0.75} />
          <Stop offset="1" stopColor="#FF3B6B" stopOpacity={0} />
        </RadialGradient>
      </Defs>

      {ending === 'bad' ? <Circle cx={cx} cy={cy} r={r * 2.6} fill="url(#redglow)" /> : null}

      {ending === 'cactus' ? (
        <G>
          {/* No stem, no leaves - a single tall ribbed body instead. */}
          <Path
            d="M112 306L112 200Q112 160 150 160Q188 160 188 200L188 306Z"
            fill={head}
            stroke={INK}
            strokeWidth={2.4}
            strokeLinejoin="round"
          />
          <Path d="M130 304Q126 240 130 168" stroke={INK} strokeWidth={1.3} fill="none" opacity={0.3} />
          <Path d="M150 304L150 163" stroke={INK} strokeWidth={1.3} fill="none" opacity={0.3} />
          <Path d="M170 304Q174 240 170 168" stroke={INK} strokeWidth={1.3} fill="none" opacity={0.3} />
          {Array.from({ length: 9 }, (_, i) => {
            const t = i / 8;
            const yy = 300 - t * 132;
            const taper = 38 * (1 - t * 0.42);
            return (
              <G key={i}>
                <Path
                  d={`M${150 - taper} ${yy}l-6 -3`}
                  stroke="#F4EBD0"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                />
                <Path
                  d={`M${150 + taper} ${yy}l6 -3`}
                  stroke="#F4EBD0"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                />
              </G>
            );
          })}
          <G transform="translate(150 162)">
            {Array.from({ length: 6 }, (_, i) => (
              <Ellipse
                key={i}
                cx={0}
                cy={-6}
                rx={4.2}
                ry={7.5}
                fill="#E8618C"
                stroke={INK}
                strokeWidth={1}
                transform={`rotate(${i * 60})`}
              />
            ))}
            <Circle r={3} fill="#F6C945" />
          </G>
          <Face x={cx} y={cy} r={r} mood={mood} form={form} ending={ending} eyeX={eyeX} eyeY={eyeY} />
        </G>
      ) : ending === 'neutral' ? (
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
              {level === 4 && form === 'cactus'
                ? [-1, 1].flatMap((s) =>
                    [0, 1, 2].map((i) => (
                      <Path
                        key={`sp${s}-${i}`}
                        d={`M${cx + s * (r + 4 + i * 6)} ${cy - 6 + i * 10}l${s * 5} -2`}
                        stroke="#F4EBD0"
                        strokeWidth={1.4}
                        strokeLinecap="round"
                      />
                    ))
                  )
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
            {form === 'carnivore' && level >= 4
              ? [-1, 1].map((s) => (
                  <G key={s} transform={`rotate(${s * 40})`}>
                    <Ellipse
                      cx={0}
                      cy={-(r * (ending ? 1.5 : 1.1))}
                      rx={r * (ending ? 0.78 : 0.4)}
                      ry={r * (ending ? 1.05 : 0.55)}
                      fill="#D94A3E"
                      stroke={INK}
                      strokeWidth={1.8}
                    />
                    {ending
                      ? [-1.5, -0.5, 0.5, 1.5].map((i) => (
                          <Path
                            key={i}
                            d={`M${i * r * 0.2} ${-r * 0.55}L${i * r * 0.2 + r * 0.05} ${-r * 0.85}L${
                              i * r * 0.2 + r * 0.1
                            } ${-r * 0.55}Z`}
                            fill="#FBEDE9"
                          />
                        ))
                      : null}
                  </G>
                ))
              : null}
            <Circle r={r} fill={head} stroke={INK} strokeWidth={2.4} />
          </G>

          <Face x={cx} y={cy} r={r} mood={mood} form={form} ending={ending} eyeX={eyeX} eyeY={eyeY} />

          {ending === 'carnivore' ? (
            <G>
              {/* Flies, buzzing near the trap. */}
              <Circle cx={cx + r * 1.7} cy={cy - r * 1.9} r={2.6} fill="#2B2B2B" />
              <Path
                d={`M${cx + r * 1.7 - 4} ${cy - r * 1.9 - 2}Q${cx + r * 1.7 - 7} ${
                  cy - r * 1.9 - 4
                } ${cx + r * 1.7 - 9} ${cy - r * 1.9 - 2}M${cx + r * 1.7 + 4} ${
                  cy - r * 1.9 - 2
                }Q${cx + r * 1.7 + 7} ${cy - r * 1.9 - 4} ${cx + r * 1.7 + 9} ${cy - r * 1.9 - 2}`}
                stroke="#2B2B2B"
                strokeWidth={0.8}
                fill="none"
              />
              <Circle cx={cx - r * 1.5} cy={cy - r * 2.4} r={2.1} fill="#2B2B2B" />
              <Path
                d={`M${cx - r * 1.5 - 3} ${cy - r * 2.4 - 1.5}Q${cx - r * 1.5 - 5.5} ${
                  cy - r * 2.4 - 3
                } ${cx - r * 1.5 - 7.5} ${cy - r * 2.4 - 1.5}M${cx - r * 1.5 + 3} ${
                  cy - r * 2.4 - 1.5
                }Q${cx - r * 1.5 + 5.5} ${cy - r * 2.4 - 3} ${cx - r * 1.5 + 7.5} ${
                  cy - r * 2.4 - 1.5
                }`}
                stroke="#2B2B2B"
                strokeWidth={0.7}
                fill="none"
              />
            </G>
          ) : null}
        </G>
      )}
    </>
  );
}

/** The fallen ending: a wilted stem and a head lying in the spilled soil. */
export function SlumpedPlantArt({ level, mood, form, ending, roughRatio, eyeX, eyeY }: PlantArtProps) {
  const { r, head, leafPath } = useDrawing({ level, form, ending, roughRatio });
  return (
    <>
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
    </>
  );
}

/** The whole resting scene - pot and plant, or the spilled pot and the
 *  slumped plant for a fallen one. Drawn inside a `VIEW_W` x `VIEW_H` box. */
export function PlantScene(props: PlantArtProps) {
  return props.ending === 'fell' ? (
    <>
      <SpilledPotArt />
      <SlumpedPlantArt {...props} />
    </>
  ) : (
    <>
      <PotArt />
      <PlantArt {...props} />
    </>
  );
}
