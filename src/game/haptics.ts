import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import type { EndingKind, InteractionKind } from './types';

const run = (fn: () => Promise<void>) => {
  if (Platform.OS === 'web') return;
  fn().catch(() => {});
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Each interaction gets a feel of its own: water taps, a shake punches. */
export function hapticFor(kind: InteractionKind) {
  switch (kind) {
    case 'water':
      return run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
    case 'sun':
    case 'daylight':
      return run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft));
    case 'stroke':
    case 'nudge':
      return run(() => Haptics.selectionAsync());
    case 'shake':
    case 'jolt':
      return run(async () => {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        await sleep(90);
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      });
    case 'walk':
    case 'outside':
      return run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
    default:
      return run(() => Haptics.selectionAsync());
  }
}

export function hapticLevelUp() {
  return run(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
    await sleep(110);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  });
}

export function hapticEnding(kind: EndingKind) {
  if (kind === 'fell') {
    // A single sharp drop, not the evil ending's sustained pummelling.
    return run(async () => {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      await sleep(70);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    });
  }
  if (kind === 'bad') {
    return run(async () => {
      for (let i = 0; i < 5; i++) {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        await sleep(110);
      }
    });
  }
  if (kind === 'good') {
    return run(async () => {
      for (const style of [
        Haptics.ImpactFeedbackStyle.Light,
        Haptics.ImpactFeedbackStyle.Medium,
        Haptics.ImpactFeedbackStyle.Soft,
      ]) {
        await Haptics.impactAsync(style);
        await sleep(140);
      }
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    });
  }
  return run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
}

/** Used by the fake system dialog in the evil ending. */
export function hapticAlarm() {
  return run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
}
