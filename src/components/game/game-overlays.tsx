import { useShallow } from 'zustand/react/shallow';

import { closeDialog, concludeEnding } from '@/game/finale';
import { beginRun, newSpecimen } from '@/game/session';
import type { Palette } from '@/game/theme';
import type { LightSensorStatus } from '@/game/use-ambient-light';
import { useGameStore } from '@/store/game-store';
import { useUiStore } from '@/store/ui-store';

import { DevPanel } from './dev-panel';
import { FakeNotifications, FakePermissionDialog, GlitchOverlay } from './evil-layer';
import { EvilPhotoBooth } from './evil-photo';
import { EndingSheet, IntroOverlay } from './overlays';
import { TutorialOverlay } from './tutorial-overlay';

type Props = {
  palette: Palette;
  evil: boolean;
  lightSensorStatus: LightSensorStatus;
  onOpenGallery: () => void;
};

/**
 * Everything drawn over the game: the bad ending's takeover, the verdict
 * sheet, the intro and tutorial, and the hidden dev panel. Which of them is
 * showing comes from the UI store, so nothing above has to pass it down.
 */
export function GameOverlays({ palette, evil, lightSensorStatus, onOpenGallery }: Props) {
  const game = useGameStore(
    useShallow((s) => ({ started: s.started, ending: s.ending, scores: s.scores, legacy: s.legacy }))
  );
  const ui = useUiStore(
    useShallow((s) => ({
      glitching: s.glitching,
      notifs: s.notifs,
      dialogOpen: s.dialogOpen,
      photoOpen: s.photoOpen,
      sheetUp: s.sheetUp,
      showTutorial: s.showTutorial,
      helpOpen: s.helpOpen,
      devOpen: s.devOpen,
      cameraStatus: s.cameraStatus,
      cameraDebug: s.cameraDebug,
    }))
  );
  const { dropNotif, setShowTutorial, setHelpOpen, toggleDev } = useUiStore.getState();

  return (
    <>
      <GlitchOverlay active={ui.glitching} />
      <FakeNotifications items={ui.notifs} onDismiss={dropNotif} />
      <FakePermissionDialog visible={ui.dialogOpen} onClose={() => closeDialog(true)} />
      {ui.photoOpen ? <EvilPhotoBooth onDone={concludeEnding} /> : null}

      <EndingSheet
        palette={palette}
        evil={evil}
        kind={game.ending}
        visible={ui.sheetUp}
        scores={game.scores}
        onRestart={() => newSpecimen()}
        onOpenGallery={onOpenGallery}
      />

      <IntroOverlay
        palette={palette}
        visible={!game.started && !ui.showTutorial}
        legacy={game.legacy}
        onStart={() => setShowTutorial(true)}
      />

      <TutorialOverlay
        palette={palette}
        visible={(!game.started && ui.showTutorial) || ui.helpOpen}
        mode={ui.helpOpen ? 'help' : 'onboarding'}
        onFinish={ui.helpOpen ? () => setHelpOpen(false) : beginRun}
      />

      <DevPanel
        visible={ui.devOpen}
        onJump={(level) => newSpecimen({ jump: level })}
        onForce={(ending) => newSpecimen({ force: ending })}
        onReset={() => newSpecimen()}
        onClose={toggleDev}
        lightSensorStatus={lightSensorStatus}
        cameraStatus={ui.cameraStatus}
        cameraDebug={ui.cameraDebug}
      />
    </>
  );
}
