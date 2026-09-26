import { LIGHT } from './config';
import type { Env } from './types';

/** The room is dark during these hours when there is no sensor to ask. */
export function envFromClock(date = new Date()): Env {
  const h = date.getHours();
  const { from, to } = LIGHT.nightHours;
  return h >= from || h < to ? 'dark' : 'day';
}
