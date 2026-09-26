import { useGameStore } from '@/store/game-store';
import { useUiStore } from '@/store/ui-store';
import type { ParticleKind } from '@/components/plant/particles';

import { LEVELS, LINES } from './copy';
import { runFinale } from './finale';
import { hapticFor, hapticLevelUp } from './haptics';
import type { InteractionKind } from './types';

const PARTICLE_FOR: Partial<Record<InteractionKind, ParticleKind>> = {
  water: 'water',
  sun: 'sun',
  daylight: 'sun',
  stroke: 'heart',
  nudge: 'heart',
  walk: 'heart',
  shake: 'thorn',
  jolt: 'thorn',
};

const pick = (lines: string[]) => lines[Math.floor(Math.random() * lines.length)];

/**
 * The one entry point for anything that counts as interacting with the plant
 * - a gesture, a phone movement, the room's light changing. It updates the
 * game, then plays the reaction: haptic, particles, mood, caption, and the
 * finale if that was the last one. All of it is the direct consequence of
 * this event, so it happens here, in the handler, not in an effect watching
 * for the change afterwards.
 */
export function interact(kind: InteractionKind) {
  const game = useGameStore.getState();
  if (!game.started || game.ending) return;
  const ui = useUiStore.getState();

  const rough = kind === 'shake' || kind === 'jolt';
  const asleep = game.env === 'dark' && kind !== 'sun' && kind !== 'daylight' && !rough;

  hapticFor(kind);
  if (rough) ui.bumpShake();

  const particle = PARTICLE_FOR[kind];
  if (particle) ui.showBurst(particle, kind === 'water' ? 7 : rough ? 4 : 5);

  ui.flashMood(rough ? 'hurt' : asleep ? 'sleep' : kind === 'walk' ? 'sway' : 'happy');

  game.interact(kind);
  const next = useGameStore.getState();

  if (next.ending) {
    runFinale(next.ending);
  } else if (next.level > game.level) {
    hapticLevelUp();
    const l = LEVELS[next.level - 1];
    ui.setWhisper(`${l.name}. ${l.goal}`);
  } else {
    ui.setWhisper(asleep ? 'It murmurs in its sleep.' : pick(LINES[kind]));
  }
}

/** A pinch on the plant scores as a stroke and additionally bumps the
 *  cheek-squeeze animation, which a plain stroke doesn't trigger. */
export function pinch() {
  useUiStore.getState().bumpPinch();
  interact('stroke');
}

/** Turning the phone upside down: instant and permanent, whatever level the
 *  plant was at. Bypasses `interact` - this isn't a scored interaction, it's
 *  a dedicated way the run can end. */
export function fall() {
  const game = useGameStore.getState();
  if (!game.started || game.ending) return;
  game.fall();
  runFinale('fell');
}
