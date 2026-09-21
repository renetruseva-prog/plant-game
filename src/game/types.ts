export type EndingKind = 'good' | 'neutral' | 'bad';

/** Tap interactions plus the device-driven ones. */
export type InteractionKind =
  | 'water'
  | 'sun'
  | 'stroke'
  | 'shake'
  | 'walk'
  | 'nudge'
  | 'jolt'
  | 'outside'
  | 'daylight'
  | 'nightfall';

export type Scores = {
  care: number;
  light: number;
  attention: number;
  roughness: number;
};

export type Mood = 'idle' | 'happy' | 'hurt' | 'sleep' | 'sway';

export type Env = 'day' | 'dark';

export type GameState = {
  /** Total interactions. Drives the level and nothing else. */
  count: number;
  /** Per-kind tally, shown on the ending card. */
  counts: Record<InteractionKind, number>;
  scores: Scores;
  level: number;
  ending: EndingKind | null;
  env: Env;
  /** Set once the player has confirmed being outside. */
  wentOutside: boolean;
  /** Dismissed the intro card. */
  started: boolean;
};
