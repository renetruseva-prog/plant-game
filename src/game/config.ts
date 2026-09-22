/**
 * Every tunable number for the game lives here.
 *
 * Progression (level) is driven purely by the number of interactions;
 * character (ending) is driven purely by the scores.
 */

import type { EndingKind, InteractionKind, Scores } from './types';

/**
 * Cumulative interactions needed to reach levels 1..5. Level-to-level gaps
 * are 15 / 30 / 50 / 100 (Seed->Sprout, Sprout->Growing, Growing->Becoming,
 * Becoming->Fate), so the cumulative total climbs 0, 15, 45, 95, 195.
 */
export const THRESHOLDS = [0, 15, 45, 95, 195] as const;

/** The whole run is over at this many interactions. */
export const FINAL_COUNT = THRESHOLDS[4];

/**
 * What each interaction adds to the running scores. Deliberately chunky: by
 * the end of a run the ending should be decisive, never a coin flip.
 */
export const WEIGHTS: Record<InteractionKind, Partial<Scores>> = {
  // Tap interactions
  water: { care: 4, attention: 1 },
  sun: { light: 4, care: 1 },
  stroke: { attention: 4, care: 1 },
  shake: { roughness: 5 },

  // Device-driven interactions
  walk: { attention: 3, light: 1 }, // rhythmic accelerometer pattern
  nudge: { attention: 3 }, // gentle physical movement
  jolt: { roughness: 5 }, // aggressive physical shake
  outside: { light: 5, care: 2 }, // location moved far enough / check-in
  daylight: { light: 3 }, // curtains opened or ambient light rose
  nightfall: { care: 1 }, // curtains closed: resting is mild care, not neglect
};

/** Which interactions count as "rough" for the tendency read-out. */
export const ROUGH_KINDS: InteractionKind[] = ['shake', 'jolt'];

/** Final ending thresholds, evaluated once at level 5. */
export const ENDING_RULES = {
  /** Roughness at or above this = evil plant, regardless of anything else. */
  badRoughness: 217,
  /** ...or this much roughness combined with too little gentle care. */
  badMixed: { roughness: 130, maxGentle: 325 },
  /**
   * The good ending needs all of these at once. `maxRoughness` is set so a
   * handful of rough moments are forgivable but sustained roughness isn't -
   * the plant should feel generous, not fragile.
   */
  good: { maxRoughness: 108, care: 108, attention: 108, light: 87 },
} as const;

/** Softer version of the same rules, used at level 4 to foreshadow the ending. */
export const TENDENCY_RULES = {
  badRoughness: 95,
  good: { maxRoughness: 40, care: 40, attention: 40, light: 32 },
} as const;

/** Motion detection tuning (accelerometer magnitude is in g, ~1.0 at rest). */
export const MOTION = {
  /** Sample rate in ms. 20Hz is enough to separate a shake from a walk. */
  intervalMs: 50,
  /** |magnitude - 1g| above this is an aggressive spike. */
  joltDelta: 1.15,
  /** A single dropped phone must not ruin a run: require repeated spikes. */
  joltSpikesRequired: 2,
  joltSpikeWindowMs: 700,
  joltCooldownMs: 1500,
  /** Gentle band: noticeable movement, nowhere near a shake. */
  gentleMin: 0.08,
  gentleMax: 0.45,
  /** Rhythmic peaks in this frequency band read as walking. */
  walkMinPeaks: 5,
  walkWindowMs: 2600,
  walkCooldownMs: 7000,
  /** Sustained gentle movement that is not rhythmic enough to be a walk. */
  nudgeCooldownMs: 4000,
} as const;

/** Ambient light tuning (Android LightSensor - real lux). */
export const LIGHT = {
  /** Below this many lux the plant falls asleep. */
  darkLux: 12,
  /** Hysteresis so a flickering sensor doesn't strobe the UI. */
  brightLux: 40,
  intervalMs: 600,
  /** Fallback when there is no sensor: these hours count as dark. */
  nightHours: { from: 20, to: 7 },
} as const;

/**
 * Ambient light tuning for the camera-brightness fallback (iOS, or any device
 * without a LightSensor). There's no public ambient-light API on iOS, so this
 * samples the camera feed instead and estimates brightness from its average
 * luma (0-255). Auto-exposure means this is a cruder signal than real lux -
 * it reliably tells a lit room from a genuinely dark one, but won't resolve
 * subtle dimming the way a light meter would.
 */
export const CAMERA_LIGHT = {
  intervalMs: 1500,
  darkLuma: 55,
  brightLuma: 100,
  /** Sample every Nth pixel when averaging; keeps the decode cheap. */
  sampleStride: 4,
  jpegQuality: 0.3,
  /**
   * The env decision uses the median of this many recent readings rather
   * than the latest one, so a single transient frame (motion blur, a hand
   * crossing the lens) can't flip the room by itself.
   */
  smoothingWindow: 3,
} as const;

/** Location tuning for the "take me outside" interaction. */
export const OUTSIDE = {
  /** Metres from the first-open anchor that count as "went outside". */
  distanceM: 40,
  timeoutMs: 8000,
} as const;

/** Touching the plant directly, on top of the button row and phone shaking. */
export const TOUCH = {
  /** A drag faster than this (px/s) anywhere during the touch reads as aggressive. */
  aggressiveVelocity: 900,
  /**
   * Below this total distance, velocity is ignored - a firm press-and-hold or
   * a tiny flick shouldn't misclassify as a shake from sensor noise alone.
   */
  minDragForVelocity: 18,
  /**
   * Repeated quick taps in place read as aggressive even if each one is
   * soft: a single isolated tap is always gentle, but the very next tap
   * that lands within the window already tips it into a shake.
   */
  rapidTapCount: 2,
  rapidTapWindowMs: 700,
  /** How far the pupils drift while tracking a finger elsewhere on the stage. */
  eyeMaxOffset: 3.6,
  eyeFollowDuration: 90,
  eyeReturnDuration: 380,
} as const;

export function levelFor(count: number): number {
  let level = 1;
  THRESHOLDS.forEach((threshold, i) => {
    if (count >= threshold) level = i + 1;
  });
  return level;
}

export function applyWeights(scores: Scores, kind: InteractionKind): Scores {
  const delta = WEIGHTS[kind];
  return {
    care: Math.max(0, scores.care + (delta.care ?? 0)),
    light: Math.max(0, scores.light + (delta.light ?? 0)),
    attention: Math.max(0, scores.attention + (delta.attention ?? 0)),
    roughness: Math.max(0, scores.roughness + (delta.roughness ?? 0)),
  };
}

const gentleTotal = (s: Scores) => s.care + s.light + s.attention;

/** The final verdict. Computed once, at level 5. */
export function endingOf(s: Scores): EndingKind {
  const { badRoughness, badMixed, good } = ENDING_RULES;
  if (s.roughness >= badRoughness) return 'bad';
  if (s.roughness >= badMixed.roughness && gentleTotal(s) <= badMixed.maxGentle) return 'bad';
  if (
    s.roughness <= good.maxRoughness &&
    s.care >= good.care &&
    s.attention >= good.attention &&
    s.light >= good.light
  ) {
    return 'good';
  }
  return 'neutral';
}

/** Where the plant is currently heading, shown from level 4 so you can course-correct. */
export function tendencyOf(s: Scores): EndingKind {
  const { badRoughness, good } = TENDENCY_RULES;
  if (s.roughness >= badRoughness) return 'bad';
  if (
    s.roughness <= good.maxRoughness &&
    s.care >= good.care &&
    s.attention >= good.attention &&
    s.light >= good.light
  ) {
    return 'good';
  }
  return 'neutral';
}
