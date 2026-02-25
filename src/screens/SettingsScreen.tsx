import { useEffect, useRef, useState } from "react";
import { Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import {
  Audio,
  InterruptionModeAndroid,
  InterruptionModeIOS,
  type AVPlaybackStatus,
} from "expo-av";
import { MaterialIcons } from "@expo/vector-icons";
import * as Location from "expo-location";

import { clearPrayerTimesCache } from "../api/prayerApi";
import { clearQuranCache, fetchQuranReciterPreviewUrl, fetchQuranReciters } from "../api/quranApi";
import { ScreenContainer } from "../components/ScreenContainer";
import { useI18n } from "../hooks/useI18n";
import { useAppTheme } from "../hooks/useAppTheme";
import { isNativeUIColorPickerAvailable, isNativeUIColorPickerSupported, presentNativeUIColorPicker } from "../services/nativeColorPickerService";
import { cancelAthanNotifications, requestNotificationPermission } from "../services/notificationService";
import { useAppStore } from "../store/appStore";
import type { QuranReciter } from "../types/quran";
import type { AthanSoundKey, ThemeColorKey } from "../types/settings";
import { ATHAN_SOUND_OPTIONS, DEFAULT_MANUAL_COUNTRY, NOTIFICATION_PRAYERS } from "../utils/constants";
import { darkTheme, lightTheme } from "../utils/theme";

type SettingsSheetKey = "appearance" | "prayer" | "quranVoice" | "general" | "location" | "storage";

const THEME_COLOR_KEYS: ThemeColorKey[] = [
  "primary",
  "accent",
  "background",
  "backgroundAlt",
  "card",
  "border",
  "text",
  "textMuted",
  "success",
  "danger",
];

const COLOR_GRID = [
  "#B08968", "#9C7A52", "#D0B089", "#EADBC8", "#7F5539", "#6B4F3A",
  "#1F1A12", "#2A2119", "#FFFDF7", "#F4F0E5", "#EFE7D1", "#D8CFB5",
  "#CBA67A", "#D6B489", "#A97142", "#8B5E34", "#6E6454", "#C0B39F",
  "#B14A42", "#F27C74", "#8B6A46", "#A3B18A", "#588157", "#3A5A40",
  "#5E548E", "#9F86C0", "#4361EE", "#4895EF", "#4CC9F0", "#7209B7",
  "#FFB703", "#FB8500", "#E63946", "#2A9D8F", "#219EBC", "#264653",
];

const THEME_COLOR_LABELS: Record<ThemeColorKey, { en: string; ar: string }> = {
  background: { en: "Background", ar: "الخلفية" },
  backgroundAlt: { en: "Alt Background", ar: "خلفية ثانوية" },
  card: { en: "Card", ar: "البطاقات" },
  border: { en: "Border", ar: "الحدود" },
  text: { en: "Text", ar: "النص" },
  textMuted: { en: "Muted Text", ar: "النص الثانوي" },
  primary: { en: "Primary", ar: "اللون الأساسي" },
  accent: { en: "Accent", ar: "اللون المساعد" },
  danger: { en: "Danger", ar: "الخطر" },
  success: { en: "Success", ar: "النجاح" },
};

type HubRowProps = {
  theme: ReturnType<typeof useAppTheme>;
  icon: React.ComponentProps<typeof MaterialIcons>["name"];
  title: string;
  value?: string;
  onPress: () => void;
  danger?: boolean;
};

const HubRow = ({ theme, icon, title, value, onPress, danger = false }: HubRowProps) => {
  const iconColor = danger ? theme.colors.danger : theme.colors.primary;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.listRow, { opacity: pressed ? 0.86 : 1 }]}>
      <View style={[styles.leadingIcon, { backgroundColor: theme.colors.backgroundAlt }]}>
        <MaterialIcons name={icon} size={18} color={iconColor} />
      </View>
      <View style={styles.listRowCopy}>
        <Text style={[styles.listRowTitle, { color: theme.colors.text }]} numberOfLines={1}>
          {title}
        </Text>
        {value ? (
          <Text style={[styles.listRowValue, { color: theme.colors.textMuted }]} numberOfLines={1}>
            {value}
          </Text>
        ) : null}
      </View>
      <MaterialIcons name="chevron-right" size={20} color={theme.colors.textMuted} />
    </Pressable>
  );
};

const Divider = ({ themeBorder, style }: { themeBorder: string; style?: object }) => (
  <View style={[styles.rowDivider, { backgroundColor: themeBorder }, style]} />
);

export const SettingsScreen = () => {
  const theme = useAppTheme();
  const { t, language } = useI18n();
  const themeMode = useAppStore((s) => s.themeMode);
  const themeCms = useAppStore((s) => s.themeCms);
  const setLanguage = useAppStore((s) => s.setLanguage);
  const notificationsEnabled = useAppStore((s) => s.notificationsEnabled);
  const athanSound = useAppStore((s) => s.athanSound);
  const prayerNotificationPrefs = useAppStore((s) => s.prayerNotificationPrefs);
  const timeFormat = useAppStore((s) => s.timeFormat);
  const manualCity = useAppStore((s) => s.manualCity);
  const quranReciterId = useAppStore((s) => s.quranReciterId);
  const quranReciterName = useAppStore((s) => s.quranReciterName);
  const setThemeMode = useAppStore((s) => s.setThemeMode);
  const setThemeColor = useAppStore((s) => s.setThemeColor);
  const resetThemeCms = useAppStore((s) => s.resetThemeCms);
  const setNotificationsEnabled = useAppStore((s) => s.setNotificationsEnabled);
  const setAthanSound = useAppStore((s) => s.setAthanSound);
  const setPrayerNotificationEnabled = useAppStore((s) => s.setPrayerNotificationEnabled);
  const setNotificationPermission = useAppStore((s) => s.setNotificationPermission);
  const setTimeFormat = useAppStore((s) => s.setTimeFormat);
  const setManualCity = useAppStore((s) => s.setManualCity);
  const setCoordinates = useAppStore((s) => s.setCoordinates);
  const setQuranReciter = useAppStore((s) => s.setQuranReciter);
  const clearCachedContentState = useAppStore((s) => s.clearCachedContentState);

  const [city, setCity] = useState(manualCity?.city ?? "");
  const [country, setCountry] = useState(manualCity?.country ?? DEFAULT_MANUAL_COUNTRY);
  const [reciters, setReciters] = useState<QuranReciter[]>([]);
  const [reciterQuery, setReciterQuery] = useState("");
  const [showReciters, setShowReciters] = useState(false);
  const [isRecitersLoading, setIsRecitersLoading] = useState(false);
  const [recitersError, setRecitersError] = useState<string | null>(null);
  const [previewLoadingId, setPreviewLoadingId] = useState<number | null>(null);
  const [previewPlayingId, setPreviewPlayingId] = useState<number | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [athanPreviewLoadingKey, setAthanPreviewLoadingKey] = useState<AthanSoundKey | null>(null);
  const [athanPreviewPlayingKey, setAthanPreviewPlayingKey] = useState<AthanSoundKey | null>(null);
  const [athanPreviewError, setAthanPreviewError] = useState<string | null>(null);
  const [activeSheet, setActiveSheet] = useState<SettingsSheetKey | null>(null);
  const [showThemeCms, setShowThemeCms] = useState(false);
  const [cmsTargetMode, setCmsTargetMode] = useState<"light" | "dark">("light");
  const [cmsPickerTab, setCmsPickerTab] = useState<"grid" | "spectrum" | "sliders">("grid");
  const [selectedThemeColorKey, setSelectedThemeColorKey] = useState<ThemeColorKey>("primary");
  const [themeHexInput, setThemeHexInput] = useState("");
  const previewSoundRef = useRef<Audio.Sound | null>(null);
  const previewUrlCacheRef = useRef<Record<number, string>>({});

  useEffect(() => {
    setCity(manualCity?.city ?? "");
    setCountry(manualCity?.country ?? DEFAULT_MANUAL_COUNTRY);
  }, [manualCity]);

  const loadReciters = async () => {
    setIsRecitersLoading(true);
    setRecitersError(null);
    try {
      const data = await fetchQuranReciters();
      setReciters(data);
    } catch (err) {
      setRecitersError(err instanceof Error ? err.message : t("quran.loadingReciters"));
    } finally {
      setIsRecitersLoading(false);
    }
  };

  useEffect(() => {
    if (!showReciters || reciters.length) return;
    void loadReciters();
  }, [showReciters, reciters.length, t]);

  const unloadPreview = async () => {
    if (!previewSoundRef.current) return;
    const sound = previewSoundRef.current;
    previewSoundRef.current = null;
    try {
      await sound.unloadAsync();
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    return () => {
      void unloadPreview();
    };
  }, []);

  const playReciterPreview = async (reciter: QuranReciter) => {
    setPreviewError(null);
    setPreviewLoadingId(reciter.id);
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
        interruptionModeIOS: InterruptionModeIOS.DoNotMix,
        shouldDuckAndroid: true,
      });

      const current = previewSoundRef.current;
      if (current && previewPlayingId === reciter.id) {
        const status = await current.getStatusAsync();
        if (status.isLoaded && status.isPlaying) {
          await current.pauseAsync();
          setPreviewPlayingId(null);
          setPreviewLoadingId(null);
          return;
        }
        if (status.isLoaded && !status.isPlaying) {
          await current.playAsync();
          setPreviewPlayingId(reciter.id);
          setPreviewLoadingId(null);
          return;
        }
      }

      await unloadPreview();
      setAthanPreviewPlayingKey(null);
      setAthanPreviewLoadingKey(null);

      const uri =
        previewUrlCacheRef.current[reciter.id] ??
        (await fetchQuranReciterPreviewUrl(reciter.id));
      previewUrlCacheRef.current[reciter.id] = uri;

      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true, progressUpdateIntervalMillis: 250 },
        (status: AVPlaybackStatus) => {
          if (!status.isLoaded) return;
          if (status.didJustFinish) {
            setPreviewPlayingId(null);
          } else {
            setPreviewPlayingId(status.isPlaying ? reciter.id : null);
          }
        },
      );
      previewSoundRef.current = sound;
      setPreviewPlayingId(reciter.id);
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : "Preview playback failed");
      setPreviewPlayingId(null);
    } finally {
      setPreviewLoadingId(null);
    }
  };

  const getAthanPreviewUri = async (key: AthanSoundKey, filename: string | null, previewUrl: string | null) => {
    if (key === "default" || !filename) {
      throw new Error("System default sound cannot be previewed. Select a custom Athan sound to preview.");
    }
    if (!previewUrl) {
      throw new Error(`No preview URL is configured for ${filename}.`);
    }
    return previewUrl;
  };

  const playAthanPreview = async (
    key: AthanSoundKey,
    filename: string | null,
    previewUrl: string | null,
  ) => {
    setAthanPreviewError(null);
    setAthanPreviewLoadingKey(key);
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
        interruptionModeIOS: InterruptionModeIOS.DoNotMix,
        shouldDuckAndroid: true,
      });

      const current = previewSoundRef.current;
      if (current && athanPreviewPlayingKey === key) {
        const status = await current.getStatusAsync();
        if (status.isLoaded && status.isPlaying) {
          await current.pauseAsync();
          setAthanPreviewPlayingKey(null);
          setAthanPreviewLoadingKey(null);
          return;
        }
        if (status.isLoaded && !status.isPlaying) {
          await current.playAsync();
          setAthanPreviewPlayingKey(key);
          setPreviewPlayingId(null);
          setAthanPreviewLoadingKey(null);
          return;
        }
      }

      await unloadPreview();
      setPreviewPlayingId(null);
      setPreviewLoadingId(null);

      const uri = await getAthanPreviewUri(key, filename, previewUrl);

      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true, progressUpdateIntervalMillis: 250 },
        (status: AVPlaybackStatus) => {
          if (!status.isLoaded) return;
          if (status.didJustFinish) {
            setAthanPreviewPlayingKey(null);
          } else {
            setAthanPreviewPlayingKey(status.isPlaying ? key : null);
          }
        },
      );
      previewSoundRef.current = sound;
      setAthanPreviewPlayingKey(key);
    } catch (err) {
      setAthanPreviewPlayingKey(null);
      setAthanPreviewError(err instanceof Error ? err.message : "Athan preview failed");
    } finally {
      setAthanPreviewLoadingKey(null);
    }
  };

  const handleNotificationToggle = async (enabled: boolean) => {
    if (!enabled) {
      setNotificationsEnabled(false);
      await cancelAthanNotifications();
      return;
    }

    const granted = await requestNotificationPermission();
    setNotificationPermission(granted ? "granted" : "denied");
    if (!granted) {
      Alert.alert(t("settings.notificationsDisabled"), t("settings.notificationDenied"));
      setNotificationsEnabled(false);
      return;
    }
    setNotificationsEnabled(true);
  };

  const handleSaveCity = async () => {
    if (!city.trim()) {
      Alert.alert(t("settings.cityRequired"), t("settings.enterCityName"));
      return;
    }
    const nextManualCity = {
      city: city.trim(),
      country: country.trim() || DEFAULT_MANUAL_COUNTRY,
    };
    setManualCity(nextManualCity);

    try {
      const geocoded = await Location.geocodeAsync(`${nextManualCity.city}, ${nextManualCity.country}`);
      const first = geocoded[0];
      if (first) {
        setCoordinates({
          latitude: first.latitude,
          longitude: first.longitude,
        });
        Alert.alert(t("settings.saved"), t("settings.savedCityCoords"));
        return;
      }
    } catch {
      // Keep manual city saved even if geocoding fails.
    }

    Alert.alert(t("settings.saved"), t("settings.savedCityOnly"));
  };

  const handleResetCache = async () => {
    await Promise.all([clearPrayerTimesCache(), clearQuranCache(), cancelAthanNotifications()]);
    clearCachedContentState();
    Alert.alert(t("settings.cacheResetTitle"), t("settings.cacheResetBody"));
  };

  const filteredReciters = reciters.filter((r) =>
    `${r.name} ${r.style ?? ""}`.toLowerCase().includes(reciterQuery.trim().toLowerCase()),
  );

  const isArabic = language === "ar";
  const doneLabel = isArabic ? "??" : "Done";
  const enabledPrayerCount = NOTIFICATION_PRAYERS.filter((p) => prayerNotificationPrefs[p] ?? true).length;
  const notificationsSummary = notificationsEnabled
    ? isArabic
      ? `${enabledPrayerCount}/${NOTIFICATION_PRAYERS.length} ???? ?????`
      : `${enabledPrayerCount}/${NOTIFICATION_PRAYERS.length} prayers enabled`
    : t("settings.notificationsDisabled");
  const locationSummary = manualCity
    ? `${manualCity.city}${manualCity.country ? `, ${manualCity.country}` : ""}`
    : isArabic
      ? "?????? (GPS)"
      : "Automatic (GPS)";
  const appearanceSummary = `${themeMode === "system"
    ? t("settings.systemTheme")
    : themeMode === "dark"
      ? t("settings.darkMode")
      : isArabic
        ? "????"
        : "Light"} • ${language === "ar" ? t("settings.langArabic") : t("settings.langEnglish")}`;
  const timeSummary = timeFormat === "24h" ? t("settings.time24") : t("settings.time12");
  const methodSummary = isArabic ? "??????? (?????? ????)" : "Ja'fari (Ithna-Ashari)";
  const modalTitleMap: Record<SettingsSheetKey, string> = {
    appearance: t("settings.appearance"),
    prayer: t("settings.notifications"),
    quranVoice: t("quran.voice"),
    general: t("settings.general"),
    location: t("settings.manualCity"),
    storage: t("settings.storage"),
  };

  const openSheet = (sheet: SettingsSheetKey) => {
    if (sheet === "quranVoice") {
      setShowReciters(true);
    }
    setActiveSheet(sheet);
  };

  const cmsBaseTheme = cmsTargetMode === "dark" ? darkTheme : lightTheme;
  const cmsActiveColor = themeCms[cmsTargetMode][selectedThemeColorKey] ?? cmsBaseTheme.colors[selectedThemeColorKey];

  useEffect(() => {
    setThemeHexInput(cmsActiveColor);
  }, [cmsActiveColor]);

  const applyCmsColor = (hex: string) => {
    const normalized = hex.trim().startsWith("#") ? hex.trim() : `#${hex.trim()}`;
    if (!/^#[0-9a-fA-F]{6}$/.test(normalized)) return;
    setThemeColor(cmsTargetMode, selectedThemeColorKey, normalized.toUpperCase());
  };

  return (
    <>
      <ScreenContainer scroll>
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.colors.text }]}>{t("settings.title")}</Text>
          <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>{t("settings.subtitle")}</Text>
        </View>

        <View style={styles.sectionBlock}>
          <Text style={[styles.groupLabel, { color: theme.colors.textMuted }]}>{t("settings.appearance")}</Text>
          <View style={[styles.groupCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <View style={styles.inlineRowWrap}>
              <View style={styles.row}>
                <View style={styles.rowCopy}>
                  <Text style={[styles.rowTitle, { color: theme.colors.text }]}>{t("settings.darkMode")}</Text>
                  <Text style={[styles.rowSubtitle, { color: theme.colors.textMuted }]}>{t("settings.toggleTheme")}</Text>
                </View>
                <Switch
                  value={themeMode === "dark"}
                  onValueChange={(value) => setThemeMode(value ? "dark" : "light")}
                  thumbColor={theme.mode === "dark" ? theme.colors.primary : undefined}
                  trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                />
              </View>
              <View style={[styles.segmentRow, { marginTop: 10 }]}>
                {(["light", "dark", "system"] as const).map((mode) => {
                  const selected = themeMode === mode;
                  const label =
                    mode === "system"
                      ? t("settings.systemTheme")
                      : mode === "dark"
                        ? t("settings.darkMode")
                        : isArabic
                          ? "فاتح"
                          : "Light";
                  return (
                    <Pressable
                      key={mode}
                      onPress={() => setThemeMode(mode)}
                      style={({ pressed }) => [
                        styles.segmentButton,
                        styles.flexOne,
                        {
                          borderColor: selected ? theme.colors.primary : theme.colors.border,
                          backgroundColor: selected ? theme.colors.backgroundAlt : "transparent",
                          opacity: pressed ? 0.9 : 1,
                        },
                      ]}
                    >
                      <Text style={[styles.segmentText, { color: theme.colors.text }]} numberOfLines={1}>
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <Divider themeBorder={theme.colors.border} style={{ marginLeft: 14 }} />
            <View style={styles.inlineRowWrap}>
              <Text style={[styles.rowTitle, { color: theme.colors.text }]}>{t("settings.language")}</Text>
              <Text style={[styles.rowSubtitle, { color: theme.colors.textMuted }]}>{t("settings.languageDesc")}</Text>
              <View style={[styles.segmentRow, { marginTop: 10 }]}>
                {(["ar", "en"] as const).map((lang) => {
                  const selected = language === lang;
                  return (
                    <Pressable
                      key={lang}
                      onPress={() => setLanguage(lang)}
                      style={({ pressed }) => [
                        styles.segmentButton,
                        styles.flexOne,
                        {
                          borderColor: selected ? theme.colors.primary : theme.colors.border,
                          backgroundColor: selected ? theme.colors.backgroundAlt : "transparent",
                          opacity: pressed ? 0.9 : 1,
                        },
                      ]}
                    >
                      <Text style={[styles.segmentText, { color: theme.colors.text }]}>
                        {lang === "ar" ? t("settings.langArabic") : t("settings.langEnglish")}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <Divider themeBorder={theme.colors.border} style={{ marginLeft: 14 }} />
            <HubRow
              theme={theme}
              icon="palette"
              title={isArabic ? "ألوان التطبيق (CMS)" : "App Colors (CMS)"}
              value={cmsTargetMode === "dark" ? (isArabic ? "تحرير ألوان الداكن" : "Edit dark palette") : (isArabic ? "تحرير ألوان الفاتح" : "Edit light palette")}
              onPress={() => setShowThemeCms(true)}
            />
          </View>
        </View>

        <View style={styles.sectionBlock}>
          <Text style={[styles.groupLabel, { color: theme.colors.textMuted }]}>
            {isArabic ? "??????? ??????" : "Prayer Settings"}
          </Text>
          <View style={[styles.groupCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}> 
            <HubRow
              theme={theme}
              icon="notifications"
              title={t("settings.athanNotifications")}
              value={notificationsSummary}
              onPress={() => openSheet("prayer")}
            />
            <Divider themeBorder={theme.colors.border} />
            <HubRow
              theme={theme}
              icon="location-on"
              title={t("settings.manualCity")}
              value={locationSummary}
              onPress={() => openSheet("location")}
            />
            <Divider themeBorder={theme.colors.border} />
            <HubRow
              theme={theme}
              icon="calculate"
              title={isArabic ? "????? ??????" : "Calculation Method"}
              value={methodSummary}
              onPress={() => openSheet("prayer")}
            />
          </View>
        </View>

        <View style={styles.sectionBlock}>
          <Text style={[styles.groupLabel, { color: theme.colors.textMuted }]}>{t("quran.voice")}</Text>
          <View style={[styles.groupCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}> 
            <HubRow
              theme={theme}
              icon="graphic-eq"
              title={t("quran.voice")}
              value={quranReciterName}
              onPress={() => openSheet("quranVoice")}
            />
          </View>
        </View>

        <View style={styles.sectionBlock}>
          <Text style={[styles.groupLabel, { color: theme.colors.textMuted }]}>{t("settings.general")}</Text>
          <View style={[styles.groupCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}> 
            <View style={styles.inlineRowWrap}>
              <View style={styles.row}>
                <View style={[styles.leadingIcon, { backgroundColor: theme.colors.backgroundAlt }]}>
                  <MaterialIcons name="schedule" size={18} color={theme.colors.primary} />
                </View>
                <View style={styles.rowCopy}>
                  <Text style={[styles.rowTitle, { color: theme.colors.text }]}>
                    {isArabic ? "صيغة 24 ساعة" : "24-Hour Time"}
                  </Text>
                  <Text style={[styles.rowSubtitle, { color: theme.colors.textMuted }]}>
                    {isArabic ? "تفعيل عرض الوقت بنظام 24 ساعة" : "Use 24-hour time format across the app"}
                  </Text>
                </View>
                <Switch
                  value={timeFormat === "24h"}
                  onValueChange={(value) => setTimeFormat(value ? "24h" : "12h")}
                  thumbColor={theme.mode === "dark" ? theme.colors.primary : undefined}
                  trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                />
              </View>
            </View>
          </View>
        </View>

        <View style={styles.sectionBlock}>
          <Text style={[styles.groupLabel, { color: theme.colors.textMuted }]}>{t("settings.storage")}</Text>
          <View style={[styles.groupCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}> 
            <HubRow
              theme={theme}
              icon="delete-sweep"
              title={t("settings.resetCache")}
              value={t("settings.storageDesc")}
              onPress={() => openSheet("storage")}
              danger
            />
          </View>
        </View>
      </ScreenContainer>

      <Modal
        visible={activeSheet !== null}
        animationType="slide"
        presentationStyle={Platform.OS === "ios" ? "pageSheet" : "fullScreen"}
        onRequestClose={() => setActiveSheet(null)}
      >
        <View style={[styles.modalRoot, { backgroundColor: theme.colors.background }]}> 
          <View style={[styles.modalHeader, { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.border }]}> 
            <View style={styles.modalHeaderSide} />
            <Text style={[styles.modalTitle, { color: theme.colors.text }]} numberOfLines={1}>
              {activeSheet ? modalTitleMap[activeSheet] : ""}
            </Text>
            <Pressable
              onPress={() => setActiveSheet(null)}
              style={({ pressed }) => [
                styles.doneButton,
                {
                  borderColor: theme.colors.border,
                  backgroundColor: theme.colors.backgroundAlt,
                  opacity: pressed ? 0.86 : 1,
                },
              ]}
            >
              <Text style={[styles.doneButtonText, { color: theme.colors.primary }]}>{doneLabel}</Text>
            </Pressable>
          </View>

          <ScrollView
            style={styles.modalScroll}
            contentContainerStyle={styles.modalContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {activeSheet === "appearance" ? (
              <>
                <View style={[styles.sheetCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}> 
                  <View style={styles.row}>
                    <View style={styles.rowCopy}>
                      <Text style={[styles.rowTitle, { color: theme.colors.text }]}>{t("settings.darkMode")}</Text>
                      <Text style={[styles.rowSubtitle, { color: theme.colors.textMuted }]}>{t("settings.toggleTheme")}</Text>
                    </View>
                    <Switch
                      value={themeMode === "dark"}
                      onValueChange={(value) => setThemeMode(value ? "dark" : "light")}
                      thumbColor={theme.mode === "dark" ? theme.colors.primary : undefined}
                      trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                    />
                  </View>

                  <Divider themeBorder={theme.colors.border} style={{ marginVertical: 12 }} />

                  <Text style={[styles.sectionMiniTitle, { color: theme.colors.text }]}>{t("settings.systemTheme")}</Text>
                  <View style={styles.segmentWrap}>
                    <Pressable
                      onPress={() => setThemeMode("system")}
                      style={({ pressed }) => [
                        styles.segmentButton,
                        {
                          borderColor: theme.colors.border,
                          backgroundColor: themeMode === "system" ? theme.colors.backgroundAlt : "transparent",
                          opacity: pressed ? 0.9 : 1,
                        },
                      ]}
                    >
                      <Text style={[styles.segmentText, { color: theme.colors.text }]}>{t("settings.systemTheme")}</Text>
                    </Pressable>
                  </View>
                </View>

                <View style={[styles.sheetCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}> 
                  <Text style={[styles.sectionMiniTitle, { color: theme.colors.text, marginTop: 0 }]}>{t("settings.language")}</Text>
                  <Text style={[styles.rowSubtitle, { color: theme.colors.textMuted }]}>{t("settings.languageDesc")}</Text>
                  <View style={[styles.segmentRow, { marginTop: 8 }]}> 
                    {(["ar", "en"] as const).map((lang) => {
                      const selected = language === lang;
                      return (
                        <Pressable
                          key={lang}
                          onPress={() => setLanguage(lang)}
                          style={({ pressed }) => [
                            styles.segmentButton,
                            styles.flexOne,
                            {
                              borderColor: selected ? theme.colors.primary : theme.colors.border,
                              backgroundColor: selected ? theme.colors.backgroundAlt : "transparent",
                              opacity: pressed ? 0.9 : 1,
                            },
                          ]}
                        >
                          <Text style={[styles.segmentText, { color: theme.colors.text }]}> 
                            {lang === "ar" ? t("settings.langArabic") : t("settings.langEnglish")}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              </>
            ) : null}

            {activeSheet === "prayer" ? (
              <>
                <View style={[styles.sheetCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}> 
                  <View style={styles.row}>
                    <View style={styles.rowCopy}>
                      <Text style={[styles.rowTitle, { color: theme.colors.text }]}>{t("settings.athanNotifications")}</Text>
                      <Text style={[styles.rowSubtitle, { color: theme.colors.textMuted }]}>{t("settings.athanPrayerList")}</Text>
                    </View>
                    <Switch
                      value={notificationsEnabled}
                      onValueChange={(value) => void handleNotificationToggle(value)}
                      thumbColor={theme.mode === "dark" ? theme.colors.primary : undefined}
                      trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                    />
                  </View>
                </View>

                <View style={[styles.sheetCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}> 
                  <Text style={[styles.sectionMiniTitle, { color: theme.colors.text, marginTop: 0 }]}>{t("settings.athanPerPrayer")}</Text>
                  <Text style={[styles.rowSubtitle, { color: theme.colors.textMuted }]}>{t("settings.athanPerPrayerDesc")}</Text>
                  <View style={[styles.stackList, { marginTop: 8 }]}> 
                    {NOTIFICATION_PRAYERS.map((prayer) => (
                      <View
                        key={prayer}
                        style={[
                          styles.reciterItem,
                          {
                            borderColor: theme.colors.border,
                            backgroundColor: theme.colors.backgroundAlt,
                            justifyContent: "space-between",
                            marginTop: 0,
                          },
                        ]}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.reciterName, { color: theme.colors.text }]}>{t(`prayer.${prayer}`)}</Text>
                        </View>
                        <Switch
                          value={prayerNotificationPrefs[prayer] ?? true}
                          onValueChange={(value) => setPrayerNotificationEnabled(prayer, value)}
                          thumbColor={theme.mode === "dark" ? theme.colors.primary : undefined}
                          trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                          disabled={!notificationsEnabled}
                        />
                      </View>
                    ))}
                  </View>
                </View>

                <View style={[styles.sheetCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}> 
                  <Text style={[styles.sectionMiniTitle, { color: theme.colors.text, marginTop: 0 }]}>{t("settings.athanSound")}</Text>
                  {athanPreviewError ? (
                    <Text style={[styles.inlineError, { color: theme.colors.danger }]}>
                      {t("quran.previewLabel", { message: athanPreviewError })}
                    </Text>
                  ) : null}
                  <View style={styles.stackList}>
                    {ATHAN_SOUND_OPTIONS.map((option) => {
                      const selected = athanSound === option.key;
                      const previewBusy = athanPreviewLoadingKey === option.key;
                      const previewPlaying = athanPreviewPlayingKey === option.key;
                      const canPreview = option.key !== "default";
                      return (
                        <Pressable
                          key={option.key}
                          onPress={() => setAthanSound(option.key)}
                          style={({ pressed }) => [
                            styles.reciterItem,
                            {
                              borderColor: selected ? theme.colors.primary : theme.colors.border,
                              backgroundColor: selected ? theme.colors.backgroundAlt : "transparent",
                              opacity: pressed ? 0.92 : 1,
                              marginTop: 0,
                            },
                          ]}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.reciterName, { color: theme.colors.text }]}>{option.label}</Text>
                            <Text style={[styles.rowSubtitle, { color: theme.colors.textMuted }]}>
                              {option.filename
                                ? `${isArabic ? "??? ????" : "Custom file"}: ${option.filename}`
                                : isArabic
                                  ? "??? ?????? ?????????"
                                  : "Device default notification sound"}
                            </Text>
                          </View>
                          <Pressable
                            onPress={() => void playAthanPreview(option.key, option.filename, option.previewUrl)}
                            disabled={!canPreview}
                            style={({ pressed }) => [
                              styles.previewButton,
                              {
                                borderColor: !canPreview
                                  ? theme.colors.border
                                  : previewPlaying
                                    ? theme.colors.primary
                                    : theme.colors.border,
                                backgroundColor: previewPlaying ? theme.colors.backgroundAlt : "transparent",
                                opacity: !canPreview ? 0.5 : pressed ? 0.9 : 1,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.previewButtonText,
                                { color: previewPlaying ? theme.colors.primary : theme.colors.text },
                              ]}
                            >
                              {!canPreview ? "N/A" : previewBusy ? "..." : previewPlaying ? t("common.pause") : t("common.play")}
                            </Text>
                          </Pressable>
                          {selected ? <Text style={[styles.selectedTag, { color: theme.colors.primary }]}>{t("common.selected")}</Text> : null}
                        </Pressable>
                      );
                    })}
                  </View>
                  <Text style={[styles.inlineHelper, { color: theme.colors.textMuted }]}>{t("settings.athanPreviewHint")}</Text>
                </View>

                <View style={[styles.sheetCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}> 
                  <Text style={[styles.rowTitle, { color: theme.colors.text }]}>{isArabic ? "????? ??????" : "Calculation Method"}</Text>
                  <Text style={[styles.rowSubtitle, { color: theme.colors.textMuted }]}>{methodSummary}</Text>
                </View>
              </>
            ) : null}

            {activeSheet === "quranVoice" ? (
              <View style={[styles.sheetCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}> 
                <Text style={[styles.rowSubtitle, { color: theme.colors.textMuted }]}>{t("quran.voiceDesc")}</Text>
                <View
                  style={[
                    styles.selectorButton,
                    { borderColor: theme.colors.border, backgroundColor: theme.colors.backgroundAlt },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rowTitle, { color: theme.colors.text }]} numberOfLines={1}>
                      {quranReciterName}
                    </Text>
                    <Text style={[styles.rowSubtitle, { color: theme.colors.textMuted }]}>
                      {t("quran.reciterId", { id: quranReciterId })}
                    </Text>
                  </View>
                  <Text style={[styles.segmentText, { color: theme.colors.primary }]}>{t("common.selected")}</Text>
                </View>

                <View style={styles.recitersWrap}>
                  <TextInput
                    value={reciterQuery}
                    onChangeText={setReciterQuery}
                    placeholder={t("quran.searchReciter")}
                    placeholderTextColor={theme.colors.textMuted}
                    style={[
                      styles.input,
                      {
                        marginTop: 0,
                        borderColor: theme.colors.border,
                        color: theme.colors.text,
                        backgroundColor: theme.colors.backgroundAlt,
                      },
                    ]}
                  />

                  {isRecitersLoading ? (
                    <Text style={[styles.inlineHelper, { color: theme.colors.textMuted }]}>{t("quran.loadingReciters")}</Text>
                  ) : null}

                  {recitersError ? (
                    <Text style={[styles.inlineError, { color: theme.colors.danger }]}>{recitersError}</Text>
                  ) : null}
                  {previewError ? (
                    <Text style={[styles.inlineError, { color: theme.colors.danger }]}>
                      {t("quran.previewLabel", { message: previewError })}
                    </Text>
                  ) : null}

                  <ScrollView style={styles.reciterList} nestedScrollEnabled>
                    {filteredReciters.map((reciter) => {
                      const selected = reciter.id === quranReciterId;
                      const previewBusy = previewLoadingId === reciter.id;
                      const previewPlaying = previewPlayingId === reciter.id;
                      return (
                        <Pressable
                          key={`${reciter.id}`}
                          onPress={() =>
                            setQuranReciter({
                              id: reciter.id,
                              name: reciter.style ? `${reciter.name} (${reciter.style})` : reciter.name,
                            })
                          }
                          style={({ pressed }) => [
                            styles.reciterItem,
                            {
                              borderColor: selected ? theme.colors.primary : theme.colors.border,
                              backgroundColor: selected ? theme.colors.backgroundAlt : "transparent",
                              opacity: pressed ? 0.92 : 1,
                            },
                          ]}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.reciterName, { color: theme.colors.text }]} numberOfLines={1}>
                              {reciter.name}
                            </Text>
                            <Text style={[styles.rowSubtitle, { color: theme.colors.textMuted }]}> 
                              {reciter.style || t("quran.standard")} • ID {reciter.id}
                            </Text>
                          </View>
                          <Pressable
                            onPress={() => void playReciterPreview(reciter)}
                            style={({ pressed }) => [
                              styles.previewButton,
                              {
                                borderColor: previewPlaying ? theme.colors.primary : theme.colors.border,
                                backgroundColor: previewPlaying ? theme.colors.backgroundAlt : "transparent",
                                opacity: pressed ? 0.9 : 1,
                              },
                            ]}
                          >
                            <Text style={[styles.previewButtonText, { color: previewPlaying ? theme.colors.primary : theme.colors.text }]}>
                              {previewBusy ? "..." : previewPlaying ? t("common.pause") : t("common.play")}
                            </Text>
                          </Pressable>
                          {selected ? <Text style={[styles.selectedTag, { color: theme.colors.primary }]}>{t("common.selected")}</Text> : null}
                        </Pressable>
                      );
                    })}
                  </ScrollView>

                  <Text style={[styles.inlineHelper, { color: theme.colors.textMuted }]}>
                    {t("quran.previewFatihahHint")}
                  </Text>
                </View>
              </View>
            ) : null}

            {activeSheet === "general" ? (
              <View style={[styles.sheetCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}> 
                <Text style={[styles.sectionMiniTitle, { color: theme.colors.text, marginTop: 0 }]}>{t("settings.timeFormat")}</Text>
                <View style={styles.segmentRow}>
                  {(["12h", "24h"] as const).map((format) => {
                    const selected = timeFormat === format;
                    return (
                      <Pressable
                        key={format}
                        onPress={() => setTimeFormat(format)}
                        style={({ pressed }) => [
                          styles.segmentButton,
                          styles.flexOne,
                          {
                            borderColor: selected ? theme.colors.primary : theme.colors.border,
                            backgroundColor: selected ? theme.colors.backgroundAlt : "transparent",
                            opacity: pressed ? 0.9 : 1,
                          },
                        ]}
                      >
                        <Text style={[styles.segmentText, { color: theme.colors.text }]}> 
                          {format === "12h" ? t("settings.time12") : t("settings.time24")}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}

            {activeSheet === "location" ? (
              <View style={[styles.sheetCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}> 
                <Text style={[styles.rowSubtitle, { color: theme.colors.textMuted }]}>{t("settings.manualCityDesc")}</Text>
                <TextInput
                  value={city}
                  onChangeText={setCity}
                  placeholder={t("settings.city")}
                  placeholderTextColor={theme.colors.textMuted}
                  style={[
                    styles.input,
                    {
                      borderColor: theme.colors.border,
                      color: theme.colors.text,
                      backgroundColor: theme.colors.backgroundAlt,
                    },
                  ]}
                />
                <TextInput
                  value={country}
                  onChangeText={setCountry}
                  placeholder={t("settings.country")}
                  placeholderTextColor={theme.colors.textMuted}
                  style={[
                    styles.input,
                    {
                      borderColor: theme.colors.border,
                      color: theme.colors.text,
                      backgroundColor: theme.colors.backgroundAlt,
                    },
                  ]}
                />
                <View style={styles.actionsRow}>
                  <Pressable
                    onPress={handleSaveCity}
                    style={({ pressed }) => [
                      styles.primaryButton,
                      { backgroundColor: theme.colors.primary, opacity: pressed ? 0.85 : 1 },
                    ]}
                  >
                    <Text style={styles.primaryButtonText}>{t("settings.saveCity")}</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      setCity("");
                      setCountry(DEFAULT_MANUAL_COUNTRY);
                      setManualCity(null);
                    }}
                    style={({ pressed }) => [
                      styles.secondaryButton,
                      { borderColor: theme.colors.border, opacity: pressed ? 0.85 : 1 },
                    ]}
                  >
                    <Text style={[styles.secondaryButtonText, { color: theme.colors.text }]}>{t("common.clear")}</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}

            {activeSheet === "storage" ? (
              <View style={[styles.sheetCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}> 
                <Text style={[styles.rowSubtitle, { color: theme.colors.textMuted }]}>{t("settings.storageDesc")}</Text>
                <Pressable
                  onPress={() => void handleResetCache()}
                  style={({ pressed }) => [
                    styles.resetButton,
                    { borderColor: theme.colors.danger, opacity: pressed ? 0.85 : 1 },
                  ]}
                >
                  <Text style={[styles.resetButtonText, { color: theme.colors.danger }]}>{t("settings.resetCache")}</Text>
                </Pressable>
              </View>
            ) : null}
          </ScrollView>
        </View>
      </Modal>

      <Modal
        visible={showThemeCms}
        transparent
        animationType="fade"
        onRequestClose={() => setShowThemeCms(false)}
      >
        <View style={styles.cmsBackdrop}>
          <View
            style={[
              styles.cmsSheet,
              {
                backgroundColor: theme.mode === "dark" ? "rgba(42,33,25,0.95)" : "rgba(255,253,247,0.96)",
                borderColor: theme.colors.border,
              },
            ]}
          >
            <View style={styles.cmsHandle} />
            <View style={styles.cmsHeaderRow}>
              <View style={[styles.leadingIcon, { backgroundColor: theme.colors.backgroundAlt }]}>
                <MaterialIcons name="colorize" size={18} color={theme.colors.primary} />
              </View>
              <Text style={[styles.cmsTitle, { color: theme.colors.text }]}>
                {isArabic ? "الألوان" : "Colors"}
              </Text>
              <Pressable onPress={() => setShowThemeCms(false)} style={styles.cmsCloseBtn}>
                <MaterialIcons name="close" size={28} color={theme.colors.text} />
              </Pressable>
            </View>

            <View style={[styles.cmsTabs, { backgroundColor: theme.colors.backgroundAlt }]}>
              {([
                ["grid", isArabic ? "شبكة" : "Grid"],
                ["spectrum", isArabic ? "ألوان" : "Spectrum"],
                ["sliders", isArabic ? "تحكم" : "Sliders"],
              ] as const).map(([key, label]) => {
                const selected = cmsPickerTab === key;
                return (
                  <Pressable
                    key={key}
                    onPress={() => setCmsPickerTab(key)}
                    style={[
                      styles.cmsTabBtn,
                      selected && { backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderWidth: 1 },
                    ]}
                  >
                    <Text style={[styles.cmsTabText, { color: theme.colors.text }]}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.cmsModeRow}>
              {(["light", "dark"] as const).map((mode) => {
                const selected = cmsTargetMode === mode;
                return (
                  <Pressable
                    key={mode}
                    onPress={() => setCmsTargetMode(mode)}
                    style={({ pressed }) => [
                      styles.cmsModeBtn,
                      {
                        borderColor: selected ? theme.colors.primary : theme.colors.border,
                        backgroundColor: selected ? theme.colors.backgroundAlt : "transparent",
                        opacity: pressed ? 0.9 : 1,
                      },
                    ]}
                  >
                    <Text style={[styles.segmentText, { color: theme.colors.text }]}>
                      {mode === "light" ? (isArabic ? "فاتح" : "Light") : (isArabic ? "داكن" : "Dark")}
                    </Text>
                  </Pressable>
                );
              })}
              <Pressable
                onPress={() => resetThemeCms(cmsTargetMode)}
                style={({ pressed }) => [
                  styles.cmsResetBtn,
                  { borderColor: theme.colors.danger, opacity: pressed ? 0.9 : 1 },
                ]}
              >
                <Text style={[styles.previewButtonText, { color: theme.colors.danger }]}>
                  {isArabic ? "إعادة ضبط" : "Reset"}
                </Text>
              </Pressable>
            </View>

            <Pressable
              onPress={async () => {
                if (!isNativeUIColorPickerSupported()) {
                  Alert.alert(
                    isArabic ? "متاح على iOS فقط" : "iOS Only",
                    isArabic
                      ? "هذا الخيار يحتاج iPhone + بناء iOS لاحقاً على Mac."
                      : "This requires an iPhone and an iOS build later on Mac.",
                  );
                  return;
                }
                if (!isNativeUIColorPickerAvailable()) {
                  Alert.alert(
                    isArabic ? "غير جاهز بعد" : "Not Ready Yet",
                    isArabic
                      ? "تم تجهيز الجسر فقط. أضف الموديول iOS على Mac ثم جرّبه."
                      : "The JS bridge is prepared. Add the iOS native module on Mac, then try again.",
                  );
                  return;
                }
                try {
                  const result = await presentNativeUIColorPicker({
                    initialHex: cmsActiveColor,
                    supportsAlpha: false,
                    title: isArabic ? "اختر اللون" : "Pick Color",
                  });
                  applyCmsColor(result.hex);
                } catch (err) {
                  Alert.alert(
                    isArabic ? "خطأ في المنتقي" : "Picker Error",
                    err instanceof Error ? err.message : (isArabic ? "فشل فتح منتقي الألوان" : "Failed to open color picker"),
                  );
                }
              }}
              style={({ pressed }) => [
                styles.cmsNativeBtn,
                {
                  borderColor: theme.colors.border,
                  backgroundColor: theme.colors.backgroundAlt,
                  opacity: pressed ? 0.9 : 1,
                },
              ]}
            >
              <MaterialIcons name="phone-iphone" size={16} color={theme.colors.primary} />
              <Text style={[styles.previewButtonText, { color: theme.colors.text }]}>
                {isArabic ? "جرّب منتقي iOS الأصلي لاحقاً" : "Try Native iOS Picker Later"}
              </Text>
            </Pressable>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cmsTokenRow}>
              {THEME_COLOR_KEYS.map((key) => {
                const selected = selectedThemeColorKey === key;
                const swatch = themeCms[cmsTargetMode][key] ?? (cmsTargetMode === "dark" ? darkTheme.colors[key] : lightTheme.colors[key]);
                return (
                  <Pressable
                    key={key}
                    onPress={() => setSelectedThemeColorKey(key)}
                    style={({ pressed }) => [
                      styles.cmsTokenBtn,
                      {
                        borderColor: selected ? theme.colors.primary : theme.colors.border,
                        backgroundColor: selected ? theme.colors.backgroundAlt : theme.colors.card,
                        opacity: pressed ? 0.9 : 1,
                      },
                    ]}
                  >
                    <View style={[styles.cmsMiniSwatch, { backgroundColor: swatch }]} />
                    <Text style={[styles.cmsTokenText, { color: theme.colors.text }]} numberOfLines={1}>
                      {THEME_COLOR_LABELS[key][isArabic ? "ar" : "en"]}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <View style={[styles.cmsPanel, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}>
              {(cmsPickerTab === "grid" || cmsPickerTab === "spectrum") ? (
                <View style={styles.cmsGrid}>
                  {COLOR_GRID.map((hex) => {
                    const selected = cmsActiveColor.toUpperCase() === hex.toUpperCase();
                    return (
                      <Pressable
                        key={hex}
                        onPress={() => applyCmsColor(hex)}
                        style={[
                          styles.cmsGridCell,
                          { backgroundColor: hex, borderColor: selected ? "#FFFFFF" : "transparent" },
                        ]}
                      />
                    );
                  })}
                </View>
              ) : (
                <View style={styles.cmsSliderPane}>
                  <Text style={[styles.rowSubtitle, { color: theme.colors.textMuted }]}>
                    {isArabic ? "أدخل لون HEX مثل #B08968" : "Enter HEX color like #B08968"}
                  </Text>
                  <TextInput
                    value={themeHexInput}
                    onChangeText={setThemeHexInput}
                    placeholder="#B08968"
                    autoCapitalize="characters"
                    placeholderTextColor={theme.colors.textMuted}
                    style={[
                      styles.input,
                      {
                        marginTop: 8,
                        borderColor: theme.colors.border,
                        backgroundColor: theme.colors.backgroundAlt,
                        color: theme.colors.text,
                      },
                    ]}
                  />
                  <View style={styles.actionsRow}>
                    <Pressable
                      onPress={() => applyCmsColor(themeHexInput)}
                      style={({ pressed }) => [
                        styles.primaryButton,
                        { backgroundColor: theme.colors.primary, opacity: pressed ? 0.85 : 1 },
                      ]}
                    >
                      <Text style={styles.primaryButtonText}>{isArabic ? "تطبيق" : "Apply"}</Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </View>

            <View style={styles.cmsFooterRow}>
              <View style={[styles.cmsBigSwatch, { backgroundColor: cmsActiveColor, borderColor: theme.colors.border }]} />
              <View style={styles.cmsFooterMeta}>
                <Text style={[styles.rowTitle, { color: theme.colors.text }]}>
                  {THEME_COLOR_LABELS[selectedThemeColorKey][isArabic ? "ar" : "en"]}
                </Text>
                <Text style={[styles.rowSubtitle, { color: theme.colors.textMuted }]}>{cmsActiveColor.toUpperCase()}</Text>
              </View>
              <Pressable
                onPress={() => {
                  resetThemeCms(cmsTargetMode);
                  setShowThemeCms(false);
                }}
                style={({ pressed }) => [
                  styles.cmsResetBtn,
                  { borderColor: theme.colors.border, opacity: pressed ? 0.9 : 1 },
                ]}
              >
                <Text style={[styles.previewButtonText, { color: theme.colors.text }]}>
                  {isArabic ? "إغلاق" : "Close"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  header: { gap: 6 },
  title: { fontSize: 28, fontWeight: "800" },
  subtitle: { fontSize: 13, lineHeight: 18 },
  sectionBlock: { gap: 8, marginTop: 2 },
  groupLabel: {
    fontSize: 12,
    fontWeight: "700",
    marginLeft: 4,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  groupCard: { borderWidth: 1, borderRadius: 16, overflow: "hidden" },
  inlineRowWrap: { paddingHorizontal: 14, paddingVertical: 12 },
  listRow: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  leadingIcon: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  listRowCopy: { flex: 1, gap: 2 },
  listRowTitle: { fontSize: 15, fontWeight: "600" },
  listRowValue: { fontSize: 12, lineHeight: 16 },
  rowDivider: { height: StyleSheet.hairlineWidth, marginLeft: 60 },
  cmsBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.38)",
    justifyContent: "flex-end",
    padding: 12,
  },
  cmsSheet: {
    borderWidth: 1,
    borderRadius: 28,
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 14,
    maxHeight: "86%",
  },
  cmsHandle: {
    alignSelf: "center",
    width: 54,
    height: 6,
    borderRadius: 999,
    backgroundColor: "rgba(128,128,128,0.45)",
    marginBottom: 10,
  },
  cmsHeaderRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 },
  cmsTitle: { flex: 1, textAlign: "center", fontSize: 18, fontWeight: "800", marginRight: 30 },
  cmsCloseBtn: { width: 30, height: 30, alignItems: "center", justifyContent: "center" },
  cmsTabs: {
    flexDirection: "row",
    borderRadius: 16,
    padding: 4,
    gap: 4,
  },
  cmsTabBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  cmsTabText: { fontSize: 13, fontWeight: "700" },
  cmsModeRow: { flexDirection: "row", gap: 8, marginTop: 10, alignItems: "center" },
  cmsModeBtn: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  cmsResetBtn: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  cmsNativeBtn: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    justifyContent: "center",
  },
  cmsTokenRow: { gap: 8, paddingVertical: 10, paddingRight: 4 },
  cmsTokenBtn: {
    minWidth: 102,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 8,
    alignItems: "center",
    gap: 6,
  },
  cmsMiniSwatch: { width: 22, height: 22, borderRadius: 999, borderWidth: 1, borderColor: "rgba(0,0,0,0.12)" },
  cmsTokenText: { fontSize: 11, fontWeight: "600" },
  cmsPanel: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 10,
    marginTop: 2,
  },
  cmsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 0,
    overflow: "hidden",
    borderRadius: 14,
  },
  cmsGridCell: {
    width: "16.6667%",
    aspectRatio: 1,
    borderWidth: 2,
  },
  cmsSliderPane: { gap: 4 },
  cmsFooterRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 12 },
  cmsBigSwatch: { width: 64, height: 64, borderRadius: 16, borderWidth: 1 },
  cmsFooterMeta: { flex: 1 },
  modalRoot: { flex: 1 },
  modalHeader: {
    minHeight: 58,
    borderBottomWidth: 1,
    paddingHorizontal: 14,
    paddingTop: Platform.OS === "ios" ? 8 : 10,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  modalHeaderSide: { width: 64 },
  modalTitle: { flex: 1, fontSize: 17, fontWeight: "700", textAlign: "center" },
  doneButton: {
    minWidth: 64,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  doneButtonText: { fontSize: 14, fontWeight: "700" },
  modalScroll: { flex: 1 },
  modalContent: { padding: 16, gap: 12, paddingBottom: 28 },
  sheetCard: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 8 },
  sectionMiniTitle: { fontSize: 14, fontWeight: "700", marginTop: 12, marginBottom: 8 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  rowCopy: { flex: 1 },
  rowTitle: { fontSize: 15, fontWeight: "600" },
  rowSubtitle: { fontSize: 12, lineHeight: 18 },
  segmentWrap: { marginTop: 4 },
  segmentRow: { flexDirection: "row", gap: 10 },
  segmentButton: { borderWidth: 1, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, alignItems: "center" },
  selectorButton: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  recitersWrap: { marginTop: 10, gap: 8 },
  stackList: { gap: 8 },
  reciterList: { maxHeight: 340 },
  reciterItem: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 8,
  },
  previewButton: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 8,
  },
  previewButtonText: { fontSize: 12, fontWeight: "700" },
  reciterName: { fontSize: 14, fontWeight: "600" },
  selectedTag: { fontSize: 12, fontWeight: "700" },
  inlineHelper: { fontSize: 12, marginTop: 8 },
  inlineError: { fontSize: 12, fontWeight: "600", marginBottom: 4 },
  flexOne: { flex: 1 },
  segmentText: { fontSize: 13, fontWeight: "600" },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 10,
  },
  actionsRow: { marginTop: 12, flexDirection: "row", gap: 10 },
  primaryButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  primaryButtonText: { color: "#fff", fontWeight: "700" },
  secondaryButton: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: { fontWeight: "600" },
  resetButton: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  resetButtonText: { fontWeight: "700" },
});

