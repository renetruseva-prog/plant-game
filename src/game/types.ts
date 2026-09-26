/**
 * `'carnivore'` (all water and light, barely any affection) and `'cactus'`
 * (light and affection, barely any water) are scored endings alongside
 * good/neutral/bad - see `endingOf`. `'fell'` is not scored at all - it's an
 * instant, permanent ending triggered by turning the phone upside down
 * mid-run (see `use-upside-down.ts`), and bypasses the Level 5 reveal
 * entirely.
 */
export type EndingKind = 'good' | 'neutral' | 'bad' | 'fell' | 'carnivore' | 'cactus';

/** Tap interactions plus the device-driven ones. */
export type InteractionKind =
  | 'water'
  | 'sun'
  | 'stroke'
  | 'shake'
  | 'walk'
  | 'nudge'
  | 'jolt'
  | 'daylight'
  | 'nightfall'
  /** Holding a finger over the camera lens (the iOS/no-sensor light
   *  fallback) reads as tucking it in for the night, not as darkness alone -
   *  scores the same as `sun`, since it's standing in for the light it isn't
   *  getting from the room right now. */
  | 'sleep';

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
  /** Dismissed the intro card. */
  started: boolean;
};
