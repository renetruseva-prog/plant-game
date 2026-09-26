import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { ENDINGS } from '@/game/copy';
import { envFromClock } from '@/game/clock';
import {
  ZERO_COUNTS,
  ZERO_SCORES,
  applyFall,
  applyInteraction,
  freshState,
  gentleRunTo,
  newMark,
  nextSpecimen,
  runEndingAs,
} from '@/game/rules';
import type { EndingKind, Env, GameState, InteractionKind } from '@/game/types';

import { useHistoryStore } from './history-store';
import { createStorage } from './storage';
import { useUiStore } from './ui-store';

type GameActions = {
  /** Dismisses the title card and tutorial: the run begins. */
  start: () => void;
  setEnv: (env: Env) => void;
  /** One scored interaction. Records the run in the gallery if it was the
   *  one that ended it. */
  interact: (kind: InteractionKind) => void;
  /** Turning the phone upside down: instant and permanent. */
  fall: () => void;
  /** A new specimen, remembering how the last one ended. */
  reset: () => void;
  /** Dev panel: jump to the start of a level. */
  devJump: (level: number) => void;
  /** Dev panel: a finished run with this ending. */
  devForce: (ending: EndingKind) => void;
};

export type GameStore = GameState &
  GameActions & {
    /** This specimen's number, kept so reopening a finished run doesn't get
     *  it a new one (and a second gallery entry). */
    mark: string;
    /** False until the saved run has been read. */
    hydrated: boolean;
  };

/** The part of the store that is saved. */
const GAME_KEYS = [
  'count',
  'counts',
  'scores',
  'level',
  'ending',
  'env',
  'started',
  'generation',
  'legacy',
  'mark',
] as const;

type Saved = Pick<GameStore, (typeof GAME_KEYS)[number]>;

/** Records a finished run in the gallery - done here, in the action that
 *  ends the run, rather than by something watching the state for it. */
function recordEnding(state: GameState, mark: string) {
  if (!state.ending) return;
  useHistoryStore.getState().add({
    mark,
    ending: state.ending,
    latin: ENDINGS[state.ending].latin,
    scores: state.scores,
    date: Date.now(),
  });
}

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      ...freshState(),
      mark: newMark(),
      hydrated: false,

      start: () => set({ started: true }),

      setEnv: (env) => {
        if (get().ending) return;
        set({ env });
      },

      interact: (kind) => {
        const prev = get();
        if (!prev.started || prev.ending) return;
        const next = applyInteraction(prev, kind);
        set(next);
        recordEnding(next, prev.mark);
      },

      fall: () => {
        const prev = get();
        if (!prev.started || prev.ending) return;
        const next = applyFall(prev);
        set(next);
        recordEnding(next, prev.mark);
      },

      reset: () => set((prev) => ({ ...nextSpecimen(prev), mark: newMark() })),

      devJump: (level) => set({ ...gentleRunTo(level), mark: newMark() }),

      devForce: (ending) => {
        const run = runEndingAs(ending);
        const mark = newMark();
        set({ ...run, mark });
        recordEnding(run, mark);
      },
    }),
    {
      name: 'specimen.game.v2',
      version: 1,
      // The old code stored the bare game state under its own key.
      storage: createStorage('specimen.state.v1', (legacy) => legacy, 1),
      partialize: (s): Saved => ({
        count: s.count,
        counts: s.counts,
        scores: s.scores,
        level: s.level,
        ending: s.ending,
        env: s.env,
        started: s.started,
        generation: s.generation,
        legacy: s.legacy,
        mark: s.mark,
      }),
      // Backfills anything a save from an older version lacks, and picks only
      // the keys it knows, so fields the game has since dropped don't linger.
      merge: (persisted, current) => {
        if (!persisted) {
          // Nothing saved: no sensor reading yet, so seed the room from the
          // time of day.
          return { ...current, env: envFromClock() };
        }
        const p = persisted as Partial<Saved>;
        const merged: Partial<Saved> = {};
        for (const key of GAME_KEYS) if (p[key] !== undefined) (merged as Record<string, unknown>)[key] = p[key];
        return {
          ...current,
          ...merged,
          counts: { ...ZERO_COUNTS, ...p.counts },
          scores: { ...ZERO_SCORES, ...p.scores },
        };
      },
      onRehydrateStorage: () => (state) => {
        useGameStore.setState({ hydrated: true });
        // Returning to a finished run: show the verdict, skip the theatrics.
        if (state?.ending) useUiStore.getState().showVerdictOnly();
      },
    }
  )
);
