import AsyncStorage from '@react-native-async-storage/async-storage';

import { FINAL_COUNT, THRESHOLDS, applyWeights, endingOf, levelFor } from './config';
import type { EndingKind, GameState, InteractionKind, Scores } from './types';

const STORAGE_KEY = 'specimen.state.v1';

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
  };
}

export type Action =
  | { type: 'start' }
  | { type: 'interact'; kind: InteractionKind }
  | { type: 'setEnv'; env: 'day' | 'dark' }
  | { type: 'hydrate'; state: GameState }
  | { type: 'reset' }
  | { type: 'devJump'; level: number }
  | { type: 'devForce'; ending: EndingKind }
  /** Turning the phone upside down: instant, regardless of progress. */
  | { type: 'fall' };

/**
 * Pure reducer. Both the level-up and the ending fall out of `count`, so the
 * dev jump helpers can reuse the exact same path a real playthrough takes.
 */
export function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'hydrate':
      return action.state;

    case 'start':
      return { ...state, started: true };

    case 'reset':
      return { ...freshState(), started: true };

    case 'setEnv':
      if (state.ending) return state;
      return { ...state, env: action.env };

    case 'interact': {
      if (state.ending) return state;
      const { kind } = action;
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

    case 'devJump': {
      // Replay a plausible gentle run up to the requested level.
      const target = THRESHOLDS[action.level - 1];
      const keys: InteractionKind[] = ['water', 'sun', 'stroke'];
      let s: GameState = { ...freshState(), started: true };
      for (let i = 0; i < target; i++) {
        s = reducer(s, { type: 'interact', kind: keys[i % keys.length] });
      }
      return s;
    }

    case 'devForce': {
      const plans: Record<EndingKind, InteractionKind[]> = {
        good: ['water', 'sun', 'stroke'],
        neutral: ['water', 'water', 'stroke'],
        bad: ['shake', 'shake', 'water'],
        fell: ['water', 'stroke', 'sun'],
        carnivore: ['water', 'sun'],
        cactus: ['sun', 'stroke'],
      };
      const plan = plans[action.ending];
      let s: GameState = { ...freshState(), started: true };
      for (let i = 0; i < FINAL_COUNT; i++) {
        s = reducer(s, { type: 'interact', kind: plan[i % plan.length] });
      }
      // Guarantee the requested ending even if the weights are retuned later.
      return { ...s, level: 5, ending: action.ending };
    }

    case 'fall': {
      // Instant and permanent, whatever the current progress - falling out
      // of the pot doesn't care what level the plant was at.
      if (state.ending) return state;
      return { ...state, level: 5, count: Math.max(state.count, FINAL_COUNT), ending: 'fell' };
    }
  }
}

export async function saveState(state: GameState) {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Persistence is a nicety; never let it break a live demo.
  }
}

export async function loadState(): Promise<GameState | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<GameState>;
    if (typeof parsed.count !== 'number') return null;
    return {
      ...freshState(),
      ...parsed,
      counts: { ...ZERO_COUNTS, ...parsed.counts },
      scores: { ...ZERO_SCORES, ...parsed.scores },
    };
  } catch {
    return null;
  }
}

export async function clearState() {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
