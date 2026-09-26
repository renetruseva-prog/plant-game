import type { SharedValue } from 'react-native-reanimated';
import { useShallow } from 'zustand/react/shallow';

import { FingerAura } from '@/components/plant/finger-aura';
import { Particles, PulseRing } from '@/components/plant/particles';
import { Plant, SleepZs } from '@/components/plant/plant';
import { TouchLayer } from '@/components/plant/touch-layer';
import { interact, pinch } from '@/game/interact';
import { confirmRestart } from '@/game/session';
import type { Palette } from '@/game/theme';
import type { EndingKind, Env, Mood } from '@/game/types';
import { useEyeTracking } from '@/game/use-eye-tracking';
import { useFingerAura } from '@/game/use-finger-aura';
import { useUiStore } from '@/store/ui-store';

import { Stage } from './stage';

type Props = {
  palette: Palette;
  evil: boolean;
  active: boolean;
  env: Env;
  level: number;
  form: EndingKind | null;
  ending: EndingKind | null;
  mood: Mood;
  roughRatio: number;
  growthKey: number;
  tilt: SharedValue<number>;
  fallAngle: SharedValue<number>;
  onOpenGallery: () => void;
};

/**
 * The stage: the plant, its particles and the layer that reads touches. The
 * touch-following state (pupils, the finger aura) is only needed in here, so
 * it lives here rather than in the screen.
 */
export function GameStage({
  palette,
  evil,
  active,
  env,
  level,
  form,
  ending,
  mood,
  roughRatio,
  growthKey,
  tilt,
  fallAngle,
  onOpenGallery,
}: Props) {
  const { eyeX, eyeY, trackEyes, releaseEyes } = useEyeTracking();
  const { auraX, auraY, auraOpacity, auraKind, showAura, moveAura, startAuraHold, hideAura } = useFingerAura();
  const { burst, shakeKey, pinchKey } = useUiStore(
    useShallow((s) => ({ burst: s.burst, shakeKey: s.shakeKey, pinchKey: s.pinchKey }))
  );
  const { setHelpOpen } = useUiStore.getState();

  return (
    <Stage
      palette={palette}
      evil={evil}
      env={env}
      shakeKey={shakeKey}
      onRestart={confirmRestart}
      restartDisabled={!active}
      onOpenGallery={onOpenGallery}
      onOpenHelp={() => setHelpOpen(true)}>
      <Plant
        level={level}
        mood={mood}
        form={form}
        ending={ending}
        roughRatio={roughRatio}
        popKey={growthKey}
        pinchKey={pinchKey}
        tilt={tilt}
        eyeX={eyeX}
        eyeY={eyeY}
        fallAngle={fallAngle}
      />
      <SleepZs visible={mood === 'sleep'} />
      <Particles burst={burst} />
      <PulseRing pulseKey={growthKey} color={evil ? '#FF3B6B' : '#ffffff'} />
      <TouchLayer
        level={level}
        form={form}
        ending={ending}
        disabled={!active}
        onStroke={() => interact('stroke')}
        onShake={() => interact('shake')}
        onPinch={pinch}
        onWater={() => interact('water')}
        onSun={() => interact('sun')}
        onTrackEyes={trackEyes}
        onReleaseEyes={releaseEyes}
        onAuraShow={showAura}
        onAuraMove={moveAura}
        onAuraHold={startAuraHold}
        onAuraHide={hideAura}
      />
      <FingerAura auraX={auraX} auraY={auraY} auraOpacity={auraOpacity} auraKind={auraKind} />
    </Stage>
  );
}
