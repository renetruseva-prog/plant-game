import { decode } from 'jpeg-js';

import { CAMERA_LIGHT } from './config';
import { base64ToBytes } from './base64';

/**
 * Decodes a base64 JPEG and returns its average luma (0-255), sampling every
 * `sampleStride`th pixel rather than all of them - the decode itself is the
 * expensive part, so this only trims the summation loop, but it keeps that
 * loop cheap on a large frame.
 */
export function averageLumaFromBase64Jpeg(base64: string): number | null {
  try {
    const bytes = base64ToBytes(base64);
    const { data, width, height } = decode(bytes, { useTArray: true });
    const pixelCount = width * height;
    if (pixelCount === 0) return null;

    let sum = 0;
    let sampled = 0;
    const stride = CAMERA_LIGHT.sampleStride;
    for (let p = 0; p < pixelCount; p += stride) {
      const i = p * 4; // RGBA
      // Rec. 601 luma.
      sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      sampled++;
    }
    return sampled > 0 ? sum / sampled : null;
  } catch {
    // A single bad frame shouldn't take the whole sampler down with it.
    return null;
  }
}
