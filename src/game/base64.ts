const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const LOOKUP = new Uint8Array(256);
for (let i = 0; i < CHARS.length; i++) LOOKUP[CHARS.charCodeAt(i)] = i;

/**
 * Decodes a base64 string to raw bytes without relying on `atob` or the
 * `Buffer` global, neither of which Hermes provides. Only used for the small
 * JPEGs the camera-light sampler captures, so it doesn't need to be fast.
 */
export function base64ToBytes(base64: string): Uint8Array {
  const clean = base64.replace(/[^A-Za-z0-9+/]/g, '');
  const byteLength = Math.floor((clean.length * 6) / 8);
  const bytes = new Uint8Array(byteLength);

  let bitBuffer = 0;
  let bitCount = 0;
  let out = 0;

  for (let i = 0; i < clean.length; i++) {
    bitBuffer = (bitBuffer << 6) | LOOKUP[clean.charCodeAt(i)];
    bitCount += 6;
    if (bitCount >= 8) {
      bitCount -= 8;
      bytes[out++] = (bitBuffer >> bitCount) & 0xff;
    }
  }

  return bytes;
}
