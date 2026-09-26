import { useUiStore } from '@/store/ui-store';

import { EVIL_SCRIPT } from './copy';
import { hapticAlarm, hapticEnding } from './haptics';
import { hauntWithNotifications } from './notifications';
import type { EndingKind } from './types';

/**
 * The scripted reveal after a run ends. It is a sequence of timed steps, so
 * it lives here as plain functions over the stores rather than in a
 * component: the code that ends the run just calls `runFinale` and the steps
 * write their results (caption, overlays, notifications) straight to the UI
 * store.
 */

const timers: ReturnType<typeof setTimeout>[] = [];
/** The takeover's permission dialog resolves exactly once, whether the
 *  player taps Allow or the safety net does it for them. */
let dialogResolved = false;

const ui = () => useUiStore.getState();

export function after(ms: number, fn: () => void) {
  timers.push(setTimeout(fn, ms));
}

/** Cancels every pending step - a new specimen starts from nothing. */
export function clearTimers() {
  timers.forEach(clearTimeout);
  timers.length = 0;
  dialogResolved = false;
}

/** The end of the bad ending's theatrics: back to normal, then the verdict. */
export function concludeEnding() {
  ui().setPhotoOpen(false);
  ui().setGlitching(false);
  ui().setWhisper('it was only a game.');
  after(900, () => ui().setSheetUp(true));
}

/** `allowed` is only true when the player actually tapped Allow - that's
 *  what opens the camera. The safety-net timer closes it with `false`, so a
 *  player who never engaged with the dialog is never photographed. */
export function closeDialog(allowed: boolean) {
  ui().setDialogOpen(false);
  if (dialogResolved) return;
  dialogResolved = true;
  if (allowed) ui().setPhotoOpen(true);
  else concludeEnding();
}

const REVEAL: Record<Exclude<EndingKind, 'bad' | 'fell'>, string> = {
  good: 'It opens up, petal by petal.',
  neutral: 'It flattens out into a quiet tuft.',
  carnivore: 'Its leaves fold shut around something.',
  cactus: 'It draws in, thickens, toughens up.',
};

export function runFinale(kind: EndingKind) {
  hapticEnding(kind);

  if (kind === 'fell') {
    // Instant and sad, not the evil ending's elaborate takeover - a single
    // beat, then straight to the verdict.
    ui().setWhisper('It fell.');
    after(1400, () => ui().setSheetUp(true));
    return;
  }

  if (kind !== 'bad') {
    ui().setWhisper(REVEAL[kind]);
    if (kind === 'good') ui().showBurst('petal', 14);
    after(2200, () => ui().setSheetUp(true));
    return;
  }

  dialogResolved = false;
  ui().setGlitching(true);
  hauntWithNotifications();

  for (const step of EVIL_SCRIPT) {
    after(step.at, () => {
      if (step.kind === 'say') ui().setWhisper(step.text);
      if (step.kind === 'notif') {
        const id = ui().pushNotif({
          title: step.title,
          body: step.body,
          color: step.color,
          initial: step.initial,
        });
        after(4200, () => ui().dropNotif(id));
      }
      if (step.kind === 'dialog') {
        ui().setDialogOpen(true);
        hapticAlarm();
      }
    });
  }
  // Safety net: if nobody taps Allow, the run still resolves itself.
  after(9500, () => closeDialog(false));
}
