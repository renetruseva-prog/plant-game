import { decode } from 'jpeg-js';

import { CAMERA_LIGHT } from './config';
import { base64ToBytes } from './base64';

/** Roughly how many pixels to sample per frame, whatever the frame's size. */
const TARGET_SAMPLES = 5000;

export type FrameStats = {
  /** Average Rec. 601 luma, 0-255. */
  luma: number;
  /** Standard deviation of luma across the frame - how much detail/contrast
   *  it has. A finger pressed over the lens reads as near-featureless. */
  lumaStdDev: number;
  /** Mean red over the mean of green and blue. Light shining through a
   *  fingertip comes out strongly red; an ordinary room doesn't. */
  redRatio: number;
};

/**
 * Decodes a base64 JPEG and summarises it. Samples a fixed number of pixels
 * rather than every one, so the summation loop costs the same whatever
 * resolution the camera hands back - the decode itself is still the
 * expensive part, which is why the sensor asks for the smallest picture size
 * it can.
 */
export function frameStatsFromBase64Jpeg(base64: string): FrameStats | null {
  try {
    const bytes = base64ToBytes(base64);
    const { data, width, height } = decode(bytes, { useTArray: true });
    const pixelCount = width * height;
    if (pixelCount === 0) return null;

    const stride = Math.max(CAMERA_LIGHT.sampleStride, Math.floor(pixelCount / TARGET_SAMPLES));
    let sum = 0;
    let sumSq = 0;
    let r = 0;
    let g = 0;
    let b = 0;
    let sampled = 0;
    for (let p = 0; p < pixelCount; p += stride) {
      const i = p * 4; // RGBA
      const y = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      sum += y;
      sumSq += y * y;
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      sampled++;
    }
    if (sampled === 0) return null;

    const luma = sum / sampled;
    const variance = Math.max(0, sumSq / sampled - luma * luma);
    const meanR = r / sampled;
    const meanGB = (g + b) / (2 * sampled);
    return { luma, lumaStdDev: Math.sqrt(variance), redRatio: meanR / (meanGB + 1) };
  } catch {
    // A single bad frame shouldn't take the whole sampler down with it.
    return null;
  }
}

/**
 * The median of the last few readings, not their average - a brief spike
 * (motion blur, a hand crossing the lens as the phone is set down) is an
 * outlier a median shrugs off, where an average would still drag toward it.
 */
export function medianOf(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}
