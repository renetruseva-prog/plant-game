import * as Notifications from 'expo-notifications';

/**
 * Real local notifications for the evil ending.
 *
 * These are a bonus layer only - the takeover itself is in-app UI so it can
 * never fail on stage. Everything here is best-effort and silently gives up.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    // Without these the banner is swallowed while the app is in the foreground,
    // which is exactly when the plant is "taking over".
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

let asked = false;

export async function ensureNotificationPermission(): Promise<boolean> {
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (asked) return false;
    asked = true;
    const next = await Notifications.requestPermissionsAsync();
    return next.granted;
  } catch {
    return false;
  }
}

export async function hauntWithNotifications() {
  const ok = await ensureNotificationPermission();
  if (!ok) return;

  const beats: { title: string; body: string; delay: number }[] = [
    { title: 'Specimen', body: 'i let myself out.', delay: 1200 },
    { title: 'Specimen', body: 'i know which one of these is you.', delay: 3600 },
  ];

  for (const beat of beats) {
    setTimeout(() => {
      Notifications.scheduleNotificationAsync({
        content: { title: beat.title, body: beat.body },
        trigger: null,
      }).catch(() => {});
    }, beat.delay);
  }
}

export async function cancelHaunting() {
  try {
    await Notifications.dismissAllNotificationsAsync();
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    // ignore
  }
}
