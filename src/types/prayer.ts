export type PrayerName = "Fajr" | "Sunrise" | "Dhuhr" | "Asr" | "Maghrib" | "Isha";

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface ManualCity {
  city: string;
  country: string;
}

export interface PrayerTimeEntry {
  name: PrayerName;
  label: string;
  time24: string;
  displayTime: string;
  timestamp: number;
  dateTimeISO: string;
}

export interface PrayerTimesData {
  dateKey: string;
  timezone: string;
  source: "gps" | "city" | "cache";
  coordinates?: Coordinates;
  city?: ManualCity;
  prayers: PrayerTimeEntry[];
  fetchedAt: number;
}

export interface NextPrayerInfo {
  prayer: PrayerTimeEntry;
  remainingMs: number;
}

export interface PrayerHookState {
  isLoading: boolean;
  error: string | null;
  nextPrayer: NextPrayerInfo | null;
  countdownLabel: string;
  refreshPrayerTimes: () => Promise<void>;
  refreshFromGps: () => Promise<void>;
}

