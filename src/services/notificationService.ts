import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import type { PrayerName } from "../types/prayer";
import type { PrayerTimesData } from "../types/prayer";
import type { AthanSoundKey } from "../types/settings";
import { ATHAN_SOUND_OPTIONS, NOTIFICATION_PRAYERS, STORAGE_KEYS } from "../utils/constants";

type NotificationScheduleMeta = {
  scheduleKey: string;
  notificationIds: string[];
};

type PrayerNotificationPrefs = Partial<Record<PrayerName, boolean>>;

const ATHAN_TAG_PREFIX = "athan-";

export const configureNotificationBehavior = (): void => {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
};

const getAthanSoundFilename = (soundKey: AthanSoundKey): string | null =>
  ATHAN_SOUND_OPTIONS.find((s) => s.key === soundKey)?.filename ?? null;

const getAthanChannelId = (soundKey: AthanSoundKey): string => `athan-${soundKey}`;

export const initializeNotificationChannel = async (soundKey: AthanSoundKey = "default"): Promise<void> => {
  if (Platform.OS !== "android") return;
  const soundFilename = getAthanSoundFilename(soundKey);
  await Notifications.setNotificationChannelAsync(getAthanChannelId(soundKey), {
    name: `Athan Notifications (${soundKey})`,
    importance: Notifications.AndroidImportance.HIGH,
    sound: soundFilename ?? "default",
  });
};

export const requestNotificationPermission = async (): Promise<boolean> => {
  if (!Device.isDevice) return false;

  const current = await Notifications.getPermissionsAsync();
  if (current.granted || current.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) {
    return true;
  }

  const requested = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: false,
      allowSound: true,
    },
  });
  return requested.granted || requested.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
};

const buildScheduleKey = (
  prayerTimes: PrayerTimesData,
  soundKey: AthanSoundKey,
  prayerPrefs: PrayerNotificationPrefs,
): string => {
  const signature = prayerTimes.prayers
    .filter((p) => NOTIFICATION_PRAYERS.includes(p.name))
    .map((p) => `${p.name}:${p.timestamp}:${prayerPrefs[p.name] ?? true ? 1 : 0}`)
    .join("|");
  return `${prayerTimes.dateKey}|${soundKey}|${signature}`;
};

const getStoredMeta = async (): Promise<NotificationScheduleMeta | null> => {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.notificationScheduleMeta);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as NotificationScheduleMeta;
  } catch {
    return null;
  }
};

const setStoredMeta = async (meta: NotificationScheduleMeta): Promise<void> => {
  await AsyncStorage.setItem(STORAGE_KEYS.notificationScheduleMeta, JSON.stringify(meta));
};

export const clearNotificationScheduleMeta = async (): Promise<void> => {
  await AsyncStorage.removeItem(STORAGE_KEYS.notificationScheduleMeta);
};

export const cancelAthanNotifications = async (): Promise<void> => {
  const meta = await getStoredMeta();
  if (meta?.notificationIds?.length) {
    await Promise.all(
      meta.notificationIds.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined)),
    );
  }

  const all = await Notifications.getAllScheduledNotificationsAsync();
  const athanRequests = all.filter((n) => `${n.content.data?.tag ?? ""}`.startsWith(ATHAN_TAG_PREFIX));
  await Promise.all(
    athanRequests.map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => undefined)),
  );

  await clearNotificationScheduleMeta();
};

export const syncAthanNotifications = async (
  prayerTimes: PrayerTimesData | null,
  enabled: boolean,
  soundKey: AthanSoundKey,
  prayerPrefs: PrayerNotificationPrefs = {},
): Promise<void> => {
  if (!enabled || !prayerTimes) {
    await cancelAthanNotifications();
    return;
  }

  const hasPermission = await requestNotificationPermission();
  if (!hasPermission) return;
  await initializeNotificationChannel(soundKey);

  const scheduleKey = buildScheduleKey(prayerTimes, soundKey, prayerPrefs);
  const existing = await getStoredMeta();
  if (existing?.scheduleKey === scheduleKey && existing.notificationIds.length > 0) {
    return;
  }

  await cancelAthanNotifications();

  const now = Date.now();
  const ids: string[] = [];
  const channelId = Platform.OS === "android" ? getAthanChannelId(soundKey) : undefined;
  const soundFilename = getAthanSoundFilename(soundKey);
  for (const prayer of prayerTimes.prayers) {
    if (!NOTIFICATION_PRAYERS.includes(prayer.name)) continue;
    if ((prayerPrefs[prayer.name] ?? true) === false) continue;
    if (prayer.timestamp <= now) continue;

    const trigger: Notifications.NotificationTriggerInput =
      Platform.OS === "android" && channelId
        ? {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: new Date(prayer.timestamp),
            channelId,
          }
        : {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: new Date(prayer.timestamp),
          };

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: "Athan",
        body: `It's time for ${prayer.name}`,
        // iOS custom notification sounds require a bundled sound in the app build.
        // Fall back to default if a custom filename is selected but not bundled on iOS.
        sound: Platform.OS === "ios" ? "default" : (soundFilename ?? "default"),
        data: {
          tag: `${ATHAN_TAG_PREFIX}${prayerTimes.dateKey}`,
          prayerName: prayer.name,
          athanSound: soundKey,
        },
      },
      trigger,
    });
    ids.push(id);
  }

  await setStoredMeta({ scheduleKey, notificationIds: ids });
};
