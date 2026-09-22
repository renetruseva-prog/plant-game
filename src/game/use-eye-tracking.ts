import { useSharedValue, withTiming } from 'react-native-reanimated';

import { TOUCH } from './config';

/**
 * Owns the pupil-offset shared values and hands back worklet functions that
 * close over them, rather than the values themselves - a component that only
 * received `eyeX`/`eyeY` as props couldn't write to them (mutating a prop
 * isn't allowed), but calling a function prop that does the writing on their
 * behalf is fine.
 */
export function useEyeTracking() {
  const eyeX = useSharedValue(0);
  const eyeY = useSharedValue(0);

  const trackEyes = (dx: number, dy: number, pull: number) => {
    'worklet';
    eyeX.value = withTiming(dx * pull * TOUCH.eyeMaxOffset, { duration: TOUCH.eyeFollowDuration });
    eyeY.value = withTiming(dy * pull * TOUCH.eyeMaxOffset, { duration: TOUCH.eyeFollowDuration });
  };

  const releaseEyes = () => {
    'worklet';
    eyeX.value = withTiming(0, { duration: TOUCH.eyeReturnDuration });
    eyeY.value = withTiming(0, { duration: TOUCH.eyeReturnDuration });
  };

  return { eyeX, eyeY, trackEyes, releaseEyes };
}
