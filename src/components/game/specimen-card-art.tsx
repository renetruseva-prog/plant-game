import type { Ref } from 'react';
import { useSharedValue } from 'react-native-reanimated';
import Svg, { Circle, Defs, G, LinearGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';

import { PlantScene } from '@/components/plant/plant-art';
import { roughRatioOf } from '@/components/plant/plant-picture';
import { ENDINGS } from '@/game/copy';
import { family } from '@/game/fonts';
import { VIEW_H, VIEW_W } from '@/game/plant-geometry';
import type { HistoryEntry } from '@/game/state';
import type { Palette } from '@/game/theme';
import type { Scores } from '@/game/types';

const W = 720;
const H = 1100;
const PAD = 64;

/** The plant's own panel, between the name and the write-up. */
const PANEL_Y = 280;
const PANEL_H = 360;
/** The plant is drawn in a 300x380 box; this fits that box to the panel. */
const PLANT_SCALE = PANEL_H / VIEW_H;
const PLANT_X = PAD + (W - PAD * 2 - VIEW_W * PLANT_SCALE) / 2;

const STAT_ROWS: [keyof Scores, string][] = [
  ['care', 'Care'],
  ['light', 'Light'],
  ['attention', 'Attention'],
  ['roughness', 'Rough'],
];

/** Crude but adequate word-wrap for SVG text, which never wraps on its own -
 *  `maxChars` is an estimate from the font size, not a measured layout. */
function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}

type Props = {
  entry: HistoryEntry;
  palette: Palette;
  /** Attached directly to the underlying `Svg`, whose `toDataURL()` is how
   *  the card gets exported as a PNG to share - see `gallery.tsx`. */
  svgRef?: Ref<Svg>;
};

/**
 * The specimen card as a standalone image, drawn entirely in SVG rather than
 * captured from any on-screen view - built once at a fixed size so it looks
 * the same whether it's rendered small in a list or exported at full
 * resolution, and styled to match the app's own botanical-label look (the
 * punched hole, the paper card, left-aligned type) rather than reading as a
 * generic share-card template.
 */
export function SpecimenCardArt({ entry, palette, svgRef }: Props) {
  const copy = ENDINGS[entry.ending];
  const bodyLines = wrapText(copy.body, 42);
  // Nothing is touching it, so the pupils just rest where they are.
  const eyeX = useSharedValue(0);
  const eyeY = useSharedValue(0);

  const statsTop = H - PAD - 150;
  const statW = (W - PAD * 2 - 3 * 14) / 4;

  return (
    <Svg ref={svgRef} width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      {/* Fills the whole image, corners included - a transparent PNG shows
       *  up as a black or white margin around the card once it's posted. */}
      <Rect x={0} y={0} width={W} height={H} fill={palette.screen} />
      <Rect
        x={2}
        y={2}
        width={W - 4}
        height={H - 4}
        rx={40}
        fill={palette.paper}
        stroke={palette.line}
        strokeWidth={3}
      />

      {/* The punched hole from the in-app specimen tag, so this reads as
       *  the same object rather than a lookalike drawn for sharing. */}
      <Circle cx={88} cy={88} r={20} fill={palette.screen} stroke={palette.line} strokeWidth={3} />

      <SvgText x={140} y={80} fontSize={20} fontFamily={family('medium', false)} fill={palette.dim}>
        {entry.mark}
      </SvgText>
      <SvgText
        x={W - PAD}
        y={80}
        fontSize={20}
        fontFamily={family('medium', false)}
        fill={palette.dim}
        textAnchor="end">
        {new Date(entry.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
      </SvgText>

      <SvgText x={PAD} y={196} fontSize={60} fontFamily={family('black', false)} fill={palette.ink}>
        {copy.title}
      </SvgText>
      <SvgText x={PAD} y={240} fontSize={30} fontFamily={family('latin', false)} fill={palette.dim}>
        {entry.latin}
      </SvgText>

      <Defs>
        <LinearGradient id="stage" x1="0" y1="0" x2="0.35" y2="1">
          <Stop offset="0" stopColor={palette.stageTop} />
          <Stop offset="1" stopColor={palette.stageBottom} />
        </LinearGradient>
      </Defs>
      <Rect
        x={PAD}
        y={PANEL_Y}
        width={W - PAD * 2}
        height={PANEL_H}
        rx={26}
        fill="url(#stage)"
        stroke={palette.line}
        strokeWidth={3}
      />
      <G transform={`translate(${PLANT_X} ${PANEL_Y}) scale(${PLANT_SCALE})`}>
        <PlantScene
          level={5}
          mood="idle"
          form={entry.ending}
          ending={entry.ending}
          roughRatio={roughRatioOf(entry.scores)}
          eyeX={eyeX}
          eyeY={eyeY}
        />
      </G>

      {bodyLines.map((line, i) => (
        <SvgText
          key={i}
          x={PAD}
          y={PANEL_Y + PANEL_H + 56 + i * 36}
          fontSize={25}
          fontFamily={family('body', false)}
          fill={palette.ink}>
          {line}
        </SvgText>
      ))}

      {STAT_ROWS.map(([key, label], i) => {
        const x = PAD + i * (statW + 14);
        return (
          <G key={key}>
            <Rect
              x={x}
              y={statsTop}
              width={statW}
              height={110}
              rx={12}
              fill="none"
              stroke={palette.line}
              strokeWidth={3}
            />
            <SvgText
              x={x + statW / 2}
              y={statsTop + 52}
              fontSize={34}
              fontFamily={family('bold', false)}
              fill={palette.ink}
              textAnchor="middle">
              {entry.scores[key]}
            </SvgText>
            <SvgText
              x={x + statW / 2}
              y={statsTop + 82}
              fontSize={17}
              fontFamily={family('body', false)}
              fill={palette.dim}
              textAnchor="middle">
              {label}
            </SvgText>
          </G>
        );
      })}

      <SvgText
        x={W / 2}
        y={H - 32}
        fontSize={19}
        letterSpacing={2}
        fontFamily={family('semibold', false)}
        fill={palette.dim}
        textAnchor="middle">
        SPECIMEN
      </SvgText>
    </Svg>
  );
}
