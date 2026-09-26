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
  daylight: { light: 3 }, // curtains opened or ambient light rose
  nightfall: { care: 1 }, // curtains closed: resting is mild care, not neglect
  sleep: { light: 4, care: 1 }, // covering the camera: same reward as `sun`, earned a different way
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
  /**
   * Watered and sunned diligently, but barely touched: it stops waiting for
   * affection and starts catching its own. Judged by ratio rather than a
   * flat cap - `attention` relative to `care + light` - so it scales with
   * however many interactions actually happened, and still catches "a
   * little" affection sneaking in without catching a genuinely balanced run
   * that happens to lean on walking more than deliberate stroking.
   * `minCareLight` sits well above what care alone could reach from
   * sun-only incidental care (every sun tap carries +1), so sunlight
   * without any real watering doesn't get mistaken for both.
   */
  carnivore: { minCareLight: 250, maxAttentionRatio: 0.22, maxRoughness: 110 },
  /**
   * Plenty of light and touch, but almost never watered: it toughens up and
   * stops needing to be. Same ratio idea, mirrored - `care` relative to
   * `light + attention`.
   */
  cactus: { minLightAttention: 180, maxCareRatio: 0.27, maxRoughness: 110 },
} as const;

/**
 * Softer version of the same rules, used at level 4 to foreshadow the
 * ending. The ratio thresholds don't need rescaling - a ratio already
 * doesn't care how many interactions happened - only the absolute floors do.
 */
export const TENDENCY_RULES = {
  badRoughness: 95,
  good: { maxRoughness: 40, care: 40, attention: 40, light: 32 },
  carnivore: { minCareLight: 125, maxAttentionRatio: 0.22, maxRoughness: 55 },
  cactus: { minLightAttention: 90, maxCareRatio: 0.27, maxRoughness: 55 },
} as const;

/** Motion detection tuning (accelerometer magnitude is in g, ~1.0 at rest). */
export const MOTION = {
  /** Sample rate in ms. 20Hz is enough to separate a shake from a walk. */
  intervalMs: 50,
  /**
   * How much of each new accelerometer sample goes into the value the plant
   * leans with (0-1: lower is smoother, higher is more responsive). Walking
   * makes the raw reading spike with every footfall; this only feeds the
   * visual lean - the walk/nudge/jolt detection below still reads raw values.
   */
  tiltSmoothing: 0.25,
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
  /**
   * Samples collected right after motion detection turns on (typically while
   * the player is still reading the intro card) to measure this specific
   * device's actual resting magnitude, instead of assuming a textbook exact
   * 1g - real accelerometers carry a small per-device bias that would
   * otherwise shift every threshold above by the same fixed amount.
   */
  calibrationSamples: 6,
  /**
   * Corroborating rotation-rate (rad/s, from the gyroscope) required inside
   * the jolt spike window for a spike run to actually fire as a jolt - a
   * genuine shake tumbles the phone as well as accelerating it, where a
   * single hard bump with little rotation (set down too firmly, knocked
   * against a table) shouldn't count. Approximate: tuned by feel, not
   * measurement, same as the other motion constants above. Ignored entirely
   * on a device with no gyroscope, so jolt still works there.
   */
  joltGyroMin: 1.2,
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
  /** Time between samples. Paired with the smallest available picture size
   *  (see the sensor), this keeps sustained sampling from warming the phone
   *  up - decoding full-resolution frames in JS every couple of seconds did. */
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
  /**
   * Detecting a finger over the lens. Brightness alone doesn't work: on an
   * iPhone, auto-exposure brightens a covered lens right back up, so in a
   * lit room a fingertip reads as an orange-red glow about as bright as the
   * room itself (on-device logs showed ~120 luma both covered and not).
   * What reliably changes is the *character* of the frame - it goes almost
   * featureless (`coveredMaxStdDev`) and, with light behind it, red
   * (`coveredMinRedRatio`). In a dim room it just goes dark instead, which
   * the relative-drop check below still catches.
   */
  /** Luma standard deviation at or below this reads as featureless - a
   *  real room, even a plain ceiling, has more contrast than a fingertip. */
  coveredMaxStdDev: 16,
  /** Red over green+blue at or above this reads as light through skin. */
  coveredMinRedRatio: 1.25,
  /** A reading at or below this fraction of the recent baseline counts as
   *  covered on its own, whatever the frame looks like. */
  coveredDropRatio: 0.4,
  /** A featureless frame this much darker than the baseline also counts,
   *  even without the red tint (a covered lens in a dim, warm-lit room). */
  coveredSoftDropRatio: 0.8,
  /** The baseline itself must be at least this bright for the drop check to
   *  apply - in an already-dark room there's no meaningful further "drop" to
   *  detect, and the plant is already asleep via `darkLuma` regardless. */
  coveredBaselineMin: 20,
  /**
   * How much of the baseline survives each uncovered sample that reads
   * *dimmer* than it (0-1). A brighter reading always replaces the baseline
   * immediately - only a dimmer one decays it, and slowly, because
   * uncovering the lens doesn't mean the camera's auto-exposure has finished
   * recovering yet. Without this lag, those still-dim recovery frames would
   * get folded straight into "this room's normal brightness", quietly
   * lowering the baseline every cover/uncover cycle until a second covering
   * could no longer produce a big enough relative drop to register at all.
   */
  baselineDecay: 0.85,
  /** Consecutive covered samples required before it counts as a deliberate
   *  "tuck it in" gesture, not a finger brushing the lens in passing. */
  coveredHoldTicks: 2,
} as const;

/** Touching the plant directly, on top of the button row and phone shaking. */
export const TOUCH = {
  /**
   * A drag faster than this (px/s) anywhere during the touch reads as
   * aggressive. Tuned to catch an ordinary brisk side-to-side slide, not
   * only an extreme flick - it fires live, mid-drag, the moment it's crossed.
   */
  aggressiveVelocity: 500,
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
  /** Holding a finger still on the plant this long counts as a stroke, live. */
  holdDurationMs: 1200,
  /** Once a hold has scored, it scores again this often for as long as the
   *  finger stays down - the longer the hold, the more affection. */
  holdRepeatMs: 600,
  /**
   * Movement past this (much smaller than `minDragForVelocity`) cancels the
   * hold-to-stroke timer. A slow, deliberate drag - pouring water is often
   * unhurried - can easily still be under `minDragForVelocity` a full
   * `holdDurationMs` in, and reusing that bigger threshold here would let
   * the hold fire and lock in a stroke before the drag ever gets a chance
   * to become water or sun.
   */
  holdCancelDistance: 8,
  /**
   * A drag on the plant longer than this, and dominated by one axis (see
   * `directionalAngleRatio`), reads as a deliberate gesture - down to water,
   * up toward the light - rather than an ordinary pet. Bigger than
   * `minDragForVelocity` so a short, mostly-vertical stroke still pets
   * instead of accidentally watering.
   */
  directionalDragMinDistance: 30,
  /** How much one axis must dominate the other for a drag to count as
   *  "vertical" rather than an ambiguous diagonal (which still just pets). */
  directionalAngleRatio: 1.3,
  /**
   * How far a vertical drag has to go before the finger aura previews it
   * (blue for rain, gold for light). Much shorter than
   * `directionalDragMinDistance`: the aura is feedback, not a commitment, so
   * it should react as soon as it's plausible rather than after the gesture
   * has already been decided - waiting for the full 30px left the first part
   * of every slide looking like nothing was happening.
   */
  directionalPreviewDistance: 10,
  /** How far the pupils drift while tracking a finger elsewhere on the stage. */
  eyeMaxOffset: 3.6,
  eyeFollowDuration: 90,
  eyeReturnDuration: 380,
} as const;

/**
 * Turning the phone upside down - rotated 180°, the way you'd hold an
 * upside-down book, screen still facing you but inverted - drops the plant
 * out of its pot for good. Detected from the accelerometer's own gravity
 * reading (see `use-upside-down.ts`) rather than DeviceMotion's interface
 * orientation, which never reports upside-down in a portrait-locked app.
 */
export const FALL = {
  /** Degrees of rotation from the starting orientation that counts as
   *  "upside down" - not quite the full 180° to leave some tolerance. */
  angleThreshold: 140,
  /** Must stay past that angle this long before it counts - a brief fumble
   *  mid-handoff shouldn't permanently end the run. */
  holdMs: 900,
  /**
   * How long the angle may dip back under the threshold without resetting
   * that hold. Shaking a phone adds acceleration on top of gravity, so the
   * measured angle jitters wildly - without this grace, a phone that's
   * upside down *and* being shaken never stays past the threshold long
   * enough to count.
   */
  graceMs: 600,
  /** How much of each new reading goes into the gravity direction the angle
   *  is computed from (0-1: lower filters shake harder, higher reacts
   *  faster to a real turn). */
  angleSmoothing: 0.3,
  /**
   * Below this many degrees of live rotation, the plant doesn't visibly
   * react at all - ordinary handling shifts the phone's angle constantly,
   * and only a real, deliberate turn should show up as the plant tipping.
   */
  deadzoneDeg: 25,
  /** How long the reveal of the fallen scene takes once triggered. */
  revealDelayMs: 280,
  revealDurationMs: 420,
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

type CarnivoreRules = { minCareLight: number; maxAttentionRatio: number; maxRoughness: number };
type CactusRules = { minLightAttention: number; maxCareRatio: number; maxRoughness: number };

const isCarnivore = (s: Scores, rules: CarnivoreRules) =>
  s.care >= rules.minCareLight &&
  s.light >= rules.minCareLight &&
  s.roughness <= rules.maxRoughness &&
  s.attention <= (s.care + s.light) * rules.maxAttentionRatio;

const isCactus = (s: Scores, rules: CactusRules) =>
  s.light >= rules.minLightAttention &&
  s.attention >= rules.minLightAttention &&
  s.roughness <= rules.maxRoughness &&
  s.care <= (s.light + s.attention) * rules.maxCareRatio;

/** The final verdict. Computed once, at level 5. */
export function endingOf(s: Scores): EndingKind {
  const { badRoughness, badMixed, good, carnivore, cactus } = ENDING_RULES;
  if (s.roughness >= badRoughness) return 'bad';
  if (s.roughness >= badMixed.roughness && gentleTotal(s) <= badMixed.maxGentle) return 'bad';
  if (isCarnivore(s, carnivore)) return 'carnivore';
  if (isCactus(s, cactus)) return 'cactus';
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
  const { badRoughness, good, carnivore, cactus } = TENDENCY_RULES;
  if (s.roughness >= badRoughness) return 'bad';
  if (isCarnivore(s, carnivore)) return 'carnivore';
  if (isCactus(s, cactus)) return 'cactus';
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
