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
 * Ambient light, with a real fallback rather than a skipped feature.
 *
 * `LightSensor` only exists on Android. Everywhere else the player opens and
 * closes the curtains by hand, seeded from the time of day so the very first
 * frame already matches the room they are sitting in.
 */
export function useAmbientLight(enabled: boolean, onEnvChange: (env: Env) => void) {
  const [hasSensor, setHasSensor] = useState(false);
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
      setHasSensor(available);
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

  return { hasSensor, lux };
}
