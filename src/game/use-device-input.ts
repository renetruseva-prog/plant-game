import { useGameStore } from '@/store/game-store';
import { useUiStore } from '@/store/ui-store';

import { LIGHT } from './config';
import { fall, interact } from './interact';
import { useAmbientLight } from './use-ambient-light';
import { useMotion } from './use-motion';
import { useUpsideDown } from './use-upside-down';

/**
 * Everything the phone itself feeds into the game: walking and shaking, being
 * turned upside down, the room's light, and the camera. Each is turned into
 * the game's own events by calling `interact` / `fall`, which write to the
 * stores directly - nothing here needs to be threaded through props.
 *
 * All of it only listens while a run is actually in play.
 */
export function useDeviceInput() {
  const active = useGameStore((s) => s.started && s.ending === null);

  const tilt = useMotion(active, {
    onWalk: () => interact('walk'),
    onNudge: () => interact('nudge'),
    onJolt: () => interact('jolt'),
  });
  const { fallAngle } = useUpsideDown(active, fall);

  const onLightEnv = (env: 'day' | 'dark') => {
    if (env === useGameStore.getState().env) return;
    interact(env === 'dark' ? 'nightfall' : 'daylight');
  };
  const { status: lightSensorStatus, getLux } = useAmbientLight(active, onLightEnv);

  const { setCameraStatus, setCameraDebug } = useUiStore.getState();

  // The camera runs once we know which kind of phone this is - 'checking'
  // means the async probe hasn't resolved yet, and mounting it (and asking
  // for its permission) mid-probe could flash a prompt for nothing.
  //  - No LightSensor (iPhone, some Androids): the camera is also the room's
  //    light meter ('ambient').
  //  - A real LightSensor (many Androids): that sensor keeps deciding day and
  //    night, and the camera only watches for a finger over the lens
  //    ('cover-only'). This does mean asking those players for the camera,
  //    deliberately - it's what makes covering it put the plant to sleep.
  const camera = {
    enabled: active && lightSensorStatus !== 'checking',
    mode: lightSensorStatus === 'available' ? ('cover-only' as const) : ('ambient' as const),
    onEnvChange: onLightEnv,
    onStatus: setCameraStatus,
    onSleep: () => interact('sleep'),
    // A covering just ended in cover-only mode: put the room back to what the
    // real light sensor reads, which never stopped measuring.
    onUncovered: () => {
      const reading = getLux();
      onLightEnv(reading !== null && reading <= LIGHT.darkLux ? 'dark' : 'day');
    },
    onDebug: setCameraDebug,
  };

  return { tilt, fallAngle, camera, lightSensorStatus };
}
