import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

import type { Coordinates, ManualCity, PrayerName, PrayerTimesData } from "../types/prayer";
import type { LastReadPosition, QuranBookmark, SurahSummary } from "../types/quran";
import type {
  AppLanguage,
  AthanSoundKey,
  PermissionState,
  ThemeCmsConfig,
  ThemeColorKey,
  ThemeMode,
  TimeFormat,
} from "../types/settings";
import { NOTIFICATION_PRAYERS, STORAGE_KEYS } from "../utils/constants";

type PrayerNotificationPrefs = Partial<Record<PrayerName, boolean>>;

export interface QuranPlayerState {
  sourceUrl: string | null;
  surahNumber: number | null;
  surahName: string;
  totalAyahs: number;
  currentAyah: number | null;
  isLoading: boolean;
  isPlaying: boolean;
  positionMillis: number;
  durationMillis: number;
  error: string | null;
}

export interface LatmiyatPlayerState {
  sourceUrl: string | null;
  trackId: string | null;
  title: string;
  artistName: string;
  artworkUrl: string | null;
  trackUrl: string | null;
  isLoading: boolean;
  isPlaying: boolean;
  positionMillis: number;
  durationMillis: number;
  error: string | null;
}

const INITIAL_QURAN_PLAYER_STATE: QuranPlayerState = {
  sourceUrl: null,
  surahNumber: null,
  surahName: "",
  totalAyahs: 0,
  currentAyah: null,
  isLoading: false,
  isPlaying: false,
  positionMillis: 0,
  durationMillis: 0,
  error: null,
};

const INITIAL_LATMIYAT_PLAYER_STATE: LatmiyatPlayerState = {
  sourceUrl: null,
  trackId: null,
  title: "",
  artistName: "",
  artworkUrl: null,
  trackUrl: null,
  isLoading: false,
  isPlaying: false,
  positionMillis: 0,
  durationMillis: 0,
  error: null,
};

interface AppState {
  themeMode: ThemeMode;
  themeCms: ThemeCmsConfig;
  language: AppLanguage;
  notificationsEnabled: boolean;
  liveActivityEnabled: boolean;
  prayerNotificationPrefs: PrayerNotificationPrefs;
  athanSound: AthanSoundKey;
  timeFormat: TimeFormat;
  manualCity: ManualCity | null;
  coordinates: Coordinates | null;
  locationPermission: PermissionState;
  notificationPermission: PermissionState;
  prayerTimes: PrayerTimesData | null;
  surahList: SurahSummary[];
  quranReciterId: number;
  quranReciterName: string;
  bookmarks: QuranBookmark[];
  lastRead: LastReadPosition | null;
  quranPlayer: QuranPlayerState;
  latmiyatPlayer: LatmiyatPlayerState;
  setThemeMode: (mode: ThemeMode) => void;
  setThemeColor: (targetMode: "light" | "dark", key: ThemeColorKey, value: string) => void;
  resetThemeCms: (targetMode?: "light" | "dark") => void;
  setLanguage: (language: AppLanguage) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  setLiveActivityEnabled: (enabled: boolean) => void;
  setPrayerNotificationEnabled: (prayerName: PrayerName, enabled: boolean) => void;
  togglePrayerNotificationEnabled: (prayerName: PrayerName) => void;
  setAthanSound: (sound: AthanSoundKey) => void;
  setTimeFormat: (format: TimeFormat) => void;
  setManualCity: (city: ManualCity | null) => void;
  setCoordinates: (coords: Coordinates | null) => void;
  setLocationPermission: (state: PermissionState) => void;
  setNotificationPermission: (state: PermissionState) => void;
  setPrayerTimes: (prayerTimes: PrayerTimesData | null) => void;
  setSurahList: (surahList: SurahSummary[]) => void;
  setQuranReciter: (reciter: { id: number; name: string }) => void;
  toggleBookmark: (bookmark: Omit<QuranBookmark, "id" | "createdAt">) => void;
  removeBookmark: (id: string) => void;
  setLastRead: (lastRead: LastReadPosition) => void;
  setQuranPlayerState: (patch: Partial<QuranPlayerState>) => void;
  resetQuranPlayer: () => void;
  setLatmiyatPlayerState: (patch: Partial<LatmiyatPlayerState>) => void;
  resetLatmiyatPlayer: () => void;
  clearCachedContentState: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      themeMode: "dark",
      themeCms: { light: {}, dark: {} },
      language: "ar",
      notificationsEnabled: true,
      liveActivityEnabled: true,
      prayerNotificationPrefs: Object.fromEntries(NOTIFICATION_PRAYERS.map((p) => [p, true])) as PrayerNotificationPrefs,
      athanSound: "default",
      timeFormat: "12h",
      manualCity: null,
      coordinates: null,
      locationPermission: "unknown",
      notificationPermission: "unknown",
      prayerTimes: null,
      surahList: [],
      quranReciterId: 7,
      quranReciterName: "Mishari Rashid al-`Afasy",
      bookmarks: [],
      lastRead: null,
      quranPlayer: INITIAL_QURAN_PLAYER_STATE,
      latmiyatPlayer: INITIAL_LATMIYAT_PLAYER_STATE,

      setThemeMode: () => set({ themeMode: "dark" }),
      setThemeColor: (targetMode, key, value) =>
        set((state) => ({
          themeCms: {
            ...state.themeCms,
            [targetMode]: {
              ...state.themeCms[targetMode],
              [key]: value,
            },
          },
        })),
      resetThemeCms: (targetMode) =>
        set((state) => ({
          themeCms: targetMode
            ? { ...state.themeCms, [targetMode]: {} }
            : { light: {}, dark: {} },
        })),
      setLanguage: (language) => set({ language }),
      setNotificationsEnabled: (notificationsEnabled) => set({ notificationsEnabled }),
      setLiveActivityEnabled: (liveActivityEnabled) => set({ liveActivityEnabled }),
      setPrayerNotificationEnabled: (prayerName, enabled) =>
        set((state) => ({
          prayerNotificationPrefs: { ...state.prayerNotificationPrefs, [prayerName]: enabled },
        })),
      togglePrayerNotificationEnabled: (prayerName) =>
        set((state) => ({
          prayerNotificationPrefs: {
            ...state.prayerNotificationPrefs,
            [prayerName]: !(state.prayerNotificationPrefs[prayerName] ?? true),
          },
        })),
      setAthanSound: (athanSound) => set({ athanSound }),
      setTimeFormat: (timeFormat) => set({ timeFormat }),
      setManualCity: (manualCity) => set({ manualCity }),
      setCoordinates: (coordinates) => set({ coordinates }),
      setLocationPermission: (locationPermission) => set({ locationPermission }),
      setNotificationPermission: (notificationPermission) => set({ notificationPermission }),
      setPrayerTimes: (prayerTimes) => set({ prayerTimes }),
      setSurahList: (surahList) => set({ surahList }),
      setQuranReciter: (reciter) => set({ quranReciterId: reciter.id, quranReciterName: reciter.name }),

      toggleBookmark: (bookmarkInput) => {
        const bookmarks = get().bookmarks;
        const existing = bookmarks.find(
          (b) => b.surahNumber === bookmarkInput.surahNumber && b.ayahNumber === bookmarkInput.ayahNumber,
        );
        if (existing) {
          set({ bookmarks: bookmarks.filter((b) => b.id !== existing.id) });
          return;
        }

        const next: QuranBookmark = {
          ...bookmarkInput,
          id: `${bookmarkInput.surahNumber}:${bookmarkInput.ayahNumber}`,
          createdAt: Date.now(),
        };
        set({ bookmarks: [next, ...bookmarks] });
      },

      removeBookmark: (id) => set({ bookmarks: get().bookmarks.filter((b) => b.id !== id) }),
      setLastRead: (lastRead) => set({ lastRead }),
      setQuranPlayerState: (patch) =>
        set((state) => ({
          quranPlayer: {
            ...state.quranPlayer,
            ...patch,
          },
        })),
      resetQuranPlayer: () => set({ quranPlayer: INITIAL_QURAN_PLAYER_STATE }),
      setLatmiyatPlayerState: (patch) =>
        set((state) => ({
          latmiyatPlayer: {
            ...state.latmiyatPlayer,
            ...patch,
          },
        })),
      resetLatmiyatPlayer: () => set({ latmiyatPlayer: INITIAL_LATMIYAT_PLAYER_STATE }),

      clearCachedContentState: () =>
        set({
          prayerTimes: null,
          surahList: [],
        }),
    }),
    {
      name: STORAGE_KEYS.appStore,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        themeMode: state.themeMode,
        themeCms: state.themeCms,
        language: state.language,
        notificationsEnabled: state.notificationsEnabled,
        liveActivityEnabled: state.liveActivityEnabled,
        prayerNotificationPrefs: state.prayerNotificationPrefs,
        athanSound: state.athanSound,
        timeFormat: state.timeFormat,
        manualCity: state.manualCity,
        coordinates: state.coordinates,
        locationPermission: state.locationPermission,
        notificationPermission: state.notificationPermission,
        prayerTimes: state.prayerTimes,
        surahList: state.surahList,
        quranReciterId: state.quranReciterId,
        quranReciterName: state.quranReciterName,
        bookmarks: state.bookmarks,
        lastRead: state.lastRead,
      }),
    },
  ),
);
