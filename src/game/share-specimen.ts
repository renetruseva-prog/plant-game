import type { Svg } from 'react-native-svg';
import { Share } from 'react-native';
// The legacy API, not the new File/Paths classes: those use synchronous JSI
// calls that aren't reliably available inside Expo Go, where this app is
// actually run - the old promise-based bridge calls always work there.
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import { ENDINGS, STAT_ROWS } from './copy';
import type { HistoryEntry } from './types';

/** Text fallback for when image sharing isn't available (e.g. on web). */
function shareTextFor(entry: HistoryEntry): string {
  const copy = ENDINGS[entry.ending];
  const stats = STAT_ROWS.map(([key, label]) => `${label} ${entry.scores[key]}`).join(' · ');
  return `${entry.mark}\n${copy.title} (${copy.latin})\n${copy.body}\n\n${stats}`;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** One attempt at reading the card as a PNG; `null` if it isn't ready or stalls. */
function snapshot(svg: Svg | null): Promise<string | null> {
  return new Promise((resolve) => {
    if (!svg) return resolve(null);
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(null);
      }
    }, 2500);
    svg.toDataURL((data) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(data || null);
    });
  });
}

/**
 * Turns the (already mounted) export card into a PNG and opens the share
 * sheet with it, falling back to a text summary if the image can't be made.
 *
 * The native SVG view needs a moment to mount and lay out before
 * `toDataURL` has anything to read - a single frame's wait came back empty
 * every time - so this waits and retries. The output size is deliberately
 * left to default: an explicit `width`/`height` makes a bigger bitmap but
 * doesn't scale the drawing to fill it, leaving the card in a corner.
 */
export async function shareSpecimen(entry: HistoryEntry, getCard: () => Svg | null) {
  try {
    let base64: string | null = null;
    for (let attempt = 0; attempt < 6 && !base64; attempt++) {
      await sleep(attempt === 0 ? 400 : 500);
      base64 = await snapshot(getCard());
    }
    if (!base64) throw new Error('toDataURL returned no data after retries');
    if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing.isAvailableAsync() returned false');
    const uri = `${FileSystem.cacheDirectory}${entry.mark.replace(/\s+/g, '-')}.png`;
    await FileSystem.writeAsStringAsync(uri, base64, { encoding: 'base64' });
    await Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: 'Share this specimen' });
  } catch (e) {
    // No image sharing on this platform (or the capture/write failed) - fall
    // back to the plain-text summary rather than doing nothing. Logged, not
    // swallowed silently, so a real failure is diagnosable.
    console.warn('Image share failed, falling back to text:', e);
    await Share.share({ message: shareTextFor(entry) }).catch(() => {});
  }
}
