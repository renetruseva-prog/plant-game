import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { HistoryEntry } from '@/game/types';

import { storage } from './storage';

/** Past specimens kept for the gallery; the oldest drop off past this. */
const HISTORY_LIMIT = 50;

type HistoryStore = {
  /** Newest first. */
  entries: HistoryEntry[];
  /** False until the saved gallery has been read - the gallery shows nothing
   *  rather than a wrongly empty list until then. */
  hydrated: boolean;
  /** Records a finished run. De-duped by `mark`, so recording the same run
   *  twice (e.g. an already-finished run reloaded) is harmless. */
  add: (entry: HistoryEntry) => void;
  remove: (mark: string) => void;
  clear: () => void;
};

export const useHistoryStore = create<HistoryStore>()(
  persist(
    (set) => ({
      entries: [],
      hydrated: false,
      add: (entry) =>
        set((s) =>
          s.entries.some((h) => h.mark === entry.mark)
            ? s
            : { entries: [entry, ...s.entries].slice(0, HISTORY_LIMIT) }
        ),
      remove: (mark) => set((s) => ({ entries: s.entries.filter((h) => h.mark !== mark) })),
      clear: () => set({ entries: [] }),
    }),
    {
      name: 'specimen.history.v2',
      storage,
      partialize: (s) => ({ entries: s.entries }),
      onRehydrateStorage: () => () => {
        useHistoryStore.setState({ hydrated: true });
      },
    }
  )
);
