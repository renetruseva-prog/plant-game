import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useDerivedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { MONO } from '@/game/fonts';

export type FakeNotif = {
  id: number;
  title: string;
  body: string;
  color: string;
  initial: string;
};

/**
 * Fake system banners. Deliberately in-app rather than real notifications so
 * the takeover always lands on stage, whatever the permission state is.
 */
export function FakeNotifications({ items, onDismiss }: { items: FakeNotif[]; onDismiss: (id: number) => void }) {
  return (
    <View style={styles.notifs} pointerEvents="box-none">
      {items.map((n) => (
        <Animated.View key={n.id} entering={FadeIn.duration(260)} style={styles.notif}>
          <Pressable style={styles.notifInner} onPress={() => onDismiss(n.id)}>
            <View style={[styles.notifIcon, { backgroundColor: n.color }]}>
              <Text style={styles.notifInitial}>{n.initial}</Text>
            </View>
            <View style={styles.notifText}>
              <View style={styles.notifTop}>
                <Text style={styles.notifTitle} numberOfLines={1}>
                  {n.title}
                </Text>
                <Text style={styles.notifWhen}>now</Text>
              </View>
              <Text style={styles.notifBody} numberOfLines={2}>
                {n.body}
              </Text>
            </View>
          </Pressable>
        </Animated.View>
      ))}
    </View>
  );
}

/** A fake permission sheet where both buttons say Allow. */
export function FakePermissionDialog({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  if (!visible) return null;
  return (
    <View style={styles.dialogWrap}>
      <Animated.View entering={FadeIn.duration(220)} style={styles.dialog}>
        <Text style={styles.dialogTitle}>&ldquo;Specimen&rdquo; would like to access your Camera</Text>
        <Text style={styles.dialogBody}>Specimen wants to see you.</Text>
        <Pressable style={styles.dialogBtn} onPress={onClose}>
          <Text style={styles.dialogBtnText}>Allow</Text>
        </Pressable>
        <Pressable style={styles.dialogBtn} onPress={onClose}>
          <Text style={styles.dialogBtnText}>Allow</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

/** Scanlines plus a chromatic judder over the whole screen. */
export function GlitchOverlay({ active }: { active: boolean }) {
  const t = useDerivedValue(() =>
    active
      ? withRepeat(
          withSequence(
            withTiming(1, { duration: 90, easing: Easing.steps(2, true) }),
            withTiming(-1, { duration: 90, easing: Easing.steps(2, true) }),
            withTiming(0.4, { duration: 120, easing: Easing.steps(2, true) })
          ),
          -1,
          false
        )
      : withTiming(0, { duration: 200 })
  );

  const style = useAnimatedStyle(() => ({
    opacity: active ? 0.55 + Math.abs(t.value) * 0.35 : 0,
    transform: [{ translateX: t.value * 5 }],
  }));

  if (!active) return null;

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.scan, style]} pointerEvents="none">
      {/* Cheap scanlines: a stack of thin translucent bars. */}
      {Array.from({ length: 90 }, (_, i) => (
        <View key={i} style={styles.scanLine} />
      ))}
    </Animated.View>
  );
}

/** The plant typing at you, one character at a time. */
export function TypedLine({ text, color }: { text: string; color: string }) {
  return (
    <Text style={[styles.typed, { color, fontFamily: MONO }]} numberOfLines={2}>
      {text}
      <Text style={styles.caret}>▌</Text>
    </Text>
  );
}

const styles = StyleSheet.create({
  notifs: { position: 'absolute', left: 10, right: 10, top: 8, zIndex: 40, gap: 8 },
  notif: {
    backgroundColor: 'rgba(245,245,247,0.96)',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  notifInner: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 11 },
  notifIcon: { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  notifInitial: { color: '#fff', fontWeight: '800', fontSize: 15 },
  notifText: { flex: 1 },
  notifTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  notifTitle: { fontSize: 14, fontWeight: '700', color: '#17171A', flexShrink: 1 },
  notifWhen: { fontSize: 11, color: '#77777F', marginLeft: 8 },
  notifBody: { fontSize: 13, color: '#4A4A52' },

  dialogWrap: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 45,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialog: { width: 270, backgroundColor: 'rgba(245,245,247,0.97)', borderRadius: 18, overflow: 'hidden' },
  dialogTitle: {
    paddingTop: 18,
    paddingHorizontal: 16,
    paddingBottom: 4,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    color: '#17171A',
  },
  dialogBody: { paddingHorizontal: 16, paddingBottom: 16, fontSize: 13, textAlign: 'center', color: '#3A3A42' },
  dialogBtn: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#C9C9D0', paddingVertical: 12 },
  dialogBtnText: { textAlign: 'center', fontSize: 16, color: '#0A7AFF' },

  scan: { zIndex: 35, justifyContent: 'space-between' },
  scanLine: { height: 2, backgroundColor: 'rgba(255,60,120,0.10)' },

  typed: { fontSize: 15.5, lineHeight: 21, textAlign: 'center' },
  caret: { opacity: 0.8 },
});
