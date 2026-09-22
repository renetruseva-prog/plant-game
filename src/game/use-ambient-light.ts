import { LightSensor } from 'expo-sensors';
import { useEffect, useRef, useState } from 'react';

import { LIGHT } from './config';
import type { Env } from './types';

/** The room is dark during these hours when there is no sensor to ask. */
export function envFromClock(date = new Date()): Env {
  const h = date.getHours();
  const { from, to } = LIGHT.nightHours;
  return h >= from || h < to ? 'dark' : 'day';
}

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
  const [lux, setLux] = useState<number | null>(null);

  const onChange = useRef(onEnvChange);
  useEffect(() => {
    onChange.current = onEnvChange;
  });
  const lastEnv = useRef<Env | null>(null);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let sub: { remove: () => void } | undefined;

    (async () => {
      const available = await LightSensor.isAvailableAsync().catch(() => false);
      if (cancelled) return;
      setStatus(available ? 'available' : 'unavailable');
      if (!available) return;

      LightSensor.setUpdateInterval(LIGHT.intervalMs);
      sub = LightSensor.addListener(({ illuminance }) => {
        setLux(illuminance);
        // Hysteresis: only flip on a decisive reading, so a flickering sensor
        // can't strobe the whole interface.
        const next: Env | null =
          illuminance <= LIGHT.darkLux ? 'dark' : illuminance >= LIGHT.brightLux ? 'day' : null;
        if (next && next !== lastEnv.current) {
          lastEnv.current = next;
          onChange.current(next);
        }
      });
    })();

    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, [enabled]);

  return { status, lux };
}
