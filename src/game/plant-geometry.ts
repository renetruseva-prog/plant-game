import type { EndingKind } from './types';

/**
 * The plant's on-screen geometry, factored out of the renderer so touch
 * hit-testing can use the exact same numbers instead of a hand-copied
 * approximation that could drift out of sync with what's actually drawn.
 *
 * Every function here is a worklet: they're called both from plain JS
 * (rendering) and from gesture handlers running on the UI thread (hit
 * testing), and marking them explicitly avoids depending on Reanimated's
 * auto-workletization heuristic for functions that live in their own module.
 */

export const VIEW_W = 300;
export const VIEW_H = 380;

const STEM_H: Record<number, number> = { 1: 0, 2: 58, 3: 104, 4: 142, 5: 152 };
const HEAD_R: Record<number, number> = { 1: 15, 2: 20, 3: 27, 4: 33, 5: 24 };

export type PlantGeometry = { cx: number; cy: number; r: number; stemH: number };

export function getPlantGeometry(
  level: number,
  form: EndingKind | null,
  ending: EndingKind | null
): PlantGeometry {
  'worklet';
  const lv = Math.min(Math.max(level, 1), 5);
  const stemH = STEM_H[lv];
  const r = ending === 'good' ? 26 : ending === 'bad' ? 36 : HEAD_R[lv];
  const lean = form === 'bad' ? 12 : 0;
  const cx = 150 + lean;
  const cy = lv === 1 ? 292 : 300 - stemH;
  return { cx, cy, r, stemH };
}

/**
 * Whether an SVG-space point (see `toSvgSpace`) lands on the plant: its head
 * - generously sized, since that's the "cheeks" a pinch targets - or the
 * stem-and-pot column beneath it.
 */
export function isOnPlant(
  level: number,
  form: EndingKind | null,
  ending: EndingKind | null,
  x: number,
  y: number
): boolean {
  'worklet';
  const { cx, cy, r } = getPlantGeometry(level, form, ending);
  const headR = r * 1.9;
  const dx = x - cx;
  const dy = y - cy;
  if (dx * dx + dy * dy <= headR * headR) return true;
  return x >= 150 - 65 && x <= 150 + 65 && y >= 280 && y <= 376;
}

/** How the `VIEW_W`x`VIEW_H` viewBox maps into a container of this size,
 *  matching the SVG's `preserveAspectRatio="xMidYMax meet"`: scaled to fit,
 *  centred horizontally, aligned to the bottom. */
export function svgFit(containerW: number, containerH: number) {
  'worklet';
  const scale = Math.min(containerW / VIEW_W, containerH / VIEW_H);
  const renderedW = VIEW_W * scale;
  const renderedH = VIEW_H * scale;
  return { scale, offsetX: (containerW - renderedW) / 2, offsetY: containerH - renderedH };
}

/** A touch point in container pixels, converted into the SVG's own
 *  0-300 x 0-380 coordinate space. */
export function toSvgSpace(containerW: number, containerH: number, x: number, y: number) {
  'worklet';
  const { scale, offsetX, offsetY } = svgFit(containerW, containerH);
  if (scale <= 0) return { x: 0, y: 0 };
  return { x: (x - offsetX) / scale, y: (y - offsetY) / scale };
}
