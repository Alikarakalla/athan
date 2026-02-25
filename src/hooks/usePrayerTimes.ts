import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import * as Location from "expo-location";

import {
  getCachedPrayerTimes,
  getPrayerTimesByCity,
  getPrayerTimesByCoordinates,
  savePrayerTimesCache,
} from "../api/prayerApi";
import { syncAthanNotifications } from "../services/notificationService";
import { useAppStore } from "../store/appStore";
import {
  formatCountdown,
  getDateKey,
  getDateKeyForTimeZone,
  getNextPrayerInfo,
  isPrayerCacheValidForToday,
  shouldRefreshForNewDay,
} from "../utils/prayerHelpers";
import type { PrayerHookState } from "../types/prayer";

export const usePrayerTimes = (): PrayerHookState => {
  const prayerTimes = useAppStore((s) => s.prayerTimes);
  const manualCity = useAppStore((s) => s.manualCity);
  const coordinates = useAppStore((s) => s.coordinates);
  const timeFormat = useAppStore((s) => s.timeFormat);
  const notificationsEnabled = useAppStore((s) => s.notificationsEnabled);
  const prayerNotificationPrefs = useAppStore((s) => s.prayerNotificationPrefs);
  const athanSound = useAppStore((s) => s.athanSound);
  const setPrayerTimes = useAppStore((s) => s.setPrayerTimes);
  const setCoordinates = useAppStore((s) => s.setCoordinates);
  const setLocationPermission = useAppStore((s) => s.setLocationPermission);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(Date.now());
  const didBootstrapRef = useRef(false);
  const timeFormatRef = useRef(timeFormat);
  const observedDateKeyRef = useRef(getDateKey());
  const locationRefreshKeyRef = useRef<string>("");

  useEffect(() => {
    timeFormatRef.current = timeFormat;
  }, [timeFormat]);

  const persistPrayerTimes = useCallback(
    async (nextPrayerTimes: NonNullable<typeof prayerTimes>) => {
      setPrayerTimes(nextPrayerTimes);
      await savePrayerTimesCache(nextPrayerTimes);
    },
    [setPrayerTimes],
  );

  const fetchByCoordinates = useCallback(
    async (nextCoordinates: NonNullable<typeof coordinates>) => {
      const data = await getPrayerTimesByCoordinates(nextCoordinates, timeFormatRef.current);
      await persistPrayerTimes(data);
    },
    [persistPrayerTimes],
  );

  const fetchByManualCity = useCallback(async () => {
    if (!manualCity) {
      throw new Error("Manual city not set");
    }
    const data = await getPrayerTimesByCity(manualCity, timeFormatRef.current);
    await persistPrayerTimes(data);
  }, [manualCity, persistPrayerTimes]);

  const refreshPrayerTimes = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Manual city should override stale GPS coordinates if the user explicitly set a city.
      if (manualCity) {
        await fetchByManualCity();
      } else if (coordinates) {
        await fetchByCoordinates(coordinates);
      } else {
        const permission = await Location.requestForegroundPermissionsAsync();
        const granted = permission.status === "granted";
        setLocationPermission(granted ? "granted" : "denied");
        if (!granted) {
          throw new Error("Location permission denied. Set a manual city in Settings.");
        }
        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const nextCoords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        setCoordinates(nextCoords);
        await fetchByCoordinates(nextCoords);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load prayer times";
      setError(message);
      const cached = await getCachedPrayerTimes();
      if (cached) {
        setPrayerTimes({ ...cached, source: "cache" });
      }
    } finally {
      setIsLoading(false);
    }
  }, [coordinates, fetchByCoordinates, fetchByManualCity, manualCity, setCoordinates, setLocationPermission, setPrayerTimes]);

  const refreshFromGps = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      const granted = permission.status === "granted";
      setLocationPermission(granted ? "granted" : "denied");
      if (!granted) throw new Error("Location permission denied");

      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
      const nextCoords = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };
      setCoordinates(nextCoords);
      await fetchByCoordinates(nextCoords);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to refresh from GPS");
      const cached = await getCachedPrayerTimes();
      if (cached && isPrayerCacheValidForToday(cached)) {
        setPrayerTimes({ ...cached, source: "cache" });
      }
    } finally {
      setIsLoading(false);
    }
  }, [fetchByCoordinates, setCoordinates, setLocationPermission, setPrayerTimes]);

  useEffect(() => {
    const interval = setInterval(() => {
      setNowMs(Date.now());
      const currentDateKey = getDateKeyForTimeZone(useAppStore.getState().prayerTimes?.timezone);
      if (observedDateKeyRef.current !== currentDateKey) {
        observedDateKeyRef.current = currentDateKey;
        void refreshPrayerTimes();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [refreshPrayerTimes]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active" && shouldRefreshForNewDay(useAppStore.getState().prayerTimes)) {
        observedDateKeyRef.current = getDateKeyForTimeZone(useAppStore.getState().prayerTimes?.timezone);
        void refreshPrayerTimes();
      }
    });
    return () => sub.remove();
  }, [refreshPrayerTimes]);

  useEffect(() => {
    if (!prayerTimes) return;
    void syncAthanNotifications(prayerTimes, notificationsEnabled, athanSound, prayerNotificationPrefs);
  }, [athanSound, notificationsEnabled, prayerNotificationPrefs, prayerTimes]);

  useEffect(() => {
    const bootstrap = async () => {
      if (didBootstrapRef.current) return;
      didBootstrapRef.current = true;
      const cached = await getCachedPrayerTimes();
      if (cached && isPrayerCacheValidForToday(cached)) {
        setPrayerTimes({ ...cached, source: "cache" });
      }
      await refreshPrayerTimes();
    };
    void bootstrap();
  }, [refreshPrayerTimes, setPrayerTimes]);

  useEffect(() => {
    if (!didBootstrapRef.current) return;
    if (!prayerTimes) return;
    void refreshPrayerTimes();
  }, [timeFormat]); // Reformat display times by rebuilding entries from API.

  useEffect(() => {
    if (!didBootstrapRef.current) return;

    const key = manualCity
      ? `city:${manualCity.city.toLowerCase()}|${manualCity.country.toLowerCase()}`
      : coordinates
        ? `coords:${coordinates.latitude.toFixed(4)},${coordinates.longitude.toFixed(4)}`
        : "none";

    if (!locationRefreshKeyRef.current) {
      locationRefreshKeyRef.current = key;
      return;
    }
    if (locationRefreshKeyRef.current === key) return;

    locationRefreshKeyRef.current = key;
    void refreshPrayerTimes();
  }, [coordinates, manualCity, refreshPrayerTimes]);

  const nextPrayer = useMemo(
    () => (prayerTimes ? getNextPrayerInfo(prayerTimes.prayers, nowMs) : null),
    [nowMs, prayerTimes],
  );

  return {
    isLoading,
    error,
    nextPrayer,
    countdownLabel: nextPrayer ? formatCountdown(nextPrayer.remainingMs) : "--:--:--",
    refreshPrayerTimes,
    refreshFromGps,
  };
};
