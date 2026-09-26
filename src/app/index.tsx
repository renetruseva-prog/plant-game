import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CameraLightSensor, type CameraDebugInfo, type CameraLightStatus } from '@/components/game/camera-light-sensor';
import { DevPanel } from '@/components/game/dev-panel';
import {
  FakeNotifications,
  FakePermissionDialog,
  GlitchOverlay,
  type FakeNotif,
} from '@/components/game/evil-layer';
import { EvilPhotoBooth } from '@/components/game/evil-photo';
import { FakeStatusBar } from '@/components/game/fake-status-bar';
import { EndingSheet, IntroOverlay } from '@/components/game/overlays';
import { Progress } from '@/components/game/progress';
import { SpecimenTag } from '@/components/game/specimen-tag';
import { Stage } from '@/components/game/stage';
import { TutorialOverlay } from '@/components/game/tutorial-overlay';
import { FingerAura } from '@/components/plant/finger-aura';
import { Particles, PulseRing, type Burst, type ParticleKind } from '@/components/plant/particles';
import { Plant, SleepZs } from '@/components/plant/plant';
import { TouchLayer } from '@/components/plant/touch-layer';
import { tendencyOf } from '@/game/config';
import { ENDINGS, EVIL_SCRIPT, LEVELS, LINES, WHISPER_START, latinFor } from '@/game/copy';
import { family, useGameFonts } from '@/game/fonts';
import { hapticAlarm, hapticEnding, hapticFor, hapticLevelUp } from '@/game/haptics';
import { cancelHaunting, hauntWithNotifications } from '@/game/notifications';
import { appendHistory, clearState, freshState, loadState, reducer, saveState } from '@/game/state';
import { paletteFor } from '@/game/theme';
import type { EndingKind, InteractionKind, Mood } from '@/game/types';
import { envFromClock, useAmbientLight } from '@/game/use-ambient-light';
import { useEyeTracking } from '@/game/use-eye-tracking';
import { useFingerAura } from '@/game/use-finger-aura';
import { useMotion } from '@/game/use-motion';
import { useTypewriter } from '@/game/use-typewriter';
import { useUpsideDown } from '@/game/use-upside-down';

const PARTICLE_FOR: Partial<Record<InteractionKind, ParticleKind>> = {
  water: 'water',
  sun: 'sun',
  daylight: 'sun',
  stroke: 'heart',
  nudge: 'heart',
  walk: 'heart',
  shake: 'thorn',
  jolt: 'thorn',
};

const pick = (lines: string[]) => lines[Math.floor(Math.random() * lines.length)];
const newMark = () => `Specimen No. ${String(Math.floor(Math.random() * 9000) + 1000)}`;

export default function GameScreen() {
  const fontsLoaded = useGameFonts();
  const router = useRouter();

  const [state, dispatch] = useReducer(reducer, undefined, freshState);
  const [hydrated, setHydrated] = useState(false);

  const [mood, setMood] = useState<Mood>('idle');
  const [whisper, setWhisper] = useState(WHISPER_START);
  const [burst, setBurst] = useState<Burst | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const [pinchKey, setPinchKey] = useState(0);
  const [devOpen, setDevOpen] = useState(false);
  /** Only for the hidden dev panel - see `CameraLightSensor`'s `onDebug`. */
  const [cameraStatus, setCameraStatus] = useState<CameraLightStatus>('pending');
  const [cameraDebug, setCameraDebug] = useState<CameraDebugInfo | null>(null);
  /** Live pupil offset while a finger drags on the stage but off the plant. */
  const { eyeX, eyeY, trackEyes, releaseEyes } = useEyeTracking();
  /** The glow that follows the finger anywhere on the stage. */
  const { auraX, auraY, auraOpacity, auraKind, showAura, moveAura, startAuraHold, hideAura } =
    useFingerAura();
  const [mark, setMark] = useState(newMark);
  /** Shown between the title card and actually starting - see `beginRun`. */
  const [showTutorial, setShowTutorial] = useState(false);
  /** Reopens the gesture tutorial mid-run, without touching game state. */
  const [helpOpen, setHelpOpen] = useState(false);

  // Evil takeover
  const [notifs, setNotifs] = useState<FakeNotif[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  /** The bad ending's camera photo, after the player taps Allow. */
  const [photoOpen, setPhotoOpen] = useState(false);
  const [glitching, setGlitching] = useState(false);
  const [sheetUp, setSheetUp] = useState(false);

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const moodTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const burstId = useRef(0);
  const notifId = useRef(0);
  const dialogResolved = useRef(false);

  const evil = state.ending === 'bad';
  const finished = state.ending !== null;
  const active = state.started && !finished;

  const after = useCallback((ms: number, fn: () => void) => {
    timers.current.push(setTimeout(fn, ms));
  }, []);

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    if (moodTimer.current) clearTimeout(moodTimer.current);
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  /* ---------------- persistence ---------------- */

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const saved = await loadState();
      if (cancelled) return;
      if (saved) {
        dispatch({ type: 'hydrate', state: saved });
        // Returning to a finished run: show the verdict, skip the theatrics.
        if (saved.ending) {
          setSheetUp(true);
          setWhisper('');
        }
      } else {
        // No sensor reading yet: seed the room from the time of day.
        dispatch({ type: 'setEnv', env: envFromClock() });
      }
      setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (hydrated) saveState(state);
  }, [state, hydrated]);

  // Records the run in the gallery the moment it's actually over.
  // `appendHistory` de-dupes by mark, so this firing again on a reload of an
  // already-finished run is harmless.
  useEffect(() => {
    if (!hydrated || !state.ending) return;
    appendHistory({
      mark,
      ending: state.ending,
      latin: ENDINGS[state.ending].latin,
      scores: state.scores,
      date: Date.now(),
    });
  }, [hydrated, state.ending, state.scores, mark]);

  /* ---------------- derived ---------------- */

  const tendency = useMemo(
    () => (state.level >= 4 ? tendencyOf(state.scores) : null),
    [state.level, state.scores]
  );
  const form: EndingKind | null = state.ending ?? (state.level >= 4 ? tendency : null);
  const palette = useMemo(
    () => paletteFor(state.level, state.env, tendency, state.ending, state.legacy),
    [state.level, state.env, tendency, state.ending, state.legacy]
  );

  const totalScore =
    state.scores.care + state.scores.light + state.scores.attention + state.scores.roughness;
  const roughRatio = totalScore === 0 ? 0 : state.scores.roughness / totalScore;

  const displayMood: Mood = finished
    ? 'idle'
    : state.env === 'dark' && mood !== 'hurt'
      ? 'sleep'
      : mood;

  /**
   * Bumped by growth alone, so the pop and the ring are derived from the game
   * state rather than from extra counters kept in sync by hand.
   */
  const growthKey = state.level * 2 + (state.ending ? 1 : 0);

  /* ---------------- the ending ---------------- */

  /** The end of the bad ending's theatrics: back to normal, then the verdict. */
  const concludeEnding = useCallback(() => {
    setPhotoOpen(false);
    setGlitching(false);
    setWhisper('it was only a game.');
    after(900, () => setSheetUp(true));
  }, [after]);

  /** `allowed` is only true when the player actually tapped Allow - that's
   *  what opens the camera. The safety-net timer closes it with `false`, so
   *  a player who never engaged with the dialog is never photographed. */
  const closeDialog = useCallback(
    (allowed: boolean) => {
      setDialogOpen(false);
      if (dialogResolved.current) return;
      dialogResolved.current = true;
      if (allowed) setPhotoOpen(true);
      else concludeEnding();
    },
    [concludeEnding]
  );

  /** The scripted reveal. Driven by timers, so it never runs during render. */
  const runFinale = useCallback(
    (kind: EndingKind) => {
      hapticEnding(kind);

      if (kind === 'fell') {
        // Instant and sad, not the evil ending's elaborate takeover - a
        // single beat, then straight to the verdict.
        setWhisper('It fell.');
        after(1400, () => setSheetUp(true));
        return;
      }

      if (kind !== 'bad') {
        const reveal: Record<Exclude<EndingKind, 'bad' | 'fell'>, string> = {
          good: 'It opens up, petal by petal.',
          neutral: 'It flattens out into a quiet tuft.',
          carnivore: 'Its leaves fold shut around something.',
          cactus: 'It draws in, thickens, toughens up.',
        };
        setWhisper(reveal[kind]);
        if (kind === 'good') {
          burstId.current += 1;
          setBurst({ id: burstId.current, kind: 'petal', count: 14 });
        }
        after(2200, () => setSheetUp(true));
        return;
      }

      dialogResolved.current = false;
      setGlitching(true);
      hauntWithNotifications();

      for (const step of EVIL_SCRIPT) {
        after(step.at, () => {
          if (step.kind === 'say') setWhisper(step.text);
          if (step.kind === 'notif') {
            notifId.current += 1;
            const item: FakeNotif = {
              id: notifId.current,
              title: step.title,
              body: step.body,
              color: step.color,
              initial: step.initial,
            };
            setNotifs((prev) => [...prev, item].slice(-3));
            after(4200, () => setNotifs((prev) => prev.filter((n) => n.id !== item.id)));
          }
          if (step.kind === 'dialog') {
            setDialogOpen(true);
            hapticAlarm();
          }
        });
      }
      // Safety net: if nobody taps Allow, the run still resolves itself.
      after(9500, () => closeDialog(false));
    },
    [after, closeDialog]
  );

  /* ---------------- interaction ---------------- */

  const interact = useCallback(
    (kind: InteractionKind) => {
      if (!state.started || state.ending) return;

      // Run the reducer ahead of dispatching so this handler - the actual
      // source of the event - can react to a level-up or the ending directly,
      // instead of watching for them in an effect.
      const next = reducer(state, { type: 'interact', kind });
      const rough = kind === 'shake' || kind === 'jolt';
      const asleep = state.env === 'dark' && kind !== 'sun' && kind !== 'daylight' && !rough;

      hapticFor(kind);
      if (rough) setShakeKey((k) => k + 1);

      const particle = PARTICLE_FOR[kind];
      if (particle) {
        burstId.current += 1;
        setBurst({
          id: burstId.current,
          kind: particle,
          count: kind === 'water' ? 7 : rough ? 4 : 5,
        });
      }

      setMood(rough ? 'hurt' : asleep ? 'sleep' : kind === 'walk' ? 'sway' : 'happy');
      if (moodTimer.current) clearTimeout(moodTimer.current);
      moodTimer.current = setTimeout(() => setMood('idle'), 1600);

      dispatch({ type: 'interact', kind });

      if (next.ending) {
        runFinale(next.ending);
      } else if (next.level > state.level) {
        hapticLevelUp();
        const l = LEVELS[next.level - 1];
        setWhisper(`${l.name}. ${l.goal}`);
      } else {
        setWhisper(asleep ? 'It murmurs in its sleep.' : pick(LINES[kind]));
      }
    },
    [state, runFinale]
  );

  /** A pinch on the plant scores as a stroke and additionally bumps the
   *  cheek-squeeze animation, which a plain stroke doesn't trigger. */
  const onPlantPinch = useCallback(() => {
    setPinchKey((k) => k + 1);
    interact('stroke');
  }, [interact]);

  /** Turning the phone upside down: instant and permanent, whatever level
   *  the plant was at. Bypasses `interact` entirely - this isn't a scored
   *  interaction, it's a dedicated way the run can end. */
  const onFall = useCallback(() => {
    if (!state.started || state.ending) return;
    dispatch({ type: 'fall' });
    runFinale('fell');
  }, [state.started, state.ending, runFinale]);

  const { fallAngle } = useUpsideDown(active, onFall);

  /* ---------------- device interactions ---------------- */

  const tilt = useMotion(active, {
    onWalk: () => interact('walk'),
    onNudge: () => interact('nudge'),
    onJolt: () => interact('jolt'),
  });

  const onLightEnv = useCallback(
    (env: 'day' | 'dark') => {
      if (env === state.env) return;
      interact(env === 'dark' ? 'nightfall' : 'daylight');
    },
    [state.env, interact]
  );

  const { status: lightSensorStatus } = useAmbientLight(active, onLightEnv);

  // Only fall back to the camera once we actually know there's no LightSensor
  // - 'checking' means the async probe hasn't resolved yet, and mounting the
  // camera (and prompting for its permission) during that window would ask
  // Android users for a permission the real sensor never needed.
  const cameraEnabled = active && lightSensorStatus === 'unavailable';

  const openGallery = useCallback(() => router.push('/gallery'), [router]);

  /** Actually begins gameplay, dismissing the title card and tutorial alike. */
  const beginRun = useCallback(() => {
    setShowTutorial(false);
    dispatch({ type: 'start' });
    setWhisper(WHISPER_START);
  }, []);

  /* ---------------- demo controls ---------------- */

  const hardReset = useCallback(
    (next?: { jump?: number; force?: EndingKind }) => {
      clearTimers();
      cancelHaunting();
      setNotifs([]);
      setDialogOpen(false);
      setPhotoOpen(false);
      setGlitching(false);
      setSheetUp(false);
      setBurst(null);
      setMood('idle');
      setDevOpen(false);
      setShowTutorial(false);
      setHelpOpen(false);
      dialogResolved.current = false;
      setMark(newMark());

      if (next?.jump) {
        dispatch({ type: 'devJump', level: next.jump });
        const l = LEVELS[next.jump - 1];
        setWhisper(`${l.name}. ${l.goal}`);
      } else if (next?.force) {
        dispatch({ type: 'devForce', ending: next.force });
        runFinale(next.force);
      } else {
        clearState();
        dispatch({ type: 'reset' });
        setWhisper(WHISPER_START);
      }
    },
    [clearTimers, runFinale]
  );

  /** Player-facing restart, reachable mid-run - unlike the hidden demo
   *  panel, this asks first: it throws away real progress. */
  const confirmRestart = useCallback(() => {
    Alert.alert('Restart the game?', 'This specimen and its progress will be lost.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Restart', style: 'destructive', onPress: () => hardReset() },
    ]);
  }, [hardReset]);

  /* ---------------- render ---------------- */

  const typedWhisper = useTypewriter(whisper, evil && !sheetUp);
  const latin = latinFor(state.level, form, state.ending);
  const stageName = state.ending ? LEVELS[4].name : LEVELS[state.level - 1].name;
  const goal = state.ending ? ENDINGS[state.ending].goal : LEVELS[state.level - 1].goal;

  if (!fontsLoaded || !hydrated) {
    return <View style={[styles.root, { backgroundColor: palette.screen }]} />;
  }

  return (
    <View style={[styles.root, { backgroundColor: palette.screen }]}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <FakeStatusBar palette={palette} evil={evil} />

        <SpecimenTag
          palette={palette}
          evil={evil}
          mark={mark}
          level={state.level}
          latin={latin}
          stageName={stageName}
          goal={goal}
          generation={state.generation}
          onSecretHold={() => setDevOpen((v) => !v)}
        />

        <Stage
          palette={palette}
          evil={evil}
          env={state.env}
          shakeKey={shakeKey}
          onRestart={confirmRestart}
          restartDisabled={!active}
          onOpenGallery={openGallery}
          onOpenHelp={() => setHelpOpen(true)}>
          <Plant
            level={state.level}
            mood={displayMood}
            form={form}
            ending={state.ending}
            roughRatio={roughRatio}
            popKey={growthKey}
            pinchKey={pinchKey}
            tilt={tilt}
            eyeX={eyeX}
            eyeY={eyeY}
            fallAngle={fallAngle}
          />
          <SleepZs visible={displayMood === 'sleep'} />
          <Particles burst={burst} />
          <PulseRing pulseKey={growthKey} color={evil ? '#FF3B6B' : '#ffffff'} />
          <TouchLayer
            level={state.level}
            form={form}
            ending={state.ending}
            disabled={!active}
            onStroke={() => interact('stroke')}
            onShake={() => interact('shake')}
            onPinch={onPlantPinch}
            onWater={() => interact('water')}
            onSun={() => interact('sun')}
            onTrackEyes={trackEyes}
            onReleaseEyes={releaseEyes}
            onAuraShow={showAura}
            onAuraMove={moveAura}
            onAuraHold={startAuraHold}
            onAuraHide={hideAura}
          />
          <FingerAura auraX={auraX} auraY={auraY} auraOpacity={auraOpacity} auraKind={auraKind} />
        </Stage>

        <Animated.Text
          layout={LinearTransition.duration(300)}
          accessibilityLiveRegion="polite"
          numberOfLines={2}
          style={[styles.whisper, { color: palette.ink, fontFamily: family('medium', evil) }]}>
          {evil && !sheetUp ? `${typedWhisper}▌` : whisper}
        </Animated.Text>

        <Progress palette={palette} evil={evil} level={state.level} count={state.count} />
      </SafeAreaView>

      <CameraLightSensor
        enabled={cameraEnabled}
        onEnvChange={onLightEnv}
        onStatus={(status) => {
          console.log('[camera] status:', status);
          setCameraStatus(status);
        }}
        onBrightness={() => {}}
        onSleep={() => interact('sleep')}
        onDebug={(info) => {
          console.log('[camera]', info);
          setCameraDebug(info);
        }}
      />

      <GlitchOverlay active={glitching} />
      <FakeNotifications
        items={notifs}
        onDismiss={(id) => setNotifs((prev) => prev.filter((n) => n.id !== id))}
      />
      <FakePermissionDialog visible={dialogOpen} onClose={() => closeDialog(true)} />
      {photoOpen ? <EvilPhotoBooth onDone={concludeEnding} /> : null}

      <EndingSheet
        palette={palette}
        evil={evil}
        kind={state.ending}
        visible={sheetUp}
        scores={state.scores}
        onRestart={() => hardReset()}
        onOpenGallery={openGallery}
      />

      <IntroOverlay
        palette={palette}
        visible={!state.started && !showTutorial}
        legacy={state.legacy}
        onStart={() => setShowTutorial(true)}
      />

      <TutorialOverlay
        palette={palette}
        visible={(!state.started && showTutorial) || helpOpen}
        mode={helpOpen ? 'help' : 'onboarding'}
        onFinish={helpOpen ? () => setHelpOpen(false) : beginRun}
      />

      <DevPanel
        visible={devOpen}
        onJump={(level) => hardReset({ jump: level })}
        onForce={(ending) => hardReset({ force: ending })}
        onReset={() => hardReset()}
        onClose={() => setDevOpen(false)}
        lightSensorStatus={lightSensorStatus}
        cameraStatus={cameraStatus}
        cameraDebug={cameraDebug}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  whisper: {
    marginTop: 12,
    marginHorizontal: 24,
    minHeight: 42,
    fontSize: 15.5,
    lineHeight: 21,
    textAlign: 'center',
  },
});
