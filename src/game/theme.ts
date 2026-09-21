import type { EndingKind, Env } from './types';

export type Palette = {
  screen: string;
  paper: string;
  ink: string;
  dim: string;
  line: string;
  accent: string;
  stageTop: string;
  stageBottom: string;
  /** Radius of the cards. The UI gets rounder and softer as the plant grows. */
  radius: number;
  /** Letter spacing on the tag title; tightens as the plant becomes itself. */
  tracking: number;
};

const INK = '#16251B';

/**
 * Each level gets its own visual language, so the interface evolves with the
 * plant rather than just the sprite: paler and more clinical at seed stage,
 * warmer and greener as it bonds, then swinging toward its final character.
 */
const BY_LEVEL: Palette[] = [
  {
    screen: '#E9EDE6',
    paper: '#FBFCF8',
    ink: INK,
    dim: '#6B7A70',
    line: 'rgba(22,37,27,0.14)',
    accent: '#5F8A6B',
    stageTop: '#DCE4D8',
    stageBottom: '#F1F4EC',
    radius: 16,
    tracking: 0,
  },
  {
    screen: '#E6EEE3',
    paper: '#FBFCF8',
    ink: INK,
    dim: '#5D6E62',
    line: 'rgba(22,37,27,0.16)',
    accent: '#3E9B57',
    stageTop: '#D4E5D6',
    stageBottom: '#EFF5E8',
    radius: 18,
    tracking: -0.2,
  },
  {
    screen: '#E4EFE0',
    paper: '#FAFCF6',
    ink: INK,
    dim: '#55685C',
    line: 'rgba(22,37,27,0.18)',
    accent: '#2F8A4C',
    stageTop: '#CFE4D2',
    stageBottom: '#EEF4E6',
    radius: 22,
    tracking: -0.4,
  },
  {
    screen: '#E2F0DD',
    paper: '#F9FCF5',
    ink: '#12231A',
    dim: '#4E6256',
    line: 'rgba(18,35,26,0.2)',
    accent: '#22854A',
    stageTop: '#C8E2CD',
    stageBottom: '#ECF4E3',
    radius: 26,
    tracking: -0.6,
  },
  {
    screen: '#DFF1DA',
    paper: '#F8FCF3',
    ink: '#0E1F16',
    dim: '#485C50',
    line: 'rgba(14,31,22,0.22)',
    accent: '#16803F',
    stageTop: '#C2E0C8',
    stageBottom: '#EAF4E0',
    radius: 30,
    tracking: -0.8,
  },
];

/** Level 4 leans the palette toward whatever the plant is about to become. */
const TENDENCY_TINT: Record<EndingKind, Partial<Palette>> = {
  good: { accent: '#E8B33A', stageTop: '#DCE9C8', stageBottom: '#F6F6E4' },
  neutral: {},
  bad: { accent: '#7B3AA8', stageTop: '#B9C6D4', stageBottom: '#DCD8E8', dim: '#5A5269' },
};

export const EVIL_PALETTE: Palette = {
  screen: '#14001C',
  paper: '#240336',
  ink: '#FFD9E6',
  dim: '#C48AA8',
  line: 'rgba(255,77,125,0.4)',
  accent: '#FF3B6B',
  stageTop: '#63093F',
  stageBottom: '#12001C',
  radius: 8,
  tracking: 1.2,
};

const DARK_STAGE = { stageTop: '#1A2644', stageBottom: '#0D1526' };

export function paletteFor(
  level: number,
  env: Env,
  tendency: EndingKind | null,
  ending: EndingKind | null
): Palette {
  if (ending === 'bad') return EVIL_PALETTE;

  let p = { ...BY_LEVEL[Math.min(level, 5) - 1] };
  if (level >= 4 && tendency) p = { ...p, ...TENDENCY_TINT[tendency] };
  if (ending === 'good') {
    p = { ...p, accent: '#E8B33A', stageTop: '#E3EDC6', stageBottom: '#FAF8E6' };
  }
  if (ending === 'neutral') {
    p = { ...p, accent: '#6DBB5E', stageTop: '#D3E3C9', stageBottom: '#F0F4E8' };
  }
  if (env === 'dark') p = { ...p, ...DARK_STAGE };
  return p;
}
