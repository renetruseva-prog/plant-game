import { LightSensor } from 'expo-sensors';
import { useEffect, useEffectEvent, useRef, useState } from 'react';

import { LIGHT } from './config';
import type { Env } from './types';

/**
 * `'checking'` until the async availability probe resolves, so a caller
 * deciding whether to fall back to something else (the camera sampler, the
 * manual toggle) can wait for a real answer instead of racing a `false` that
 * only means "haven't checked yet".
 */
export type LightSensorStatus = 'checking' | 'available' | 'unavailable';

/**
 * Real ambient light on Android via `LightSensor`. On iOS - or any device
 * without one - `status` resolves to `'unavailable'` so the caller can fall
 * back to something else (see `CameraLightSensor`, then the manual curtains
 * toggle as the last resort).
 */
export function useAmbientLight(enabled: boolean, onEnvChange: (env: Env) => void) {
  const [status, setStatus] = useState<LightSensorStatus>('checking');
  // The newest reading, kept in a ref rather than state: it changes every
  // 600ms and nothing draws it, so making it state would re-render the whole
  // screen for no reason. Whoever needs it asks with `getLux`.
  const lux = useRef<number | null>(null);
  const lastEnv = useRef<Env | null>(null);

  // Always calls the newest `onEnvChange`, without the subscription below
  // having to restart when it changes.
  const emitEnv = useEffectEvent(onEnvChange);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let sub: { remove: () => void } | undefined;

    (async () => {
      const available = await LightSensor.isAvailableAsync().catch(() => false);
      if (cancelled) return;
      setStatus(available ? 'available' : 'unavailable');
      if (!available) return;

      // Some environments (web, mismatched native modules) may not implement
      // `addListener`. Guard against that to avoid "this._nativeModule.addListener
      // is not a function" runtime errors.
      if (typeof LightSensor.setUpdateInterval !== 'function' || typeof LightSensor.addListener !== 'function') {
        setStatus('unavailable');
        return;
      }

      LightSensor.setUpdateInterval(LIGHT.intervalMs);
      sub = LightSensor.addListener(({ illuminance }) => {
        lux.current = illuminance;
        // Hysteresis: only flip on a decisive reading, so a flickering sensor
        // can't strobe the whole interface.
        const next: Env | null =
          illuminance <= LIGHT.darkLux ? 'dark' : illuminance >= LIGHT.brightLux ? 'day' : null;
        if (next && next !== lastEnv.current) {
          lastEnv.current = next;
          emitEnv(next);
        }
      });
    })().catch(() => {
      // Sensor exists but can't be subscribed to (e.g. web): fall back to the camera.
      if (!cancelled) setStatus('unavailable');
    });

    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, [enabled]);

  return { status, getLux: () => lux.current };
}
