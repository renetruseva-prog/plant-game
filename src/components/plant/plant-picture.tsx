import type { StyleProp, ViewStyle } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { VIEW_H, VIEW_W } from '@/game/plant-geometry';
import type { Palette } from '@/game/theme';
import type { EndingKind, Scores } from '@/game/types';

import { PlantScene } from './plant-art';

/** The share of a run's points that were rough, which tints a plant's head as
 *  it sours - the same figure the live game feeds `Plant`. */
export function roughRatioOf(scores: Scores): number {
  const total = scores.care + scores.light + scores.attention + scores.roughness;
  return total === 0 ? 0 : scores.roughness / total;
}

/**
 * A finished specimen as a still picture: its plant, in its own ending's
 * stage colours, at rest. Drawn by the same `PlantScene` the live plant
 * uses, so it's always the plant that was actually raised.
 */
export function PlantPicture({
  ending,
  scores,
  palette,
  style,
}: {
  ending: EndingKind;
  scores: Scores;
  palette: Palette;
  style?: StyleProp<ViewStyle>;
}) {
  // Nothing is touching it, so the pupils just rest where they are.
  const eyeX = useSharedValue(0);
  const eyeY = useSharedValue(0);

  return (
    <Svg style={style} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="xMidYMax meet">
      <Defs>
        <LinearGradient id="stage" x1="0" y1="0" x2="0.35" y2="1">
          <Stop offset="0" stopColor={palette.stageTop} />
          <Stop offset="1" stopColor={palette.stageBottom} />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={VIEW_W} height={VIEW_H} fill="url(#stage)" />
      <PlantScene
        level={5}
        mood="idle"
        form={ending}
        ending={ending}
        roughRatio={roughRatioOf(scores)}
        eyeX={eyeX}
        eyeY={eyeY}
      />
    </Svg>
  );
}
