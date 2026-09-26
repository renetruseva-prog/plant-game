import { FINAL_COUNT, THRESHOLDS, applyWeights, endingOf, levelFor } from './config';
import type { EndingKind, GameState, InteractionKind, Scores } from './types';

/**
 * The game's rules as plain functions from one `GameState` to the next. No
 * storage, no React, no side effects - the store's actions call these, so
 * the rules stay testable and the store stays a thin layer over them.
 */

const ZERO_SCORES: Scores = { care: 0, light: 0, attention: 0, roughness: 0 };

const ZERO_COUNTS: Record<InteractionKind, number> = {
  water: 0,
  sun: 0,
  stroke: 0,
  shake: 0,
  walk: 0,
  nudge: 0,
  jolt: 0,
  daylight: 0,
  nightfall: 0,
  sleep: 0,
};

export function freshState(): GameState {
  return {
    count: 0,
    counts: { ...ZERO_COUNTS },
    scores: { ...ZERO_SCORES },
    level: 1,
    ending: null,
    env: 'day',
    started: false,
    generation: 1,
    legacy: null,
  };
}

export const newMark = () => `Specimen No. ${String(Math.floor(Math.random() * 9000) + 1000)}`;

/**
 * One interaction. Both the level-up and the ending fall out of `count`, so
 * the dev helpers below replay the exact path a real playthrough takes.
 */
export function applyInteraction(state: GameState, kind: InteractionKind): GameState {
  if (state.ending) return state;
  const count = state.count + 1;
  const scores = applyWeights(state.scores, kind);
  const next: GameState = {
    ...state,
    count,
    counts: { ...state.counts, [kind]: state.counts[kind] + 1 },
    scores,
    level: levelFor(count),
    // A light interaction also moves the room into that state.
    env: kind === 'nightfall' ? 'dark' : kind === 'daylight' || kind === 'sun' ? 'day' : state.env,
  };
  if (count >= FINAL_COUNT) {
    next.level = 5;
    next.ending = endingOf(scores);
  }
  return next;
}

/** Instant and permanent, whatever the current progress - falling out of the
 *  pot doesn't care what level the plant was at. */
export function applyFall(state: GameState): GameState {
  if (state.ending) return state;
  return { ...state, level: 5, count: Math.max(state.count, FINAL_COUNT), ending: 'fell' };
}

/** A new specimen: back to the start, but remembering how the last one ended.
 *  A run abandoned before it reached a verdict leaves the lineage alone.
 *  `started` stays false so the intro and tutorial run again. */
export function nextSpecimen(previous: GameState): GameState {
  return {
    ...freshState(),
    generation: previous.generation + 1,
    legacy: previous.ending ?? previous.legacy,
  };
}

/** Dev helper: replay a plausible gentle run up to the start of `level`. */
export function gentleRunTo(level: number): GameState {
  const target = THRESHOLDS[level - 1];
  const kinds: InteractionKind[] = ['water', 'sun', 'stroke'];
  let s: GameState = { ...freshState(), started: true };
  for (let i = 0; i < target; i++) s = applyInteraction(s, kinds[i % kinds.length]);
  return s;
}

const ENDING_PLANS: Record<EndingKind, InteractionKind[]> = {
  good: ['water', 'sun', 'stroke'],
  neutral: ['water', 'water', 'stroke'],
  bad: ['shake', 'shake', 'water'],
  fell: ['water', 'stroke', 'sun'],
  carnivore: ['water', 'sun'],
  cactus: ['sun', 'stroke'],
};

/** Dev helper: a finished run with the requested ending. */
export function runEndingAs(ending: EndingKind): GameState {
  const plan = ENDING_PLANS[ending];
  let s: GameState = { ...freshState(), started: true };
  for (let i = 0; i < FINAL_COUNT; i++) s = applyInteraction(s, plan[i % plan.length]);
  // Guarantee the requested ending even if the weights are retuned later.
  return { ...s, level: 5, ending };
}
