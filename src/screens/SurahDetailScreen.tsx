import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type ViewToken,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import {
  Audio,
  InterruptionModeAndroid,
  InterruptionModeIOS,
  type AVPlaybackStatus,
  type AVPlaybackStatusSuccess,
} from "expo-av";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { fetchSurahAudioTrack, fetchSurahDetail } from "../api/quranApi";
import { EmptyState } from "../components/EmptyState";
import { LoadingState } from "../components/LoadingState";
import { useI18n } from "../hooks/useI18n";
import { useAppTheme } from "../hooks/useAppTheme";
import { useAppStore } from "../store/appStore";
import type { AyahLine, SurahAudioTrack, SurahDetail } from "../types/quran";

interface SurahDetailScreenProps {
  surahNumber?: number;
  initialAyahNumber?: number;
}

const READER_THEME = {
  light: {
    bg: "#f4efe6",
    headerBg: "rgba(244,239,230,0.95)",
    border: "#d8cfbf",
    rowBorder: "#f3f4f6",
    text: "#2a2118",
    textMuted: "#776a58",
    textAccentMuted: "#b79f82",
    primary: "#B08968",
    primaryDark: "#2F241A",
    accentBg: "rgba(176,137,104,0.08)",
  },
  dark: {
    bg: "#1A1511",
    headerBg: "rgba(26,21,17,0.95)",
    border: "rgba(255,255,255,0.06)",
    rowBorder: "rgba(255,255,255,0.05)",
    text: "#ffffff",
    textMuted: "#cbd5e1",
    textAccentMuted: "#C7AF8A",
    primary: "#D0B089",
    primaryDark: "#2F241A",
    accentBg: "rgba(176,137,104,0.10)",
  },
} as const;

const formatMs = (ms: number): string => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${`${seconds}`.padStart(2, "0")}`;
};

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const AUDIO_TIMING_CACHE_PREFIX = "shia-athan-quran/audio-timings";

const buildAyahStartFractions = (ayahs: AyahLine[], introWeight = 0): number[] => {
  if (!ayahs.length) return [];
  const weights = ayahs.map((ayah) => {
    const arabicWeight = ayah.arabicText.replace(/\s+/g, "").length;
    const translationWeight = Math.ceil((ayah.translationText?.length ?? 0) * 0.18);
    return Math.max(8, arabicWeight + translationWeight);
  });
  const total = weights.reduce((sum, w) => sum + w, 0) + Math.max(0, introWeight) || 1;
  let running = Math.max(0, introWeight);
  return weights.map((weight) => {
    const start = running / total;
    running += weight;
    return start;
  });
};

const buildAyahStartFractionsFromDurations = (
  ayahDurationsMs: number[],
  fullDurationMs: number,
): number[] => {
  if (!ayahDurationsMs.length) return [];
  const sumAyah = ayahDurationsMs.reduce((a, b) => a + Math.max(1, b), 0);
  if (sumAyah <= 0) return [];

  const extra = Math.max(0, fullDurationMs - sumAyah);
  // Reserve a bounded intro segment (Ta'awwudh/Bismillah), spread the remaining extra across ayahs.
  const introMs = Math.min(extra, 18000);
  const distributableExtra = Math.max(0, extra - introMs);

  const adjustedDurations = ayahDurationsMs.map((d) => {
    const base = Math.max(1, d);
    return base + (base / sumAyah) * distributableExtra;
  });

  const adjustedTotal = introMs + adjustedDurations.reduce((a, b) => a + b, 0);
  let running = introMs;
  return adjustedDurations.map((duration) => {
    const start = running / adjustedTotal;
    running += duration;
    return start;
  });
};

const findCurrentAyahIndexByProgress = (startFractions: number[], progress: number): number => {
  if (!startFractions.length) return 0;
  const p = clamp(progress);
  // Use midpoint thresholds between ayahs so the highlight changes later and doesn't jump early.
  for (let i = startFractions.length - 1; i >= 0; i -= 1) {
    if (i === startFractions.length - 1) {
      if (p >= startFractions[i]) return i;
      continue;
    }
    const nextStart = startFractions[i + 1];
    const switchThreshold = startFractions[i] + (nextStart - startFractions[i]) * 0.6;
    if (p >= switchThreshold) return i + 1;
    if (p >= startFractions[i]) return i;
  }
  return 0;
};

const findCurrentAyahIndexByTimestamps = (
  verseTimestamps: NonNullable<SurahAudioTrack["verseTimestamps"]>,
  positionMs: number,
): number => {
  if (!verseTimestamps.length) return 0;
  const p = Math.max(0, positionMs);
  for (let i = verseTimestamps.length - 1; i >= 0; i -= 1) {
    const current = verseTimestamps[i];
    const next = verseTimestamps[i + 1];
    if (!next) {
      if (p >= current.timestampFrom) return i;
      continue;
    }
    const switchAt = current.timestampFrom + (next.timestampFrom - current.timestampFrom) * 0.6;
    if (p >= switchAt) return i + 1;
    if (p >= current.timestampFrom) return i;
  }
  return 0;
};

export const SurahDetailScreen = (props: SurahDetailScreenProps) => {
  const params = useLocalSearchParams<{ surahNumber?: string; initialAyahNumber?: string }>();
  const routeSurahNumber = props.surahNumber ?? Number.parseInt(`${params.surahNumber ?? "0"}`, 10);
  const routeInitialAyah =
    props.initialAyahNumber ??
    (params.initialAyahNumber ? Number.parseInt(`${params.initialAyahNumber}`, 10) : undefined);

  const theme = useAppTheme();
  const { t } = useI18n();
  const palette = theme.mode === "dark" ? READER_THEME.dark : READER_THEME.light;
  const bookmarks = useAppStore((s) => s.bookmarks);
  const lastRead = useAppStore((s) => s.lastRead);
  const quranReciterId = useAppStore((s) => s.quranReciterId);
  const toggleBookmark = useAppStore((s) => s.toggleBookmark);
  const setLastRead = useAppStore((s) => s.setLastRead);

  const [surahDetail, setSurahDetail] = useState<SurahDetail | null>(null);
  const [audioTrack, setAudioTrack] = useState<SurahAudioTrack | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [ayahDurationProfileMs, setAyahDurationProfileMs] = useState<number[] | null>(null);
  const [isTimingProfileLoading, setIsTimingProfileLoading] = useState(false);

  const flatListRef = useRef<FlatList<AyahLine>>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const timelineWidthRef = useRef(0);
  const currentAyahIndexRef = useRef(0);

  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [currentAudioIndex, setCurrentAudioIndex] = useState(0);
  const [positionMillis, setPositionMillis] = useState(0);
  const [durationMillis, setDurationMillis] = useState(0);

  const firstAyahHasBismillah = useMemo(() => {
    const first = surahDetail?.ayahs?.[0]?.arabicText ?? "";
    const compact = first.replace(/\s+/g, "");
    return compact.includes("بسم") || compact.includes("ٱلل");
  }, [surahDetail?.ayahs]);

  const hasStandaloneBismillahIntro = useMemo(
    () => routeSurahNumber !== 9 && !!surahDetail?.ayahs?.length && !firstAyahHasBismillah,
    [firstAyahHasBismillah, routeSurahNumber, surahDetail?.ayahs],
  );

  const heuristicAyahStartFractions = useMemo(() => {
    // Full-surah recitations often begin with Ta'awwudh (A'udhu billahi...) which is not part of ayah text.
    // Some surahs also have a separately-recited Bismillah before ayah 1 text starts.
    const taawwudhIntroWeight = 20;
    const bismillahIntroWeight = hasStandaloneBismillahIntro ? 34 : 0;
    const introWeight = taawwudhIntroWeight + bismillahIntroWeight;
    return buildAyahStartFractions(surahDetail?.ayahs ?? [], introWeight);
  }, [hasStandaloneBismillahIntro, surahDetail?.ayahs]);

  const ayahStartFractions = useMemo(() => {
    if (audioTrack?.verseTimestamps?.length) {
      const fallbackDuration = audioTrack.verseTimestamps[audioTrack.verseTimestamps.length - 1]?.timestampTo ?? 1;
      const total = Math.max(durationMillis || 0, fallbackDuration, 1);
      return audioTrack.verseTimestamps.map((t) => clamp(t.timestampFrom / total));
    }
    if (ayahDurationProfileMs?.length && durationMillis > 0) {
      return buildAyahStartFractionsFromDurations(ayahDurationProfileMs, durationMillis);
    }
    return heuristicAyahStartFractions;
  }, [audioTrack?.verseTimestamps, ayahDurationProfileMs, durationMillis, heuristicAyahStartFractions]);

  const streamProgress = useMemo(
    () => (durationMillis > 0 ? clamp(positionMillis / durationMillis) : 0),
    [durationMillis, positionMillis],
  );

  useEffect(() => {
    if (audioTrack?.verseTimestamps?.length) {
      const index = findCurrentAyahIndexByTimestamps(audioTrack.verseTimestamps, positionMillis);
      currentAyahIndexRef.current = index;
      setCurrentAudioIndex(index);
      return;
    }
    const index = findCurrentAyahIndexByProgress(ayahStartFractions, streamProgress);
    currentAyahIndexRef.current = index;
    setCurrentAudioIndex(index);
  }, [audioTrack?.verseTimestamps, ayahStartFractions, positionMillis, streamProgress]);

  useEffect(() => {
    let cancelled = false;

    const loadTimingProfile = async () => {
      if (audioTrack?.verseTimestamps?.length || !audioTrack?.ayahAudioUrls?.length) {
        setAyahDurationProfileMs(null);
        setIsTimingProfileLoading(false);
        return;
      }

      const cacheKey = `${AUDIO_TIMING_CACHE_PREFIX}:${routeSurahNumber}:alafasy`;
      setIsTimingProfileLoading(true);
      try {
        const cachedRaw = await AsyncStorage.getItem(cacheKey);
        if (cachedRaw) {
          const cached = JSON.parse(cachedRaw) as number[];
          if (Array.isArray(cached) && cached.length === audioTrack.ayahAudioUrls.length) {
            if (!cancelled) {
              setAyahDurationProfileMs(cached);
              setIsTimingProfileLoading(false);
            }
            return;
          }
        }

        const durations: number[] = [];
        for (const uri of audioTrack.ayahAudioUrls) {
          if (cancelled) return;
          let sound: Audio.Sound | null = null;
          try {
            const created = await Audio.Sound.createAsync(
              { uri },
              { shouldPlay: false, progressUpdateIntervalMillis: 50 },
            );
            sound = created.sound;
            const status = await sound.getStatusAsync();
            durations.push(status.isLoaded ? status.durationMillis ?? 0 : 0);
          } catch {
            durations.push(0);
          } finally {
            if (sound) {
              try {
                await sound.unloadAsync();
              } catch {
                // no-op
              }
            }
          }
        }

        if (cancelled) return;
        setAyahDurationProfileMs(durations);
        await AsyncStorage.setItem(cacheKey, JSON.stringify(durations));
      } finally {
        if (!cancelled) {
          setIsTimingProfileLoading(false);
        }
      }
    };

    void loadTimingProfile();
    return () => {
      cancelled = true;
    };
  }, [audioTrack?.ayahAudioUrls, audioTrack?.verseTimestamps, routeSurahNumber]);

  const configureAudioMode = useCallback(async () => {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
      interruptionModeIOS: InterruptionModeIOS.DoNotMix,
      shouldDuckAndroid: true,
    });
  }, []);

  const unloadSound = useCallback(async () => {
    const sound = soundRef.current;
    if (!sound) return;
    soundRef.current = null;
    try {
      await sound.unloadAsync();
    } catch {
      // Ignore cleanup errors.
    }
  }, []);

  const ensureFullSurahSound = useCallback(
    async (opts?: { shouldPlay?: boolean; startMillis?: number }) => {
      if (!audioTrack?.fullSurahUrl) {
        throw new Error("Full surah stream is unavailable for this reciter.");
      }

      const shouldPlay = opts?.shouldPlay;
      const hasStartMillis = typeof opts?.startMillis === "number";
      const startMillis = Math.max(0, opts?.startMillis ?? 0);

      await configureAudioMode();

      if (soundRef.current) {
        const existingStatus = await soundRef.current.getStatusAsync();
        if (existingStatus.isLoaded) {
          if (hasStartMillis) {
            await soundRef.current.setPositionAsync(startMillis);
            setPositionMillis(startMillis);
          }
          if (shouldPlay === true) {
            await soundRef.current.playAsync();
          } else if (shouldPlay === false) {
            await soundRef.current.pauseAsync();
          }
          return soundRef.current;
        }
      }

      await unloadSound();

      const onStatusUpdate = (status: AVPlaybackStatus) => {
        if (!status.isLoaded) return;
        const loaded = status as AVPlaybackStatusSuccess;
        setIsAudioPlaying(loaded.isPlaying);
        setPositionMillis(loaded.positionMillis ?? 0);
        setDurationMillis(loaded.durationMillis ?? 0);

        if (loaded.didJustFinish && !loaded.isLooping) {
          setIsAudioPlaying(false);
          setPositionMillis(loaded.durationMillis ?? 0);
        }
      };

      const { sound, status } = await Audio.Sound.createAsync(
        { uri: audioTrack.fullSurahUrl },
        {
          shouldPlay: shouldPlay ?? false,
          positionMillis: startMillis,
          progressUpdateIntervalMillis: 250,
        },
        onStatusUpdate,
      );
      soundRef.current = sound;

      if (status.isLoaded) {
        setPositionMillis(status.positionMillis ?? 0);
        setDurationMillis(status.durationMillis ?? 0);
        setIsAudioPlaying(status.isPlaying);
        if ((status.durationMillis ?? 0) > 0 && (status.positionMillis ?? 0) > 0) {
          const idx = audioTrack.verseTimestamps?.length
            ? findCurrentAyahIndexByTimestamps(audioTrack.verseTimestamps, status.positionMillis ?? 0)
            : findCurrentAyahIndexByProgress(
                ayahStartFractions,
                (status.positionMillis ?? 0) / Math.max(1, status.durationMillis ?? 1),
              );
          currentAyahIndexRef.current = idx;
          setCurrentAudioIndex(idx);
        }
      }

      return sound;
    },
    [audioTrack?.fullSurahUrl, audioTrack?.verseTimestamps, ayahStartFractions, configureAudioMode, unloadSound],
  );

  const seekToProgress = useCallback(
    async (progress: number, shouldPlay = true) => {
      const bounded = clamp(progress);
      setAudioError(null);
      setIsAudioLoading(true);
      try {
        const approxDuration = durationMillis > 0 ? durationMillis : 0;
        const targetMillis = approxDuration > 0 ? Math.floor(approxDuration * bounded) : 0;
        const sound = await ensureFullSurahSound({ shouldPlay, startMillis: targetMillis });

        if (targetMillis === 0 && durationMillis <= 0) {
          const freshStatus = await sound.getStatusAsync();
          if (freshStatus.isLoaded && freshStatus.durationMillis) {
            const resolvedTarget = Math.floor(freshStatus.durationMillis * bounded);
            await sound.setPositionAsync(resolvedTarget);
            if (shouldPlay) await sound.playAsync();
            setPositionMillis(resolvedTarget);
            setDurationMillis(freshStatus.durationMillis);
          }
        }
      } catch (err) {
        setAudioError(err instanceof Error ? err.message : "Unable to seek audio");
      } finally {
        setIsAudioLoading(false);
      }
    },
    [durationMillis, ensureFullSurahSound],
  );

  const togglePlayback = useCallback(async () => {
    if (!audioTrack?.fullSurahUrl) return;
    setAudioError(null);
    setIsAudioLoading(true);
    try {
      const sound = await ensureFullSurahSound();
      const status = await sound.getStatusAsync();
      if (!status.isLoaded) {
        await ensureFullSurahSound({ shouldPlay: true });
      } else if (status.isPlaying) {
        await sound.pauseAsync();
        setIsAudioPlaying(false);
      } else {
        await sound.playAsync();
        setIsAudioPlaying(true);
      }
    } catch (err) {
      setAudioError(err instanceof Error ? err.message : "Audio action failed");
    } finally {
      setIsAudioLoading(false);
    }
  }, [audioTrack?.fullSurahUrl, ensureFullSurahSound]);

  const playFromAyahNumber = useCallback(
    async (ayahNumberInSurah: number) => {
      if (!surahDetail?.ayahs.length) return;
      const index = surahDetail.ayahs.findIndex((a) => a.numberInSurah === ayahNumberInSurah);
      if (index < 0) return;
      const exactStartMs = audioTrack?.verseTimestamps?.[index]?.timestampFrom;
      if (typeof exactStartMs === "number") {
        setAudioError(null);
        setIsAudioLoading(true);
        try {
          await ensureFullSurahSound({ shouldPlay: true, startMillis: exactStartMs });
          currentAyahIndexRef.current = index;
          setCurrentAudioIndex(index);
        } catch (err) {
          setAudioError(err instanceof Error ? err.message : "Unable to jump to ayah");
        } finally {
          setIsAudioLoading(false);
        }
        return;
      }
      const startFraction = ayahStartFractions[index] ?? 0;
      await seekToProgress(startFraction, true);
    },
    [audioTrack?.verseTimestamps, ayahStartFractions, ensureFullSurahSound, seekToProgress, surahDetail?.ayahs],
  );

  const onTimelineLayout = (event: LayoutChangeEvent) => {
    timelineWidthRef.current = event.nativeEvent.layout.width;
  };

  const onTimelinePress = async (x: number) => {
    const width = timelineWidthRef.current;
    if (!width) return;
    await seekToProgress(x / width, true);
  };

  useEffect(() => {
    if (!Number.isFinite(routeSurahNumber) || routeSurahNumber <= 0) {
      setError("Invalid surah number");
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    const load = async () => {
      setIsLoading(true);
      setError(null);
      setAudioError(null);
      try {
        const [detail, audio] = await Promise.all([
          fetchSurahDetail(routeSurahNumber),
          fetchSurahAudioTrack(routeSurahNumber, quranReciterId),
        ]);
        if (!isMounted) return;
        setSurahDetail(detail);
        setAudioTrack(audio);
        setPositionMillis(0);
        setDurationMillis(0);
        setAyahDurationProfileMs(null);
        const initialIndex = routeInitialAyah
          ? Math.max(0, detail.ayahs.findIndex((a) => a.numberInSurah === routeInitialAyah))
          : 0;
        currentAyahIndexRef.current = initialIndex;
        setCurrentAudioIndex(initialIndex);
        await unloadSound();
      } catch (err) {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : "Failed to load surah");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    void load();
    return () => {
      isMounted = false;
    };
  }, [quranReciterId, routeInitialAyah, routeSurahNumber, unloadSound]);

  useEffect(() => {
    return () => {
      void unloadSound();
    };
  }, [unloadSound]);

  const scrollToAyah = useCallback(
    (ayahNumber?: number) => {
      if (!surahDetail || !ayahNumber) return;
      const index = surahDetail.ayahs.findIndex((a) => a.numberInSurah === ayahNumber);
      if (index < 0) return;
      flatListRef.current?.scrollToIndex({ animated: true, index, viewPosition: 0.15 });
    },
    [surahDetail],
  );

  useEffect(() => {
    if (!surahDetail || !routeInitialAyah) return;
    const timeout = setTimeout(() => scrollToAyah(routeInitialAyah), 350);
    return () => clearTimeout(timeout);
  }, [routeInitialAyah, scrollToAyah, surahDetail]);

  const bookmarkedIds = useMemo(
    () => new Set(bookmarks.map((b) => `${b.surahNumber}:${b.ayahNumber}`)),
    [bookmarks],
  );

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: Array<ViewToken<AyahLine>> }) => {
      const firstVisible = viewableItems.find((item) => item.isViewable && item.item);
      if (!firstVisible?.item || !surahDetail) return;
      setLastRead({
        surahNumber: routeSurahNumber,
        surahName: surahDetail.surah.englishName,
        ayahNumber: firstVisible.item.numberInSurah,
        updatedAt: Date.now(),
      });
    },
  ).current;
  const viewabilityConfig = useMemo(() => ({ itemVisiblePercentThreshold: 50 }), []);

  const handleShareAyah = async (ayah: AyahLine) => {
    try {
      await Share.share({
        message: `${surahDetail?.surah.englishName ?? "Surah"} - Ayah ${ayah.numberInSurah}\n\n${ayah.arabicText}\n\n${ayah.translationText}`,
      });
    } catch {
      // Ignore share cancellation.
    }
  };

  const bismillahVisible = hasStandaloneBismillahIntro;
  const resumeAyahForThisSurah =
    lastRead?.surahNumber === routeSurahNumber ? lastRead.ayahNumber : routeInitialAyah;
  const currentPlayingAyah = surahDetail?.ayahs[currentAudioIndex]?.numberInSurah;

  const renderAyah = ({ item }: { item: AyahLine }) => {
    const bookmarkId = `${routeSurahNumber}:${item.numberInSurah}`;
    const isBookmarked = bookmarkedIds.has(bookmarkId);
    const isPlayingAyah = currentPlayingAyah === item.numberInSurah && isAudioPlaying;
    const isSelectedAyah = currentPlayingAyah === item.numberInSurah || routeInitialAyah === item.numberInSurah;
    const isHighlighted = isSelectedAyah || resumeAyahForThisSurah === item.numberInSurah;

    return (
      <View
        style={[
          styles.ayahRow,
          {
            borderBottomColor: palette.rowBorder,
            backgroundColor: isHighlighted ? palette.accentBg : "transparent",
            borderLeftColor: isHighlighted ? palette.primary : "transparent",
          },
          isHighlighted && styles.ayahRowActive,
        ]}
      >
        <View style={styles.ayahActions}>
          <Pressable
            onPress={() =>
              toggleBookmark({
                surahNumber: routeSurahNumber,
                surahName: surahDetail?.surah.englishName ?? "",
                ayahNumber: item.numberInSurah,
                ayahArabic: item.arabicText,
                ayahTranslation: item.translationText,
              })
            }
            style={styles.actionButton}
          >
            <MaterialIcons
              name={isBookmarked ? "bookmark" : "bookmark-border"}
              size={20}
              color={isBookmarked ? palette.primary : palette.textAccentMuted}
            />
          </Pressable>

          <Pressable onPress={() => void handleShareAyah(item)} style={styles.actionButton}>
            <MaterialIcons name="share" size={20} color={palette.textAccentMuted} />
          </Pressable>

          <Pressable onPress={() => void playFromAyahNumber(item.numberInSurah)} style={styles.actionButton}>
            <MaterialIcons
              name={isPlayingAyah ? "pause-circle-outline" : "play-circle-outline"}
              size={20}
              color={isPlayingAyah ? palette.primary : palette.textAccentMuted}
            />
          </Pressable>
        </View>

        <View style={styles.ayahBody}>
          <Text style={[styles.arabicText, { color: palette.text }]}>
            {item.arabicText}
            <Text style={[styles.ayahNumberInline, { borderColor: "rgba(176,137,104,0.4)", color: palette.primary }]}>
              {" "}
              {item.numberInSurah}{" "}
            </Text>
          </Text>
          <Text style={[styles.translationText, { color: theme.mode === "dark" ? "#94a3b8" : "#6b7280" }]}>
            {item.translationText}
          </Text>
        </View>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: palette.bg }]}>
        <LoadingState label={t("quran.loadingSurah")} />
      </View>
    );
  }

  if (error || !surahDetail) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: palette.bg }]}>
        <EmptyState title={t("quran.unableToLoadSurah")} subtitle={error ?? t("quran.unknownError")} />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.bg }]} edges={["top"]}>
      <View style={[styles.header, { backgroundColor: palette.headerBg, borderBottomColor: palette.border }]}>
        <View style={styles.headerTopRow}>
          <Pressable onPress={() => router.back()} style={styles.headerIcon}>
            <MaterialIcons name="arrow-back" size={28} color={palette.text} />
          </Pressable>

          <View style={styles.headerTitleWrap}>
            <Text style={[styles.headerTitle, { color: palette.text }]} numberOfLines={1}>
              {t("quran.surahPrefix", { name: surahDetail.surah.englishName })}
            </Text>
            <Text
              style={[
                styles.headerSubtitle,
                { color: theme.mode === "dark" ? palette.textAccentMuted : palette.textMuted },
              ]}
              numberOfLines={1}
            >
              {surahDetail.surah.englishNameTranslation} • {surahDetail.surah.revelationType} • {t("quran.versesCount", { n: surahDetail.surah.numberOfAyahs })}
            </Text>
          </View>

          <Pressable style={styles.headerIcon}>
            <MaterialIcons name="more-vert" size={26} color={palette.text} />
          </Pressable>
        </View>

        <View style={styles.audioRow}>
          <Pressable
            onPress={() => void togglePlayback()}
            disabled={!audioTrack?.fullSurahUrl || isAudioLoading}
            style={({ pressed }) => [
              styles.audioPlayButtonWrap,
              { opacity: pressed ? 0.9 : 1 },
              (!audioTrack?.fullSurahUrl || isAudioLoading) && styles.dimmed,
            ]}
          >
            <MaterialIcons
              name={isAudioLoading ? "hourglass-empty" : isAudioPlaying ? "pause" : "play-arrow"}
              size={24}
              color={palette.primaryDark}
            />
          </Pressable>

          <View style={styles.audioBarWrap}>
            <Pressable
              onLayout={onTimelineLayout}
              onPress={(e) => void onTimelinePress(e.nativeEvent.locationX)}
              style={[
                styles.audioBarTrack,
                { backgroundColor: theme.mode === "dark" ? "rgba(255,255,255,0.10)" : "#e5e7eb" },
              ]}
            >
              <View
                style={[
                  styles.audioBarFill,
                  {
                    backgroundColor: palette.primary,
                    width: `${streamProgress * 100}%`,
                  },
                ]}
              />
            </Pressable>
            <View style={styles.audioTimeRow}>
              <Text style={[styles.audioTimeText, { color: theme.mode === "dark" ? palette.textAccentMuted : palette.textMuted }]}>
                {formatMs(positionMillis)}
              </Text>
              <Text style={[styles.audioTimeText, { color: theme.mode === "dark" ? palette.textAccentMuted : palette.textMuted }]}>
                {durationMillis > 0 ? formatMs(durationMillis) : "--:--"} • {t("quran.ayahLabel", { n: currentPlayingAyah ?? 1 })}/{surahDetail.ayahs.length}
              </Text>
            </View>
          </View>

          <Pressable onPress={() => scrollToAyah(currentPlayingAyah)} style={styles.audioSettingsButton}>
            <MaterialIcons
              name="my-location"
              size={20}
              color={theme.mode === "dark" ? palette.textAccentMuted : palette.textMuted}
            />
          </Pressable>
        </View>

        {audioError ? <Text style={styles.audioErrorText}>{audioError}</Text> : null}
        {isTimingProfileLoading ? (
          <Text style={styles.audioTimingHint}>{t("quran.syncingAyahTiming")}</Text>
        ) : null}
      </View>

      <FlatList
        ref={flatListRef}
        data={surahDetail.ayahs}
        keyExtractor={(item) => `${item.number}`}
        renderItem={renderAyah}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        removeClippedSubviews
        onScrollToIndexFailed={() => undefined}
        ListHeaderComponent={
          bismillahVisible ? (
            <View style={styles.bismillahWrap}>
              <Text style={[styles.bismillahText, { color: palette.text }]}>
                بِسْمِ ٱللَّٰهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
              </Text>
            </View>
          ) : null
        }
        ListFooterComponent={<View style={{ height: 120 }} />}
      />

      {resumeAyahForThisSurah ? (
        <View pointerEvents="box-none" style={styles.fabOverlay}>
          <Pressable
            onPress={() => scrollToAyah(resumeAyahForThisSurah)}
            style={({ pressed }) => [
              styles.resumeFab,
              { backgroundColor: palette.primary, opacity: pressed ? 0.92 : 1 },
            ]}
          >
            <MaterialIcons name="auto-stories" size={20} color={palette.primaryDark} />
            <Text style={[styles.resumeFabText, { color: palette.primaryDark }]}>{t("quran.resumeReading")}</Text>
          </Pressable>
        </View>
      ) : null}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1 },
  loadingContainer: { flex: 1, padding: 16 },
  header: {
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 10,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitleWrap: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  headerSubtitle: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: "500",
  },
  audioRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  audioPlayButtonWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#B08968",
    shadowColor: "#B08968",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  dimmed: {
    opacity: 0.6,
  },
  audioBarWrap: {
    flex: 1,
    gap: 6,
  },
  audioBarTrack: {
    height: 8,
    borderRadius: 999,
    overflow: "hidden",
    justifyContent: "center",
  },
  audioBarFill: {
    height: "100%",
    borderRadius: 999,
  },
  audioTimeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  audioTimeText: {
    fontSize: 10,
    fontWeight: "500",
  },
  audioSettingsButton: {
    width: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  audioErrorText: {
    marginTop: 8,
    color: "#ef4444",
    fontSize: 11,
    fontWeight: "600",
  },
  audioTimingHint: {
    marginTop: 6,
    fontSize: 10,
    fontWeight: "500",
    color: "#94a3b8",
  },
  listContent: {
    paddingBottom: 0,
  },
  bismillahWrap: {
    paddingTop: 24,
    paddingBottom: 20,
    paddingHorizontal: 24,
    alignItems: "center",
  },
  bismillahText: {
    fontSize: 32,
    lineHeight: 58,
    textAlign: "center",
    writingDirection: "rtl",
  },
  ayahRow: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderLeftWidth: 0,
  },
  ayahRowActive: {
    borderLeftWidth: 4,
  },
  ayahActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    marginBottom: 12,
    opacity: 0.95,
  },
  actionButton: {
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  ayahBody: {
    gap: 18,
  },
  arabicText: {
    fontSize: 28,
    lineHeight: 60,
    textAlign: "right",
    writingDirection: "rtl",
  },
  ayahNumberInline: {
    borderWidth: 1,
    borderRadius: 999,
    fontSize: 16,
    fontWeight: "600",
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  translationText: {
    fontSize: 15,
    lineHeight: 24,
  },
  fabOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 16,
    alignItems: "center",
  },
  resumeFab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 999,
    shadowColor: "#B08968",
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  resumeFabText: {
    fontSize: 15,
    fontWeight: "700",
  },
});
