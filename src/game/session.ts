import { Alert } from 'react-native';

import { useGameStore } from '@/store/game-store';
import { useUiStore } from '@/store/ui-store';

import { LEVELS, WHISPER_START } from './copy';
import { clearTimers, runFinale } from './finale';
import { cancelHaunting } from './notifications';
import type { EndingKind } from './types';

/** Actually begins gameplay, dismissing the title card and tutorial alike. */
export function beginRun() {
  const ui = useUiStore.getState();
  ui.setShowTutorial(false);
  useGameStore.getState().start();
  ui.setWhisper(WHISPER_START);
}

/**
 * Starts over with a new specimen. `jump` and `force` are the hidden dev
 * panel's shortcuts to a level or an ending; without either it's a normal
 * restart, which runs the intro and tutorial again.
 */
export function newSpecimen(next?: { jump?: number; force?: EndingKind }) {
  clearTimers();
  cancelHaunting();
  const ui = useUiStore.getState();
  const game = useGameStore.getState();
  ui.resetTransient();

  if (next?.jump) {
    game.devJump(next.jump);
    const l = LEVELS[next.jump - 1];
    ui.setWhisper(`${l.name}. ${l.goal}`);
  } else if (next?.force) {
    game.devForce(next.force);
    runFinale(next.force);
  } else {
    game.reset();
    ui.setWhisper(WHISPER_START);
  }
}

/** Player-facing restart, reachable mid-run - unlike the hidden demo panel,
 *  this asks first: it throws away real progress. */
export function confirmRestart() {
  Alert.alert('Restart the game?', 'This specimen and its progress will be lost.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Restart', style: 'destructive', onPress: () => newSpecimen() },
  ]);
}
