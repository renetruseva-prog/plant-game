import { create } from 'zustand';

import type { CameraDebugInfo, CameraLightStatus } from '@/components/game/camera-light-sensor';
import type { FakeNotif } from '@/components/game/evil-layer';
import type { Burst, ParticleKind } from '@/components/plant/particles';
import { WHISPER_START } from '@/game/copy';
import type { Mood } from '@/game/types';

/** How long a reaction (happy, hurt...) shows before the plant settles. */
const MOOD_MS = 1600;

let moodTimer: ReturnType<typeof setTimeout> | null = null;
let burstSeq = 0;
let notifSeq = 0;

type Transient = {
  mood: Mood;
  whisper: string;
  burst: Burst | null;
  /** Bumped to shake the whole stage on a rough interaction. */
  shakeKey: number;
  /** Bumped to fire the cheek-squeeze on a pinch. */
  pinchKey: number;

  /** Which screens and overlays are up. */
  devOpen: boolean;
  /** The tutorial between the title card and the run. */
  showTutorial: boolean;
  /** The tutorial reopened mid-run. */
  helpOpen: boolean;
  /** The ending's verdict sheet. */
  sheetUp: boolean;

  /** The bad ending's takeover. */
  notifs: FakeNotif[];
  dialogOpen: boolean;
  photoOpen: boolean;
  glitching: boolean;
};

type UiStore = Transient & {
  /** Live readouts of the camera sensor, for the hidden dev panel. */
  cameraStatus: CameraLightStatus;
  cameraDebug: CameraDebugInfo | null;

  setWhisper: (text: string) => void;
  /** Shows a mood, then lets the plant settle back to idle. */
  flashMood: (mood: Mood) => void;
  showBurst: (kind: ParticleKind, count: number) => void;
  bumpShake: () => void;
  bumpPinch: () => void;
  toggleDev: () => void;
  setShowTutorial: (open: boolean) => void;
  setHelpOpen: (open: boolean) => void;
  setSheetUp: (up: boolean) => void;
  pushNotif: (notif: Omit<FakeNotif, 'id'>) => number;
  dropNotif: (id: number) => void;
  setDialogOpen: (open: boolean) => void;
  setPhotoOpen: (open: boolean) => void;
  setGlitching: (on: boolean) => void;
  setCameraStatus: (status: CameraLightStatus) => void;
  setCameraDebug: (info: CameraDebugInfo) => void;
  /** Back to a clean slate for a new specimen. */
  resetTransient: () => void;
  /** Returning to an already-finished run: straight to the verdict, no
   *  theatrics. */
  showVerdictOnly: () => void;
};

const initialTransient = (): Transient => ({
  mood: 'idle',
  whisper: WHISPER_START,
  burst: null,
  shakeKey: 0,
  pinchKey: 0,
  devOpen: false,
  showTutorial: false,
  helpOpen: false,
  sheetUp: false,
  notifs: [],
  dialogOpen: false,
  photoOpen: false,
  glitching: false,
});

/**
 * Everything the screen needs to remember that isn't the game itself and
 * isn't worth saving: which overlay is open, the plant's current reaction,
 * the caption. Keeping it here means the code that causes a change (a
 * gesture, a finale timer) sets it directly, instead of every screen
 * carrying its own copy of state and a chain of callbacks to change it.
 */
export const useUiStore = create<UiStore>()((set) => ({
  ...initialTransient(),
  cameraStatus: 'pending',
  cameraDebug: null,

  setWhisper: (whisper) => set({ whisper }),
  flashMood: (mood) => {
    set({ mood });
    if (moodTimer) clearTimeout(moodTimer);
    moodTimer = setTimeout(() => set({ mood: 'idle' }), MOOD_MS);
  },
  showBurst: (kind, count) => set({ burst: { id: ++burstSeq, kind, count } }),
  bumpShake: () => set((s) => ({ shakeKey: s.shakeKey + 1 })),
  bumpPinch: () => set((s) => ({ pinchKey: s.pinchKey + 1 })),
  toggleDev: () => set((s) => ({ devOpen: !s.devOpen })),
  setShowTutorial: (showTutorial) => set({ showTutorial }),
  setHelpOpen: (helpOpen) => set({ helpOpen }),
  setSheetUp: (sheetUp) => set({ sheetUp }),
  pushNotif: (notif) => {
    const id = ++notifSeq;
    set((s) => ({ notifs: [...s.notifs, { ...notif, id }].slice(-3) }));
    return id;
  },
  dropNotif: (id) => set((s) => ({ notifs: s.notifs.filter((n) => n.id !== id) })),
  setDialogOpen: (dialogOpen) => set({ dialogOpen }),
  setPhotoOpen: (photoOpen) => set({ photoOpen }),
  setGlitching: (glitching) => set({ glitching }),
  setCameraStatus: (cameraStatus) => set({ cameraStatus }),
  setCameraDebug: (cameraDebug) => set({ cameraDebug }),

  resetTransient: () => {
    if (moodTimer) clearTimeout(moodTimer);
    moodTimer = null;
    set(initialTransient());
  },
  showVerdictOnly: () => set({ sheetUp: true, whisper: '' }),
}));
