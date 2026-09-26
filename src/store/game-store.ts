import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { ENDINGS } from '@/game/copy';
import { envFromClock } from '@/game/clock';
import {
  applyFall,
  applyInteraction,
  freshState,
  gentleRunTo,
  newMark,
  nextSpecimen,
  runEndingAs,
} from '@/game/rules';
import type { EndingKind, GameState, InteractionKind } from '@/game/types';

import { useHistoryStore } from './history-store';
import { storage } from './storage';
import { useUiStore } from './ui-store';

type GameActions = {
  /** Dismisses the title card and tutorial: the run begins. */
  start: () => void;
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
      // Must match the version already on players' phones, or the save is ignored.
      version: 1,
      storage,
      // Everything but the actions and the `hydrated` flag.
      partialize: (s) => ({
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
      // Nothing saved yet: no sensor reading either, so seed the room from
      // the time of day.
      merge: (persisted, current) =>
        persisted ? { ...current, ...(persisted as object) } : { ...current, env: envFromClock() },
      onRehydrateStorage: () => (state) => {
        useGameStore.setState({ hydrated: true });
        // Returning to a finished run: show the verdict, skip the theatrics.
        if (state?.ending) useUiStore.getState().showVerdictOnly();
      },
    }
  )
);
