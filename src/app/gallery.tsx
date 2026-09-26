import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
// The legacy API, not the new File/Paths classes: those use synchronous JSI
// calls that aren't reliably available inside Expo Go, where this app is
// actually run - the old promise-based bridge calls always work there.
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import type Svg from 'react-native-svg';

import { ActionIcon } from '@/components/game/action-icon';
import { SpecimenCardArt } from '@/components/game/specimen-card-art';
import { PlantPicture } from '@/components/plant/plant-picture';
import { VIEW_H, VIEW_W } from '@/game/plant-geometry';
import { ENDINGS } from '@/game/copy';
import { family, useGameFonts } from '@/game/fonts';
import { deleteAllHistory, deleteHistory, loadHistory, type HistoryEntry } from '@/game/state';
import { paletteFor, type Palette } from '@/game/theme';
import type { Scores } from '@/game/types';

/** Every destructive control in the gallery shares this one red. */
const DELETE_RED = '#D64545';

const STAT_ROWS: [keyof Scores, string][] = [
  ['care', 'Care'],
  ['light', 'Light'],
  ['attention', 'Attention'],
  ['roughness', 'Rough'],
];

/** Text fallback for when image sharing isn't available (e.g. on web). */
function shareTextFor(entry: HistoryEntry): string {
  const copy = ENDINGS[entry.ending];
  const stats = STAT_ROWS.map(([key, label]) => `${label} ${entry.scores[key]}`).join(' · ');
  return `${entry.mark}\n${copy.title} (${copy.latin})\n${copy.body}\n\n${stats}`;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Every ending gets its own finished palette (see `theme.ts`), same as the
 *  in-game ending sheet - a bad-ending specimen and a good one shouldn't
 *  look identical here. */
function paletteForEntry(entry: HistoryEntry): Palette {
  return paletteFor(5, 'day', null, entry.ending);
}

function SpecimenCard({
  entry,
  palette,
  onShare,
  onDelete,
}: {
  entry: HistoryEntry;
  palette: Palette;
  onShare: (entry: HistoryEntry) => void;
  onDelete: (entry: HistoryEntry) => void;
}) {
  const copy = ENDINGS[entry.ending];

  return (
    <Animated.View
      entering={FadeIn.duration(220)}
      style={[styles.card, { backgroundColor: palette.paper, borderColor: palette.line, borderRadius: palette.radius }]}>
      <View style={styles.cardTop}>
        <Text style={[styles.mark, { color: palette.dim, fontFamily: family('medium', false) }]}>{entry.mark}</Text>
        <Text style={[styles.date, { color: palette.dim, fontFamily: family('medium', false) }]}>
          {formatDate(entry.date)}
        </Text>
      </View>

      <View style={styles.identity}>
        <View style={[styles.picture, { borderColor: palette.line, borderRadius: palette.radius - 4 }]}>
          <PlantPicture ending={entry.ending} scores={entry.scores} palette={palette} style={StyleSheet.absoluteFill} />
        </View>
        <View style={styles.identityText}>
          <Text style={[styles.title, { color: palette.ink, fontFamily: family('black', false) }]}>{copy.title}</Text>
          <Text style={[styles.latin, { color: palette.dim, fontFamily: family('latin', false) }]}>{entry.latin}</Text>
        </View>
      </View>

      <View style={styles.stats}>
        {STAT_ROWS.map(([key, label]) => (
          <View key={key} style={[styles.stat, { borderColor: palette.line }]}>
            <Text style={[styles.statValue, { color: palette.ink, fontFamily: family('bold', false) }]}>
              {entry.scores[key]}
            </Text>
            <Text style={[styles.statLabel, { color: palette.dim, fontFamily: family('body', false) }]}>{label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          onPress={() => onShare(entry)}
          style={[styles.actionBtn, { borderColor: palette.line }]}>
          <Text style={[styles.actionText, { color: palette.ink, fontFamily: family('semibold', false) }]}>Share</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Delete ${entry.mark}`}
          onPress={() => onDelete(entry)}
          style={[styles.actionBtn, styles.deleteBtn]}>
          <ActionIcon kind="trash" color={DELETE_RED} size={16} />
          <Text style={[styles.actionText, { color: DELETE_RED, fontFamily: family('semibold', false) }]}>Delete</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

/**
 * The herbarium: every finished run this device has recorded, newest first.
 * Local only - see `appendHistory` in `state.ts` - with a native share sheet
 * per card rather than any kind of public/online gallery.
 */
export default function GalleryScreen() {
  const fontsLoaded = useGameFonts();
  const router = useRouter();
  const [history, setHistory] = useState<HistoryEntry[] | null>(null);
  /** The one entry currently being rendered off-screen for export, if any -
   *  kept to a single entry rather than one hidden card per history row, so
   *  sharing doesn't pay to keep every past specimen's full-resolution art
   *  mounted at once. */
  const [sharing, setSharing] = useState<HistoryEntry | null>(null);
  const captureRef = useRef<Svg>(null);
  const listPalette = paletteFor(1, 'day', null, null);

  useEffect(() => {
    let cancelled = false;
    loadHistory().then((list) => {
      if (!cancelled) setHistory(list);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Asks first: a deleted specimen can't be brought back.
  const onDelete = useCallback((entry: HistoryEntry) => {
    Alert.alert('Delete this specimen?', `${entry.mark} will be removed from your collection.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteHistory(entry.mark);
          setHistory((list) => (list ? list.filter((h) => h.mark !== entry.mark) : list));
        },
      },
    ]);
  }, []);

  const onDeleteAll = useCallback(() => {
    Alert.alert('Delete all specimens?', 'Your whole collection will be removed. This can’t be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete all',
        style: 'destructive',
        onPress: () => {
          deleteAllHistory();
          setHistory([]);
        },
      },
    ]);
  }, []);

  const onShare = useCallback((entry: HistoryEntry) => {
    setSharing(entry);
  }, []);

  // Once the hidden export card for `sharing` has mounted, turn it into a PNG
  // and open the share sheet. The native SVG view needs a moment to mount and
  // lay out before `toDataURL` has anything to read - a single frame's wait
  // came back empty every time - so this waits and retries.
  //
  // The output size is deliberately left to default. Passing an explicit
  // `width`/`height` makes a bigger bitmap but doesn't scale the drawing to
  // fill it - the card came out occupying about two thirds of the image,
  // with the rest empty.
  useEffect(() => {
    if (!sharing) return;
    const entry = sharing;
    let cancelled = false;

    const snapshot = () =>
      new Promise<string | null>((resolve) => {
        const svg = captureRef.current;
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

    (async () => {
      try {
        let base64: string | null = null;
        for (let attempt = 0; attempt < 6 && !base64 && !cancelled; attempt++) {
          await new Promise((r) => setTimeout(r, attempt === 0 ? 400 : 500));
          if (cancelled) return;
          base64 = await snapshot();
        }
        if (cancelled) return;
        if (!base64) throw new Error('toDataURL returned no data after retries');
        const canShareFile = await Sharing.isAvailableAsync();
        if (!canShareFile) throw new Error('Sharing.isAvailableAsync() returned false');
        const uri = `${FileSystem.cacheDirectory}${entry.mark.replace(/\s+/g, '-')}.png`;
        await FileSystem.writeAsStringAsync(uri, base64, { encoding: 'base64' });
        await Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: 'Share this specimen' });
      } catch (e) {
        // No image sharing on this platform (or the capture/write failed)
        // - fall back to the plain-text summary rather than doing nothing.
        // Logged, not swallowed silently, so a real failure is diagnosable.
        console.warn('Image share failed, falling back to text:', e);
        if (!cancelled) await Share.share({ message: shareTextFor(entry) }).catch(() => {});
      } finally {
        if (!cancelled) setSharing(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sharing]);

  if (!fontsLoaded) return <View style={[styles.root, { backgroundColor: listPalette.screen }]} />;

  return (
    <View style={[styles.root, { backgroundColor: listPalette.screen }]}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={() => router.back()}
            hitSlop={8}
            style={styles.backBtn}>
            <ActionIcon kind="back" color={listPalette.ink} size={22} />
            <Text style={[styles.backText, { color: listPalette.ink, fontFamily: family('semibold', false) }]}>
              Back
            </Text>
          </Pressable>
          <Text style={[styles.headerTitle, { color: listPalette.ink, fontFamily: family('black', false) }]}>
            Past specimens
          </Text>
        </View>

        {history === null ? null : history.length === 0 ? (
          <View style={styles.empty}>
            <ActionIcon kind="gallery" color={listPalette.dim} size={40} />
            <Text style={[styles.emptyText, { color: listPalette.dim, fontFamily: family('body', false) }]}>
              Nothing pressed yet. Finish a run to start the collection.
            </Text>
          </View>
        ) : (
          <Animated.ScrollView contentContainerStyle={styles.list}>
            {history.map((entry) => (
              <SpecimenCard key={entry.mark} entry={entry} palette={paletteForEntry(entry)} onShare={onShare} onDelete={onDelete} />
            ))}
            <Pressable accessibilityRole="button" onPress={onDeleteAll} style={styles.deleteAll}>
              <ActionIcon kind="trash" color="#fff" size={18} />
              <Text style={[styles.deleteAllText, { fontFamily: family('bold', false) }]}>Delete all specimens</Text>
            </Pressable>
          </Animated.ScrollView>
        )}
      </SafeAreaView>

      {/* Exists only long enough to render and be captured for the share
       *  sheet. Mounted on-screen but effectively invisible: parked far
       *  off-screen it never got laid out, and the capture came back empty. */}
      {sharing ? (
        <View style={styles.hidden} pointerEvents="none" collapsable={false}>
          <SpecimenCardArt entry={sharing} palette={paletteForEntry(sharing)} svgRef={captureRef} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 12,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 8, minHeight: 44 },
  backText: { fontSize: 16.5 },
  headerTitle: { fontSize: 20, letterSpacing: -0.4 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 40 },
  emptyText: { fontSize: 15, lineHeight: 22, textAlign: 'center' },
  list: { paddingHorizontal: 16, paddingBottom: 24, gap: 12 },
  card: { borderWidth: 1.5, padding: 16 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  mark: { fontSize: 12 },
  date: { fontSize: 12 },
  title: { fontSize: 22, letterSpacing: -0.4 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 12 },
  // The picture is drawn in the plant's own 300x380 box, so the frame keeps
  // that shape - anything else would letterbox the stage colours.
  picture: { width: 92, aspectRatio: VIEW_W / VIEW_H, borderWidth: 1.5, overflow: 'hidden' },
  identityText: { flex: 1 },
  latin: { fontSize: 15, marginTop: 2 },
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, borderWidth: 1.5, paddingVertical: 8, alignItems: 'center' },
  statValue: { fontSize: 18 },
  statLabel: { fontSize: 10.5, marginTop: 2 },
  // Destructive actions are red on purpose: the only thing on this screen
  // that permanently removes something, so it shouldn't look like Share.
  // A quiet outline per card, a solid fill for the delete-everything one.
  deleteBtn: { flexDirection: 'row', gap: 6, justifyContent: 'center', borderColor: DELETE_RED, backgroundColor: 'rgba(214,69,69,0.08)' },
  deleteAll: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    paddingVertical: 15,
    backgroundColor: DELETE_RED,
  },
  deleteAllText: { fontSize: 15, color: '#fff' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  actionBtn: { flex: 1, borderWidth: 1.5, borderRadius: 999, paddingVertical: 10, alignItems: 'center' },
  actionText: { fontSize: 13.5 },
  hidden: { position: 'absolute', top: 0, left: 0, width: 720, height: 1100, opacity: 0.01 },
});
