import Svg, { Circle, Path } from 'react-native-svg';

export type IconKind =
  | 'water'
  | 'sun'
  | 'stroke'
  | 'shake'
  | 'walk'
  | 'moon'
  | 'gallery'
  | 'help'
  | 'back'
  | 'close'
  | 'skip'
  | 'trash';

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
    case 'gallery':
      // A small pressed specimen behind glass: the herbarium framing.
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M4 4h16v16H4z" {...p} />
          <Path d="M8 16c0-5 2-7 4-9 2 2 4 4 4 9" {...p} />
        </Svg>
      );
    case 'help':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Circle cx={12} cy={12} r={9} {...p} />
          <Path d="M9.3 9.4a2.7 2.7 0 1 1 4 2.3c-1 .6-1.3 1.1-1.3 2.1" {...p} />
          <Circle cx={12} cy={17.3} r={0.9} fill={color} stroke="none" />
        </Svg>
      );
    case 'back':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M15 5l-7 7 7 7" {...p} />
        </Svg>
      );
    case 'close':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M6 6l12 12M18 6L6 18" {...p} />
        </Svg>
      );
    case 'trash':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" {...p} />
        </Svg>
      );
    case 'skip':
      // Skip-forward: a play triangle running into a bar.
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M6 5l10 7-10 7z" {...p} />
          <Path d="M19 5v14" {...p} />
        </Svg>
      );
  }
}
