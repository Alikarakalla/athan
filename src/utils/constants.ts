import type { AthanSoundKey } from "../types/settings";
import type { PrayerName } from "../types/prayer";

export const API_BASES = {
  aladhan: "https://api.aladhan.com/v1",
  quranCloud: "https://api.alquran.cloud/v1",
} as const;

export const STORAGE_KEYS = {
  appStore: "shia-athan-quran-store",
  prayerTimesToday: "shia-athan-quran/prayer-times-today",
  quranSurahList: "shia-athan-quran/quran-surah-list",
  notificationScheduleMeta: "shia-athan-quran/notification-schedule-meta",
} as const;

export const PRAYER_ORDER: PrayerName[] = ["Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha"];
export const NOTIFICATION_PRAYERS: PrayerName[] = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];
export const DEFAULT_MANUAL_COUNTRY = "United States";

export const ATHAN_SOUND_OPTIONS: Array<{
  key: AthanSoundKey;
  label: string;
  filename: string | null;
  previewUrl: string | null;
}> = [
  { key: "default", label: "System Default", filename: null, previewUrl: null },
  {
    key: "athan_makkah",
    label: "Athan Makkah",
    filename: "athan_makkah.wav",
    previewUrl: "https://cdn.aladhan.com/audio/adhans/a1.mp3",
  },
  {
    key: "athan_madina",
    label: "Athan Madina",
    filename: "athan_madina.wav",
    previewUrl: "https://cdn.aladhan.com/audio/adhans/a2.mp3",
  },
  {
    key: "athan_iraq",
    label: "Athan Iraq",
    filename: "athan_iraq.wav",
    previewUrl: "https://cdn.aladhan.com/audio/adhans/a3.mp3",
  },
];
