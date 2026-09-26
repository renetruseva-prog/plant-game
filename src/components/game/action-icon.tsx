import Svg, { Circle, Path } from 'react-native-svg';

export type IconKind = 'water' | 'sun' | 'stroke' | 'shake' | 'walk' | 'moon';

/**
 * The whole line-icon set, shared between the action buttons and the
 * tutorial so the tutorial's pictures are the exact glyphs the player then
 * sees on the actual buttons - not a lookalike drawn twice.
 */
export function ActionIcon({ kind, color, size = 28 }: { kind: IconKind; color: string; size?: number }) {
  const p = { stroke: color, strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' } as const;
  switch (kind) {
    case 'water':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M12 3S5 11 5 15a7 7 0 0 0 14 0c0-4-7-12-7-12z" {...p} />
        </Svg>
      );
    case 'sun':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Circle cx={12} cy={12} r={4} {...p} />
          <Path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" {...p} />
        </Svg>
      );
    case 'stroke':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" {...p} />
        </Svg>
      );
    case 'shake':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M2 12l4-6 4 12 4-12 4 12 4-6" {...p} />
        </Svg>
      );
    case 'walk':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M8 3a2 2 0 0 1 2 2v3a2 2 0 0 1-4 0V5a2 2 0 0 1 2-2z" {...p} />
          <Path d="M16 10a2 2 0 0 1 2 2v3a2 2 0 0 1-4 0v-3a2 2 0 0 1 2-2z" {...p} />
          <Path d="M6 14c0 3 2 4 2 7M18 21c0-3-2-4-2-7" {...p} />
        </Svg>
      );
    case 'moon':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" {...p} />
        </Svg>
      );
  }
}
