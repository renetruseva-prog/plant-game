import type { EndingKind, InteractionKind } from './types';

export const LEVELS = [
  { name: 'Seed', goal: 'Find out what it responds to.' },
  { name: 'Sprout', goal: 'It is starting to notice you.' },
  { name: 'Growing', goal: 'It is developing a personality.' },
  { name: 'Becoming', goal: 'It is leaning toward something.' },
  { name: 'Fate', goal: 'This is what it became.' },
] as const;

/** One of these is whispered after each interaction. */
export const LINES: Record<InteractionKind, string[]> = {
  water: [
    'Cool. It leans into the water.',
    'It drinks without opening its eyes.',
    'A small, satisfied sound.',
  ],
  sun: ['Warmth. It turns toward it.', 'It stretches all the way up.', 'It soaks up the light.'],
  stroke: [
    'It goes still, then softens.',
    'It presses back against your finger.',
    'It seems to like that.',
  ],
  shake: ['It flinches.', 'It went quiet. That wasn’t fun.', 'It is watching you now.'],
  walk: [
    'You’re walking. It sways along with you.',
    'It likes being carried.',
    'It bobs in time with your steps.',
  ],
  nudge: ['It felt that. Gently.', 'A soft tilt. It settles again.', 'It rocks, and likes it.'],
  jolt: ['You shook it. Hard.', 'That hurt.', 'It braces itself against you.'],
  outside: [
    'Outside. Real light, real air.',
    'It opens up in the open air.',
    'It has never felt this much sky.',
  ],
  daylight: ['Light again. It wakes up.', 'The room brightens. It lifts.'],
  nightfall: ['The light drops. It falls asleep.', 'Dark now. It folds inward.'],
};

export const ENDINGS: Record<
  EndingKind,
  { latin: string; title: string; goal: string; body: string }
> = {
  good: {
    latin: 'Bellis perennis',
    title: 'It bloomed.',
    goal: 'It reached its potential.',
    body: 'Steady, gentle care gave it everything it needed. A daisy, fully grown.',
  },
  neutral: {
    latin: 'Poa annua',
    title: 'It settled.',
    goal: 'It survived. It didn’t reach its potential.',
    body: 'Some care, some gaps. Ordinary grass: alive, and perfectly fine.',
  },
  bad: {
    latin: 'Planta malefica',
    title: 'It took over.',
    goal: 'It remembers how you treated it.',
    body: 'Rough handling taught it to fight back. None of that was real: nothing on your phone was touched.',
  },
  fell: {
    latin: 'Planta lapsa',
    title: 'It fell.',
    goal: 'It couldn’t hold on.',
    body: 'Turned upside down with nowhere to root, it slipped out of the pot. That one was on you.',
  },
  carnivore: {
    latin: 'Dionaea vorax',
    title: 'It bites.',
    goal: 'It found its own way to feed.',
    body: 'All water, all light, never touched - it stopped waiting for affection and started catching its own dinner.',
  },
  cactus: {
    latin: 'Cactus solitarius',
    title: 'It toughened up.',
    goal: 'It learned to need less.',
    body: 'Plenty of light, plenty of touch, but you barely watered it - so it stopped needing to be watered at all.',
  },
};

/** Latin name shown on the specimen tag as the plant becomes identifiable. */
export function latinFor(level: number, form: EndingKind | null, ending: EndingKind | null) {
  if (ending) return ENDINGS[ending].latin;
  if (level >= 4 && form && form !== 'fell') {
    return {
      good: 'Bellis (?)',
      neutral: 'Poa (?)',
      bad: 'Umbra (?)',
      carnivore: 'Dionaea (?)',
      cactus: 'Cactus (?)',
    }[form];
  }
  if (level === 3) return 'Planta cognoscenda';
  return 'Planta incognita';
}

/** Action labels. The evil plant relabels the whole interface. */
export const ACTION_LABELS: Record<'normal' | 'evil', Record<string, string>> = {
  normal: { water: 'Water', sun: 'Sunlight', stroke: 'Stroke', shake: 'Shake' },
  evil: { water: 'give', sun: 'look', stroke: 'obey', shake: 'don’t' },
};

/** The scripted takeover. Each step is offset in ms from the reveal. */
export type EvilStep =
  | { at: number; kind: 'say'; text: string }
  | {
      at: number;
      kind: 'notif';
      app: string;
      title: string;
      body: string;
      color: string;
      initial: string;
    }
  | { at: number; kind: 'dialog' }
  | { at: number; kind: 'sheet' };

export const EVIL_SCRIPT: EvilStep[] = [
  { at: 0, kind: 'say', text: 'hello.' },
  { at: 700, kind: 'say', text: 'you shouldn’t have done that.' },
  {
    at: 700,
    kind: 'notif',
    app: 'Messages',
    title: 'Unknown',
    body: 'i can see you',
    color: '#34C759',
    initial: 'M',
  },
  {
    at: 2100,
    kind: 'notif',
    app: 'Settings',
    title: 'Wallpaper changed',
    body: 'Specimen set itself as your background.',
    color: '#8E8E93',
    initial: 'S',
  },
  { at: 3400, kind: 'say', text: 'i’m not sleeping anymore.' },
  {
    at: 3400,
    kind: 'notif',
    app: 'Battery',
    title: '3% remaining',
    body: 'Specimen is charging itself.',
    color: '#FF9F0A',
    initial: 'B',
  },
  { at: 4900, kind: 'dialog' },
];

export const WHISPER_START = 'It hasn’t moved yet. Try something.';
