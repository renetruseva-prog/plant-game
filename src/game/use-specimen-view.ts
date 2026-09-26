import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { useGameStore } from '@/store/game-store';
import { useUiStore } from '@/store/ui-store';

import { tendencyOf } from './config';
import { ENDINGS, LEVELS, latinFor } from './copy';
import { paletteFor } from './theme';
import type { EndingKind, Mood } from './types';

/**
 * How the current specimen looks, worked out from the stores: its palette,
 * form, mood on screen, and the words on its tag. All of it is derived - none
 * of it is stored anywhere, so there is nothing to keep in sync by hand.
 */
export function useSpecimenView() {
  const game = useGameStore(
    useShallow((s) => ({
      level: s.level,
      env: s.env,
      ending: s.ending,
      legacy: s.legacy,
      scores: s.scores,
      generation: s.generation,
      mark: s.mark,
      count: s.count,
      started: s.started,
    }))
  );
  const mood = useUiStore((s) => s.mood);

  const { level, env, ending, legacy, scores } = game;
  const finished = ending !== null;

  const tendency = useMemo(() => (level >= 4 ? tendencyOf(scores) : null), [level, scores]);
  const form: EndingKind | null = ending ?? tendency;
  const palette = useMemo(
    () => paletteFor(level, env, tendency, ending, legacy),
    [level, env, tendency, ending, legacy]
  );

  const totalScore = scores.care + scores.light + scores.attention + scores.roughness;
  const roughRatio = totalScore === 0 ? 0 : scores.roughness / totalScore;

  // The room being dark puts the plant to sleep, unless it's hurt.
  const displayMood: Mood = finished ? 'idle' : env === 'dark' && mood !== 'hurt' ? 'sleep' : mood;

  const stage = ending ? LEVELS[4] : LEVELS[level - 1];

  return {
    ...game,
    finished,
    active: game.started && !finished,
    evil: ending === 'bad',
    form,
    palette,
    roughRatio,
    displayMood,
    /** Bumped by growth alone, so the pop and the ring are derived from the
     *  game state rather than from extra counters kept in sync by hand. */
    growthKey: level * 2 + (ending ? 1 : 0),
    latin: latinFor(level, form, ending),
    stageName: stage.name,
    goal: ending ? ENDINGS[ending].goal : stage.goal,
  };
}
