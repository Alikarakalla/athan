import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Platform,
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
import { Stack, router, useLocalSearchParams } from "expo-router";
import { createAudioPlayer } from "expo-audio";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { fetchSurahAudioTrack, fetchSurahDetail } from "../api/quranApi";
import { EmptyState } from "../components/EmptyState";
import { LoadingState } from "../components/LoadingState";
import { useI18n } from "../hooks/useI18n";
import { useAppTheme } from "../hooks/useAppTheme";
import {
  ensureQuranPlayback,
  seekQuranToMillis,
  setQuranCurrentAyah,
  toggleQuranPlayback,
} from "../services/quranPlayerService";
import { useAppStore } from "../store/appStore";
import type { AyahLine, SurahAudioTrack, SurahDetail } from "../types/quran";

interface SurahDetailScreenProps {
  surahNumber?: number;
  initialAyahNumber?: number;
}

const hexToRgba = (hex: string, alpha: number) => {
  const clampedAlpha = Math.max(0, Math.min(1, alpha));
  const clean = hex.replace("#", "").trim();
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) {
    return `rgba(0,0,0,${clampedAlpha})`;
  }
  const value = Number.parseInt(clean, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r},${g},${b},${clampedAlpha})`;
};

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
  const isIOS = Platform.OS === "ios";
  const palette = useMemo(
    () => ({
      bg: theme.colors.background,
      headerBg: hexToRgba(theme.colors.background, 0.95),
      border: theme.colors.border,
      rowBorder: hexToRgba(theme.colors.border, 0.5),
      text: theme.colors.text,
      textMuted: theme.colors.textMuted,
      textAccentMuted: theme.colors.accent,
      primary: theme.colors.primary,
      primaryDark: theme.colors.background,
      accentBg: hexToRgba(theme.colors.primary, 0.08),
      danger: theme.colors.danger,
      timelineTrack: hexToRgba(theme.colors.border, 0.75),
    }),
    [theme.colors],
  );
  const bookmarks = useAppStore((s) => s.bookmarks);
  const lastRead = useAppStore((s) => s.lastRead);
  const quranReciterId = useAppStore((s) => s.quranReciterId);
  const toggleBookmark = useAppStore((s) => s.toggleBookmark);
  const setLastRead = useAppStore((s) => s.setLastRead);
  const quranPlayer = useAppStore((s) => s.quranPlayer);

  const [surahDetail, setSurahDetail] = useState<SurahDetail | null>(null);
  const [audioTrack, setAudioTrack] = useState<SurahAudioTrack | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ayahDurationProfileMs, setAyahDurationProfileMs] = useState<number[] | null>(null);
  const [isTimingProfileLoading, setIsTimingProfileLoading] = useState(false);

  const flatListRef = useRef<FlatList<AyahLine>>(null);
  const timelineWidthRef = useRef(0);
  const currentAyahIndexRef = useRef(0);

  const [currentAudioIndex, setCurrentAudioIndex] = useState(0);
  const [scrubProgress, setScrubProgress] = useState<number | null>(null);
  const [timelineWidth, setTimelineWidth] = useState(0);

  const activeSourceUrl = audioTrack?.fullSurahUrl ?? null;
  const isCurrentTrackActive = !!activeSourceUrl && quranPlayer.sourceUrl === activeSourceUrl;
  const isAudioLoading = isCurrentTrackActive ? quranPlayer.isLoading : false;
  const isAudioPlaying = isCurrentTrackActive ? quranPlayer.isPlaying : false;
  const positionMillis = isCurrentTrackActive ? quranPlayer.positionMillis : 0;
  const durationMillis = isCurrentTrackActive ? quranPlayer.durationMillis : 0;
  const audioError = isCurrentTrackActive ? quranPlayer.error : null;

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
  const displayedProgress = scrubProgress ?? streamProgress;
  const displayedPositionMillis =
    scrubProgress !== null && durationMillis > 0 ? Math.floor(durationMillis * scrubProgress) : positionMillis;

  useEffect(() => {
    const commitCurrentAyah = (index: number) => {
      const ayahNumber = surahDetail?.ayahs?.[index]?.numberInSurah ?? null;
      if (isCurrentTrackActive && ayahNumber !== null) {
        setQuranCurrentAyah(ayahNumber);
      }
    };

    if (audioTrack?.verseTimestamps?.length) {
      const index = findCurrentAyahIndexByTimestamps(audioTrack.verseTimestamps, positionMillis);
      currentAyahIndexRef.current = index;
      setCurrentAudioIndex(index);
      commitCurrentAyah(index);
      return;
    }
    const index = findCurrentAyahIndexByProgress(ayahStartFractions, streamProgress);
    currentAyahIndexRef.current = index;
    setCurrentAudioIndex(index);
    commitCurrentAyah(index);
  }, [
    audioTrack?.verseTimestamps,
    ayahStartFractions,
    isCurrentTrackActive,
    positionMillis,
    streamProgress,
    surahDetail?.ayahs,
  ]);

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
          try {
            const sound = createAudioPlayer(uri);
            await new Promise((resolve) => {
              const listener = sound.addListener('playbackStatusUpdate', (status) => {
                if (status.isLoaded) {
                  listener.remove();
                  resolve(status);
                }
              });
              setTimeout(() => { listener.remove(); resolve(null); }, 3000);
            });
            durations.push(sound.duration ? sound.duration * 1000 : 0);
            sound.remove();
          } catch {
            durations.push(0);
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

  const seekToProgress = useCallback(
    async (progress: number, shouldPlay = true) => {
      const bounded = clamp(progress);
      try {
        const approxDuration = durationMillis > 0 ? durationMillis : 0;
        const targetMillis = approxDuration > 0 ? Math.floor(approxDuration * bounded) : 0;
        if (!audioTrack?.fullSurahUrl || !surahDetail) return;
        const sound = await ensureQuranPlayback({
          track: {
            sourceUrl: audioTrack.fullSurahUrl,
            surahNumber: routeSurahNumber,
            surahName: surahDetail.surah.englishName,
            totalAyahs: surahDetail.ayahs.length,
          },
          shouldPlay,
          startMillis: targetMillis,
        });

        if (targetMillis === 0 && durationMillis <= 0) {
          if (sound.isLoaded && sound.duration) {
            const resolvedTarget = Math.floor(sound.duration * 1000 * bounded);
            await seekQuranToMillis(resolvedTarget, shouldPlay);
          }
        }
      } catch (err) {
        // Keep screen stable; error is already reflected in global player state.
      }
    },
    [audioTrack?.fullSurahUrl, durationMillis, routeSurahNumber, surahDetail],
  );

  const togglePlayback = useCallback(async () => {
    if (!audioTrack?.fullSurahUrl || !surahDetail) return;
    try {
      if (!isCurrentTrackActive) {
        await ensureQuranPlayback({
          track: {
            sourceUrl: audioTrack.fullSurahUrl,
            surahNumber: routeSurahNumber,
            surahName: surahDetail.surah.englishName,
            totalAyahs: surahDetail.ayahs.length,
          },
          shouldPlay: true,
          startMillis: 0,
        });
        return;
      }
      await toggleQuranPlayback();
    } catch (err) {
      // Keep screen stable; error is already reflected in global player state.
    }
  }, [
    audioTrack?.fullSurahUrl,
    isCurrentTrackActive,
    routeSurahNumber,
    surahDetail,
  ]);

  const playFromAyahNumber = useCallback(
    async (ayahNumberInSurah: number) => {
      if (!surahDetail?.ayahs.length || !audioTrack?.fullSurahUrl) return;
      const index = surahDetail.ayahs.findIndex((a) => a.numberInSurah === ayahNumberInSurah);
      if (index < 0) return;
      const exactStartMs = audioTrack?.verseTimestamps?.[index]?.timestampFrom;
      if (typeof exactStartMs === "number") {
        try {
          await ensureQuranPlayback({
            track: {
              sourceUrl: audioTrack.fullSurahUrl,
              surahNumber: routeSurahNumber,
              surahName: surahDetail.surah.englishName,
              totalAyahs: surahDetail.ayahs.length,
            },
            shouldPlay: true,
            startMillis: exactStartMs,
          });
          currentAyahIndexRef.current = index;
          setCurrentAudioIndex(index);
          setQuranCurrentAyah(surahDetail.ayahs[index]?.numberInSurah ?? null);
        } catch (err) {
          // Keep screen stable; error is already reflected in global player state.
        }
        return;
      }
      const startFraction = ayahStartFractions[index] ?? 0;
      await seekToProgress(startFraction, true);
    },
    [audioTrack?.fullSurahUrl, audioTrack?.verseTimestamps, ayahStartFractions, routeSurahNumber, seekToProgress, surahDetail],
  );

  const onTimelineLayout = (event: LayoutChangeEvent) => {
    const width = event.nativeEvent.layout.width;
    timelineWidthRef.current = width;
    setTimelineWidth(width);
  };

  const onTimelinePress = useCallback(async (x: number) => {
    const width = timelineWidthRef.current;
    if (!width) return;
    const progress = clamp(x / width);
    setScrubProgress(progress);
    await seekToProgress(progress, isAudioPlaying);
    setScrubProgress(null);
  }, [isAudioPlaying, seekToProgress]);

  const onTimelineScrubStart = useCallback((x: number) => {
    const width = timelineWidthRef.current;
    if (!width) return;
    setScrubProgress(clamp(x / width));
  }, []);

  const onTimelineScrubMove = useCallback((x: number) => {
    const width = timelineWidthRef.current;
    if (!width) return;
    setScrubProgress(clamp(x / width));
  }, []);

  const onTimelineScrubEnd = useCallback(
    (x: number) => {
      const width = timelineWidthRef.current;
      if (!width) {
        setScrubProgress(null);
        return;
      }
      const progress = clamp(x / width);
      setScrubProgress(progress);
      void seekToProgress(progress, isAudioPlaying).finally(() => {
        setScrubProgress(null);
      });
    },
    [isAudioPlaying, seekToProgress],
  );

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
      try {
        const [detail, audio] = await Promise.all([
          fetchSurahDetail(routeSurahNumber),
          fetchSurahAudioTrack(routeSurahNumber, quranReciterId),
        ]);
        if (!isMounted) return;
        setSurahDetail(detail);
        setAudioTrack(audio);
        setAyahDurationProfileMs(null);
        const initialIndex = routeInitialAyah
          ? Math.max(0, detail.ayahs.findIndex((a) => a.numberInSurah === routeInitialAyah))
          : 0;
        currentAyahIndexRef.current = initialIndex;
        setCurrentAudioIndex(initialIndex);
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
  }, [quranReciterId, routeInitialAyah, routeSurahNumber]);

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
  const surahTopTitle = surahDetail?.surah.englishName ?? t("quran.title");
  const iosToolbarReservedSpace = 108;

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
            <Text style={[styles.ayahNumberInline, { borderColor: hexToRgba(palette.primary, 0.4), color: palette.primary }]}>
              {" "}
              {item.numberInSurah}{" "}
            </Text>
          </Text>
          <Text style={[styles.translationText, { color: palette.textMuted }]}>
            {item.translationText}
          </Text>
        </View>
      </View>
    );
  };

  const topToolbar = (
    <>
      <Stack.Screen
        options={{
          headerShown: isIOS,
          headerTransparent: true,
          headerStyle: { backgroundColor: "transparent" },
          headerShadowVisible: false,
          headerBackVisible: false,
          headerTintColor: palette.text,
          headerTitleAlign: "center",
          headerTitle: "",
          headerLeft: () => null,
          headerRight: () => null,
        }}
      />
      {isIOS ? (
        <>
          <Stack.Screen.Title
            style={{
              color: palette.text,
              fontSize: 20,
              fontWeight: "700",
            }}
          >
            {surahTopTitle}
          </Stack.Screen.Title>
          <Stack.Toolbar placement="left">
            <Stack.Toolbar.Button icon="chevron.backward" onPress={() => router.back()} />
          </Stack.Toolbar>
        </>
      ) : null}
    </>
  );

  if (isLoading) {
    return (
      <>
        {topToolbar}
        <View style={[styles.loadingContainer, { backgroundColor: palette.bg }]}>
          <LoadingState label={t("quran.loadingSurah")} />
        </View>
      </>
    );
  }

  if (error || !surahDetail) {
    return (
      <>
        {topToolbar}
        <View style={[styles.loadingContainer, { backgroundColor: palette.bg }]}>
          <EmptyState title={t("quran.unableToLoadSurah")} subtitle={error ?? t("quran.unknownError")} />
        </View>
      </>
    );
  }

  return (
    <>
      {topToolbar}
      {isIOS ? (
        <Stack.Toolbar placement="bottom">
          <Stack.Toolbar.View separateBackground>
            <View style={styles.toolbarPlayerWrap}>
              <Pressable
                onPress={() => void togglePlayback()}
                disabled={!audioTrack?.fullSurahUrl || isAudioLoading}
                style={({ pressed }) => [
                  styles.audioPlayButtonWrap,
                  styles.toolbarPlayButton,
                  { backgroundColor: palette.primary, shadowColor: palette.primary },
                  { opacity: pressed ? 0.9 : 1 },
                  (!audioTrack?.fullSurahUrl || isAudioLoading) && styles.dimmed,
                ]}
              >
                <MaterialIcons
                  name={isAudioLoading ? "hourglass-empty" : isAudioPlaying ? "pause" : "play-arrow"}
                  size={20}
                  color={palette.primaryDark}
                />
              </Pressable>

              <View style={styles.toolbarAudioMeta}>
                <Text style={[styles.toolbarTitleText, { color: palette.text }]} numberOfLines={1}>
                  {surahDetail.surah.englishName} • {t("quran.ayahLabel", { n: currentPlayingAyah ?? 1 })}
                </Text>
                <Pressable
                  onLayout={onTimelineLayout}
                  onPress={(e) => void onTimelinePress(e.nativeEvent.locationX)}
                  onStartShouldSetResponder={() => true}
                  onMoveShouldSetResponder={() => true}
                  onResponderGrant={(e) => onTimelineScrubStart(e.nativeEvent.locationX)}
                  onResponderMove={(e) => onTimelineScrubMove(e.nativeEvent.locationX)}
                  onResponderRelease={(e) => onTimelineScrubEnd(e.nativeEvent.locationX)}
                  onResponderTerminate={() => setScrubProgress(null)}
                  style={[
                    styles.audioBarTrack,
                    styles.toolbarTrack,
                    { backgroundColor: palette.timelineTrack },
                  ]}
                >
                  <View
                    style={[
                      styles.audioBarFill,
                        {
                          backgroundColor: palette.primary,
                          width: `${displayedProgress * 100}%`,
                        },
                      ]}
                    />
                  <View
                    pointerEvents="none"
                    style={[
                      styles.audioBarThumb,
                      {
                        backgroundColor: palette.primary,
                        left: Math.max(0, Math.min(Math.max(0, timelineWidth - 12), timelineWidth * displayedProgress - 6)),
                      },
                    ]}
                  />
                </Pressable>
                <Text style={[styles.toolbarTimeText, { color: palette.textMuted }]} numberOfLines={1}>
                  {formatMs(displayedPositionMillis)} / {durationMillis > 0 ? formatMs(durationMillis) : "--:--"}
                </Text>
              </View>

              <Pressable onPress={() => scrollToAyah(currentPlayingAyah)} style={styles.toolbarLocateButton}>
                <MaterialIcons
                  name="my-location"
                  size={18}
                  color={palette.textMuted}
                />
              </Pressable>
            </View>
          </Stack.Toolbar.View>
        </Stack.Toolbar>
      ) : null}

      <SafeAreaView style={[styles.safe, { backgroundColor: palette.bg }]} edges={isIOS ? ["left", "right"] : ["top"]}>
        {!isIOS ? (
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
                    { color: palette.textMuted },
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
                  { backgroundColor: palette.primary, shadowColor: palette.primary },
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
                  onStartShouldSetResponder={() => true}
                  onMoveShouldSetResponder={() => true}
                  onResponderGrant={(e) => onTimelineScrubStart(e.nativeEvent.locationX)}
                  onResponderMove={(e) => onTimelineScrubMove(e.nativeEvent.locationX)}
                  onResponderRelease={(e) => onTimelineScrubEnd(e.nativeEvent.locationX)}
                  onResponderTerminate={() => setScrubProgress(null)}
                  style={[
                    styles.audioBarTrack,
                    { backgroundColor: palette.timelineTrack },
                  ]}
                >
                  <View
                    style={[
                      styles.audioBarFill,
                      {
                        backgroundColor: palette.primary,
                        width: `${displayedProgress * 100}%`,
                      },
                    ]}
                  />
                  <View
                    pointerEvents="none"
                    style={[
                      styles.audioBarThumb,
                      {
                        backgroundColor: palette.primary,
                        left: Math.max(0, Math.min(Math.max(0, timelineWidth - 12), timelineWidth * displayedProgress - 6)),
                      },
                    ]}
                  />
                </Pressable>
                <View style={styles.audioTimeRow}>
                  <Text style={[styles.audioTimeText, { color: palette.textMuted }]}>
                    {formatMs(displayedPositionMillis)}
                  </Text>
                  <Text style={[styles.audioTimeText, { color: palette.textMuted }]}>
                    {durationMillis > 0 ? formatMs(durationMillis) : "--:--"} • {t("quran.ayahLabel", { n: currentPlayingAyah ?? 1 })}/{surahDetail.ayahs.length}
                  </Text>
                </View>
              </View>

              <Pressable onPress={() => scrollToAyah(currentPlayingAyah)} style={styles.audioSettingsButton}>
                <MaterialIcons
                  name="my-location"
                  size={20}
                  color={palette.textMuted}
                />
              </Pressable>
            </View>

            {audioError ? <Text style={[styles.audioErrorText, { color: palette.danger }]}>{audioError}</Text> : null}
            {isTimingProfileLoading ? (
              <Text style={[styles.audioTimingHint, { color: palette.textMuted }]}>{t("quran.syncingAyahTiming")}</Text>
            ) : null}
          </View>
        ) : null}

        <FlatList
          ref={flatListRef}
          data={surahDetail.ayahs}
          keyExtractor={(item) => `${item.number}`}
          renderItem={renderAyah}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          contentInsetAdjustmentBehavior={isIOS ? "automatic" : "never"}
          automaticallyAdjustContentInsets={isIOS}
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
          ListFooterComponent={<View style={{ height: isIOS ? iosToolbarReservedSpace : 120 }} />}
        />

        {resumeAyahForThisSurah ? (
          <View pointerEvents="box-none" style={[styles.fabOverlay, isIOS ? { bottom: 88 } : null]}>
            <Pressable
              onPress={() => scrollToAyah(resumeAyahForThisSurah)}
              style={({ pressed }) => [
                styles.resumeFab,
                { backgroundColor: palette.primary, shadowColor: palette.primary, opacity: pressed ? 0.92 : 1 },
              ]}
            >
              <MaterialIcons name="auto-stories" size={20} color={palette.primaryDark} />
              <Text style={[styles.resumeFabText, { color: palette.primaryDark }]}>{t("quran.resumeReading")}</Text>
            </Pressable>
          </View>
        ) : null}
      </SafeAreaView>
    </>
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
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  dimmed: {
    opacity: 0.6,
  },
  toolbarPlayerWrap: {
    width: 320,
    maxWidth: 340,
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 4,
    paddingVertical: 2,
    backgroundColor: "transparent",
  },
  toolbarPlayButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  toolbarAudioMeta: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  toolbarTitleText: {
    fontSize: 12,
    fontWeight: "700",
  },
  toolbarTrack: {
    height: 5,
  },
  toolbarTimeText: {
    fontSize: 10,
    fontWeight: "500",
  },
  toolbarLocateButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
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
  audioBarThumb: {
    position: "absolute",
    top: -4,
    width: 12,
    height: 12,
    borderRadius: 6,
    shadowOpacity: 0.22,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
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
    fontSize: 11,
    fontWeight: "600",
  },
  audioTimingHint: {
    marginTop: 6,
    fontSize: 10,
    fontWeight: "500",
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
