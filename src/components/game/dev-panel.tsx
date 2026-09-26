import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import type { CameraDebugInfo, CameraLightStatus } from '@/components/game/camera-light-sensor';
import type { LightSensorStatus } from '@/game/use-ambient-light';
import { FONTS } from '@/game/fonts';
import type { EndingKind } from '@/game/types';

type Props = {
  visible: boolean;
  onJump: (level: number) => void;
  onForce: (ending: EndingKind) => void;
  onReset: () => void;
  onClose: () => void;
  lightSensorStatus: LightSensorStatus;
  cameraStatus: CameraLightStatus;
  cameraDebug: CameraDebugInfo | null;
};

function DevButton({ label, hot, onPress }: { label: string; hot?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.btn, hot && styles.btnHot]}>
      <Text style={styles.btnText}>{label}</Text>
    </Pressable>
  );
}

/** The one line that actually matters while debugging the covered-lens
 *  detection: what it's reading, right now, on the real device. */
function CameraDebugLine({ status, debug }: { status: CameraLightStatus; debug: CameraDebugInfo | null }) {
  if (status !== 'active') {
    return <Text style={styles.debugText}>camera: {status}</Text>;
  }
  if (!debug) {
    return <Text style={styles.debugText}>camera: active, waiting for first sample…</Text>;
  }
  if (debug.kind === 'error') {
    return <Text style={[styles.debugText, styles.debugError]}>camera error: {debug.message}</Text>;
  }
  return (
    <Text style={styles.debugText}>
      luma {debug.luma.toFixed(0)} · base {debug.baseline?.toFixed(0) ?? '—'} · contrast{' '}
      {debug.lumaStdDev.toFixed(0)} · red {debug.redRatio.toFixed(2)} ·{' '}
      {debug.covered ? `covered (streak ${debug.streak})` : 'not covered'}
    </Text>
  );
}

/**
 * Demo recovery controls, reachable only by long-pressing the specimen number.
 * Not a player-facing feature: it exists so a live demo can jump straight to a
 * level or an ending instead of tapping eighteen times. Also carries a small
 * diagnostics line for the camera-brightness fallback - the only way to see
 * its real numbers on a device, since nothing else in the UI shows them.
 */
export function DevPanel({
  visible,
  onJump,
  onForce,
  onReset,
  onClose,
  lightSensorStatus,
  cameraStatus,
  cameraDebug,
}: Props) {
  if (!visible) return null;
  return (
    <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(150)} style={styles.panel}>
      <Text style={styles.heading}>Demo controls</Text>

      <View style={styles.row}>
        {[1, 2, 3, 4].map((n) => (
          <DevButton key={n} label={`Level ${n}`} onPress={() => onJump(n)} />
        ))}
      </View>

      <View style={styles.row}>
        <DevButton label="Good ending" onPress={() => onForce('good')} />
        <DevButton label="Neutral ending" onPress={() => onForce('neutral')} />
        <DevButton label="Carnivore" onPress={() => onForce('carnivore')} />
        <DevButton label="Cactus" onPress={() => onForce('cactus')} />
        <DevButton label="Bad ending" hot onPress={() => onForce('bad')} />
        <DevButton label="It fell" hot onPress={() => onForce('fell')} />
      </View>

      <View style={styles.row}>
        <DevButton label="Reset" onPress={onReset} />
        <DevButton label="Close" onPress={onClose} />
      </View>

      <View style={styles.debugBlock}>
        <Text style={styles.debugText}>light sensor: {lightSensorStatus}</Text>
        <CameraDebugLine status={cameraStatus} debug={cameraDebug} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    left: 14,
    right: 14,
    top: 52,
    zIndex: 60,
    backgroundColor: '#0F1611',
    borderRadius: 18,
    padding: 14,
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 16,
  },
  heading: { color: '#E4ECE6', fontSize: 13, fontFamily: FONTS.bold },
  row: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  btn: {
    borderWidth: 1,
    borderColor: '#3A4A3F',
    backgroundColor: '#18221B',
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 11,
  },
  btnHot: { backgroundColor: '#E0245E', borderColor: '#E0245E' },
  btnText: { color: '#E4ECE6', fontSize: 13, fontFamily: FONTS.medium },
  debugBlock: { borderTopWidth: 1, borderTopColor: '#3A4A3F', paddingTop: 8, marginTop: 2, gap: 3 },
  debugText: { color: '#9BB0A2', fontSize: 11.5, fontFamily: FONTS.medium },
  debugError: { color: '#FF8A8A' },
});
