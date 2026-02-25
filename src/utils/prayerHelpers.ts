import { PRAYER_ORDER } from "./constants";
import type { NextPrayerInfo, PrayerTimeEntry, PrayerTimesData } from "../types/prayer";
import type { TimeFormat } from "../types/settings";

type AlAdhanTimings = Record<string, string>;

const sanitizeApiTime = (value: string): string => {
  const match = value.match(/(\d{1,2}):(\d{2})/);
  if (!match) {
    throw new Error(`Invalid prayer time format: ${value}`);
  }
  return `${match[1].padStart(2, "0")}:${match[2]}`;
};

export const getDateKey = (date = new Date()): string => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseYmd = (dateKey: string) => {
  const [year, month, day] = dateKey.split("-").map(Number);
  if (!year || !month || !day) {
    throw new Error(`Invalid dateKey: ${dateKey}`);
  }
  return { year, month, day };
};

const getTimeZoneOffsetMs = (timestamp: number, timeZone: string): number => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(timestamp));

  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const localAsUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour),
    Number(map.minute),
    Number(map.second),
  );
  return localAsUtc - timestamp;
};

export const getDateKeyForTimeZone = (timeZone?: string, date = new Date()): string => {
  if (!timeZone) return getDateKey(date);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
};

const toZonedTimestamp = (dateKey: string, rawTime: string, timeZone: string): number => {
  const { year, month, day } = parseYmd(dateKey);
  const [hours, minutes] = sanitizeApiTime(rawTime).split(":").map(Number);
  const targetUtcAssumption = Date.UTC(year, month - 1, day, hours, minutes, 0, 0);

  // Iteratively resolve the zone offset at the target local wall-clock time.
  let resolved = targetUtcAssumption;
  for (let i = 0; i < 3; i += 1) {
    const offset = getTimeZoneOffsetMs(resolved, timeZone);
    resolved = targetUtcAssumption - offset;
  }
  return resolved;
};

export const parsePrayerDateTime = (baseDate: Date, rawTime: string): Date => {
  const [hours, minutes] = sanitizeApiTime(rawTime).split(":").map(Number);
  const date = new Date(baseDate);
  date.setHours(hours, minutes, 0, 0);
  return date;
};

export const formatPrayerTime = (date: Date, format: TimeFormat): string =>
  date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    hour12: format === "12h",
  });

export const formatPrayerClock = (rawTime: string, format: TimeFormat): string => {
  const [hours, minutes] = sanitizeApiTime(rawTime).split(":").map(Number);
  if (format === "24h") {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }
  const suffix = hours >= 12 ? "PM" : "AM";
  const h12 = hours % 12 || 12;
  return `${h12}:${String(minutes).padStart(2, "0")} ${suffix}`;
};

export const buildPrayerEntries = (
  timings: AlAdhanTimings,
  dateKey: string,
  timeZone: string,
  timeFormat: TimeFormat,
): PrayerTimeEntry[] =>
  PRAYER_ORDER.map((name) => {
    const timestamp = toZonedTimestamp(dateKey, timings[name], timeZone);
    const prayerDate = new Date(timestamp);
    return {
      name,
      label: name,
      time24: sanitizeApiTime(timings[name]),
      displayTime: formatPrayerClock(timings[name], timeFormat),
      timestamp,
      dateTimeISO: prayerDate.toISOString(),
    };
  });

export const isPrayerCacheValidForToday = (data: PrayerTimesData | null): boolean =>
  !!data && data.dateKey === getDateKeyForTimeZone(data.timezone);

export const getNextPrayerInfo = (prayers: PrayerTimeEntry[], now = Date.now()): NextPrayerInfo | null => {
  if (!prayers.length) return null;

  const upcoming = prayers.find((prayer) => prayer.timestamp > now);
  if (upcoming) {
    return { prayer: upcoming, remainingMs: Math.max(0, upcoming.timestamp - now) };
  }

  const fajr = prayers.find((prayer) => prayer.name === "Fajr");
  if (!fajr) return null;
  const tomorrowFajrTs = fajr.timestamp + 24 * 60 * 60 * 1000;
  return {
    prayer: { ...fajr, timestamp: tomorrowFajrTs, dateTimeISO: new Date(tomorrowFajrTs).toISOString() },
    remainingMs: Math.max(0, tomorrowFajrTs - now),
  };
};

export const formatCountdown = (ms: number): string => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((part) => `${part}`.padStart(2, "0")).join(":");
};

export const shouldRefreshForNewDay = (data: PrayerTimesData | null): boolean =>
  !data || data.dateKey !== getDateKeyForTimeZone(data.timezone);
