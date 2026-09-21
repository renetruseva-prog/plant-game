import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Actions, type TapKind } from '@/components/game/actions';
import { DevPanel } from '@/components/game/dev-panel';
import {
  FakeNotifications,
  FakePermissionDialog,
  GlitchOverlay,
  type FakeNotif,
} from '@/components/game/evil-layer';
import { FakeStatusBar } from '@/components/game/fake-status-bar';
import { EndingSheet, IntroOverlay } from '@/components/game/overlays';
import { Progress } from '@/components/game/progress';
import { SpecimenTag } from '@/components/game/specimen-tag';
import { Stage } from '@/components/game/stage';
import { Particles, PulseRing, type Burst, type ParticleKind } from '@/components/plant/particles';
import { Plant, SleepZs } from '@/components/plant/plant';
import { tendencyOf } from '@/game/config';
import { ENDINGS, EVIL_SCRIPT, LEVELS, LINES, WHISPER_START, latinFor } from '@/game/copy';
import { family, useGameFonts } from '@/game/fonts';
import { hapticAlarm, hapticEnding, hapticFor, hapticLevelUp } from '@/game/haptics';
import { cancelHaunting, hauntWithNotifications } from '@/game/notifications';
import { clearState, freshState, loadState, reducer, saveState } from '@/game/state';
import { paletteFor } from '@/game/theme';
import type { EndingKind, InteractionKind, Mood } from '@/game/types';
import { envFromClock, useAmbientLight } from '@/game/use-ambient-light';
import { useMotion } from '@/game/use-motion';
import { useOutside } from '@/game/use-outside';
import { useTypewriter } from '@/game/use-typewriter';

const PARTICLE_FOR: Partial<Record<InteractionKind, ParticleKind>> = {
  water: 'water',
  sun: 'sun',
  daylight: 'sun',
  stroke: 'heart',
  nudge: 'heart',
  walk: 'heart',
  outside: 'sun',
  shake: 'thorn',
  jolt: 'thorn',
};

const pick = (lines: string[]) => lines[Math.floor(Math.random() * lines.length)];
const newMark = () => `Specimen No. ${String(Math.floor(Math.random() * 9000) + 1000)}`;

export default function GameScreen() {
  const fontsLoaded = useGameFonts();

  const [state, dispatch] = useReducer(reducer, undefined, freshState);
  const [hydrated, setHydrated] = useState(false);

  const [mood, setMood] = useState<Mood>('idle');
  const [whisper, setWhisper] = useState(WHISPER_START);
  const [burst, setBurst] = useState<Burst | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const [devOpen, setDevOpen] = useState(false);
  const [mark, setMark] = useState(newMark);

  // Evil takeover
  const [notifs, setNotifs] = useState<FakeNotif[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
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

  /* ---------------- derived ---------------- */

  const tendency = useMemo(
    () => (state.level >= 4 ? tendencyOf(state.scores) : null),
    [state.level, state.scores]
  );
  const form: EndingKind | null = state.ending ?? (state.level >= 4 ? tendency : null);
  const palette = useMemo(
    () => paletteFor(state.level, state.env, tendency, state.ending),
    [state.level, state.env, tendency, state.ending]
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

  const closeDialog = useCallback(() => {
    setDialogOpen(false);
    if (dialogResolved.current) return;
    dialogResolved.current = true;
    setGlitching(false);
    setWhisper('it was only a game.');
    after(900, () => setSheetUp(true));
  }, [after]);

  /** The scripted reveal. Driven by timers, so it never runs during render. */
  const runFinale = useCallback(
    (kind: EndingKind) => {
      hapticEnding(kind);

      if (kind !== 'bad') {
        setWhisper(
          kind === 'good' ? 'It opens up, petal by petal.' : 'It flattens out into a quiet tuft.'
        );
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
      after(9500, closeDialog);
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

  /* ---------------- device interactions ---------------- */

  const tilt = useMotion(active, {
    onWalk: () => interact('walk'),
    onNudge: () => interact('nudge'),
    onJolt: () => interact('jolt'),
  });

  const { hasSensor } = useAmbientLight(active, (env) => {
    if (env === state.env) return;
    interact(env === 'dark' ? 'nightfall' : 'daylight');
  });

  const { check: checkOutside, busy: outsideBusy } = useOutside();

  const onOutside = useCallback(async () => {
    const result = await checkOutside();
    // The whisper is set first, then the interaction overwrites it only when
    // it has something better to say than the location read-out.
    switch (result.kind) {
      case 'moved':
        interact('outside');
        setWhisper(`${Math.round(result.metres)} m from home. It has never felt this much sky.`);
        break;
      case 'anchored':
        interact('daylight');
        setWhisper('Noted where you started. Carry it outside and tap again.');
        break;
      case 'too-close':
        interact('daylight');
        setWhisper('Still the same room. It can tell.');
        break;
      case 'checkin':
        interact('outside');
        setWhisper('No location. Taking your word for it: outside.');
        break;
    }
  }, [checkOutside, interact]);

  const toggleEnv = useCallback(() => {
    if (!active) return;
    interact(state.env === 'day' ? 'nightfall' : 'daylight');
  }, [active, state.env, interact]);

  /* ---------------- demo controls ---------------- */

  const hardReset = useCallback(
    (next?: { jump?: number; force?: EndingKind }) => {
      clearTimers();
      cancelHaunting();
      setNotifs([]);
      setDialogOpen(false);
      setGlitching(false);
      setSheetUp(false);
      setBurst(null);
      setMood('idle');
      setDevOpen(false);
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
          onSecretHold={() => setDevOpen((v) => !v)}
        />

        <Stage
          palette={palette}
          evil={evil}
          env={state.env}
          sensorDriven={hasSensor}
          onToggleEnv={toggleEnv}
          shakeKey={shakeKey}>
          <Plant
            level={state.level}
            mood={displayMood}
            form={form}
            ending={state.ending}
            roughRatio={roughRatio}
            popKey={growthKey}
            tilt={tilt}
          />
          <SleepZs visible={displayMood === 'sleep'} />
          <Particles burst={burst} />
          <PulseRing pulseKey={growthKey} color={evil ? '#FF3B6B' : '#ffffff'} />
        </Stage>

        <Animated.Text
          layout={LinearTransition.duration(300)}
          accessibilityLiveRegion="polite"
          numberOfLines={2}
          style={[styles.whisper, { color: palette.ink, fontFamily: family('medium', evil) }]}>
          {evil && !sheetUp ? `${typedWhisper}▌` : whisper}
        </Animated.Text>

        <Progress palette={palette} evil={evil} level={state.level} count={state.count} />

        <Actions
          palette={palette}
          evil={evil}
          disabled={finished}
          onTap={(kind: TapKind) => interact(kind)}
          onOutside={onOutside}
          outsideBusy={outsideBusy}
          outsideDone={state.wentOutside}
        />
      </SafeAreaView>

      <GlitchOverlay active={glitching} />
      <FakeNotifications
        items={notifs}
        onDismiss={(id) => setNotifs((prev) => prev.filter((n) => n.id !== id))}
      />
      <FakePermissionDialog visible={dialogOpen} onClose={closeDialog} />

      <EndingSheet
        palette={palette}
        evil={evil}
        kind={state.ending}
        visible={sheetUp}
        scores={state.scores}
        onRestart={() => hardReset()}
      />

      <IntroOverlay
        palette={palette}
        visible={!state.started}
        onStart={() => {
          dispatch({ type: 'start' });
          setWhisper(WHISPER_START);
        }}
      />

      <DevPanel
        visible={devOpen}
        onJump={(level) => hardReset({ jump: level })}
        onForce={(ending) => hardReset({ force: ending })}
        onReset={() => hardReset()}
        onClose={() => setDevOpen(false)}
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
