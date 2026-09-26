import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CameraLightSensor } from '@/components/game/camera-light-sensor';
import { FakeStatusBar } from '@/components/game/fake-status-bar';
import { GameOverlays } from '@/components/game/game-overlays';
import { GameStage } from '@/components/game/game-stage';
import { Progress } from '@/components/game/progress';
import { SpecimenTag } from '@/components/game/specimen-tag';
import { family, useGameFonts } from '@/game/fonts';
import { useDeviceInput } from '@/game/use-device-input';
import { useSpecimenView } from '@/game/use-specimen-view';
import { useTypewriter } from '@/game/use-typewriter';
import { useGameStore } from '@/store/game-store';
import { useUiStore } from '@/store/ui-store';

/**
 * The game screen: it only arranges things. What the game is and what's
 * open live in the stores (`src/store`), the rules in `src/game`, and the
 * pieces on screen in `src/components` - each reads what it needs from the
 * store, so this has nothing to pass down except how the specimen looks.
 */
export default function GameScreen() {
  const fontsLoaded = useGameFonts();
  const router = useRouter();
  const hydrated = useGameStore((s) => s.hydrated);

  const view = useSpecimenView();
  const { tilt, fallAngle, camera, lightSensorStatus } = useDeviceInput();

  const whisper = useUiStore((s) => s.whisper);
  const sheetUp = useUiStore((s) => s.sheetUp);
  const { palette, evil } = view;
  const typedWhisper = useTypewriter(whisper, evil && !sheetUp);
  const openGallery = () => router.push('/gallery');

  // Nothing to show until the fonts and the saved run are in.
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
          mark={view.mark}
          level={view.level}
          latin={view.latin}
          stageName={view.stageName}
          goal={view.goal}
          generation={view.generation}
          onSecretHold={useUiStore.getState().toggleDev}
        />

        <GameStage
          palette={palette}
          evil={evil}
          active={view.active}
          env={view.env}
          level={view.level}
          form={view.form}
          ending={view.ending}
          mood={view.displayMood}
          roughRatio={view.roughRatio}
          growthKey={view.growthKey}
          tilt={tilt}
          fallAngle={fallAngle}
          onOpenGallery={openGallery}
        />

        <Animated.Text
          layout={LinearTransition.duration(300)}
          accessibilityLiveRegion="polite"
          numberOfLines={2}
          style={[styles.whisper, { color: palette.ink, fontFamily: family('medium', evil) }]}>
          {evil && !sheetUp ? `${typedWhisper}▌` : whisper}
        </Animated.Text>

        <Progress palette={palette} evil={evil} level={view.level} count={view.count} />
      </SafeAreaView>

      <CameraLightSensor {...camera} />

      <GameOverlays
        palette={palette}
        evil={evil}
        lightSensorStatus={lightSensorStatus}
        onOpenGallery={openGallery}
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
