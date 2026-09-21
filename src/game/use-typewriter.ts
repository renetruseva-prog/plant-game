import { useEffect, useState } from 'react';

/**
 * Types `text` out one character at a time when `enabled`, otherwise shows it
 * whole. Used for the evil plant's messages so they read as something typing
 * at you rather than text simply appearing.
 */
export function useTypewriter(text: string, enabled: boolean, msPerChar = 45) {
  const [shownFor, setShownFor] = useState(text);
  const [chars, setChars] = useState(enabled ? 0 : text.length);

  // Adjusting state during render is the supported way to reset on a prop
  // change; doing it in an effect would cost an extra frame of stale text.
  if (text !== shownFor) {
    setShownFor(text);
    setChars(enabled ? 0 : text.length);
  }

  useEffect(() => {
    if (!enabled || chars >= text.length) return;
    const id = setTimeout(() => setChars((c) => c + 1), msPerChar);
    return () => clearTimeout(id);
  }, [enabled, chars, text.length, msPerChar]);

  return enabled ? text.slice(0, chars) : text;
}
