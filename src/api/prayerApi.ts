import type { Coordinates, ManualCity, PrayerTimesData } from "../types/prayer";
import type { TimeFormat } from "../types/settings";
import { API_BASES, STORAGE_KEYS } from "../utils/constants";
import { buildPrayerEntries, getDateKey } from "../utils/prayerHelpers";
import { storage } from "../utils/storage";

interface AlAdhanTimingPayload {
  code: number;
  status: string;
  data: {
    timings: Record<string, string>;
    date: {
      gregorian?: {
        date?: string; // DD-MM-YYYY
      };
    };
    meta: {
      timezone: string;
    };
  };
}

const fetchPrayerJson = async (url: string): Promise<AlAdhanTimingPayload> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Prayer API request failed (${response.status})`);
  }
  const payload = (await response.json()) as AlAdhanTimingPayload;
  if (payload.code !== 200 || !payload.data?.timings) {
    throw new Error(payload.status || "Invalid prayer API response");
  }
  return payload;
};

const mapPrayerResponse = (
  payload: AlAdhanTimingPayload,
  source: PrayerTimesData["source"],
  timeFormat: TimeFormat,
  extra: Partial<Pick<PrayerTimesData, "coordinates" | "city">>,
): PrayerTimesData => {
  const timezone = payload.data.meta?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const gregorianDate = payload.data.date?.gregorian?.date;
  const dateKey = gregorianDate
    ? (() => {
        const [day, month, year] = gregorianDate.split("-").map(Number);
        if (!day || !month || !year) return getDateKey(new Date());
        return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      })()
    : getDateKey(new Date());
  return {
    dateKey,
    timezone,
    source,
    prayers: buildPrayerEntries(payload.data.timings, dateKey, timezone, timeFormat),
    fetchedAt: Date.now(),
    ...extra,
  };
};

export const getPrayerTimesByCoordinates = async (
  coordinates: Coordinates,
  timeFormat: TimeFormat,
): Promise<PrayerTimesData> => {
  const url = `${API_BASES.aladhan}/timings?latitude=${coordinates.latitude}&longitude=${coordinates.longitude}&method=0`;
  const payload = await fetchPrayerJson(url);
  return mapPrayerResponse(payload, "gps", timeFormat, { coordinates });
};

export const getPrayerTimesByCity = async (
  manualCity: ManualCity,
  timeFormat: TimeFormat,
): Promise<PrayerTimesData> => {
  const params = new URLSearchParams({
    city: manualCity.city,
    country: manualCity.country,
    method: "0",
  });
  const url = `${API_BASES.aladhan}/timingsByCity?${params.toString()}`;
  const payload = await fetchPrayerJson(url);
  return mapPrayerResponse(payload, "city", timeFormat, { city: manualCity });
};

export const savePrayerTimesCache = async (data: PrayerTimesData): Promise<void> => {
  await storage.setJSON(STORAGE_KEYS.prayerTimesToday, data);
};

export const getCachedPrayerTimes = async (): Promise<PrayerTimesData | null> => {
  return storage.getJSON<PrayerTimesData>(STORAGE_KEYS.prayerTimesToday);
};

export const clearPrayerTimesCache = async (): Promise<void> => {
  await storage.remove(STORAGE_KEYS.prayerTimesToday);
};
