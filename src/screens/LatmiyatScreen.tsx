import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { Stack, router } from "expo-router";

import { fetchLatmiyatTracks, resolveLatmiyatPlaybackUrl } from "../api/latmiyatApi";
import { Card } from "../components/Card";
import { EmptyState } from "../components/EmptyState";
import { useI18n } from "../hooks/useI18n";
import { useAppTheme } from "../hooks/useAppTheme";
import { ensureLatmiyatPlayback, isLatmiyatTrackActive, toggleLatmiyatPlayback } from "../services/latmiyatPlayerService";
import { pauseQuranPlayback } from "../services/quranPlayerService";
import { useAppStore } from "../store/appStore";
import type { LatmiyatTrack } from "../types/latmiyat";

const formatDuration = (durationMillis: number): string => {
  const totalSeconds = Math.max(0, Math.floor(durationMillis / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${`${seconds}`.padStart(2, "0")}`;
};

const releaseYear = (releaseDate: string | null): string => {
  if (!releaseDate) return "";
  const year = new Date(releaseDate).getFullYear();
  return Number.isFinite(year) ? `${year}` : "";
};

type SortBy = "date" | "title" | "duration";
type SortDirection = "asc" | "desc";

export const LatmiyatScreen = () => {
  const theme = useAppTheme();
  const { t, isRTL } = useI18n();
  const isIOS = Platform.OS === "ios";

  const [query, setQuery] = useState("");
  const [tracks, setTracks] = useState<LatmiyatTrack[]>([]);
  const [sortBy, setSortBy] = useState<SortBy>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const latmiyatPlayer = useAppStore((s) => s.latmiyatPlayer);
  const [previewLoadingTrackId, setPreviewLoadingTrackId] = useState<string | null>(null);

  const loadTracks = useCallback(async (searchText?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchLatmiyatTracks(searchText);
      setTracks(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("latmiyat.error"));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadTracks();
  }, [loadTracks]);

  const filterLabels = useMemo(
    () =>
      isRTL
        ? {
            filter: "تصفية",
            byDate: "حسب التاريخ",
            byTitle: "حسب العنوان",
            byDuration: "حسب المدة",
            ascending: "تصاعدي",
            descending: "تنازلي",
          }
        : {
            filter: "Filter",
            byDate: "By Date",
            byTitle: "By Title",
            byDuration: "By Duration",
            ascending: "Ascending",
            descending: "Descending",
          },
    [isRTL],
  );

  const visibleTracks = useMemo(() => {
    const search = query.trim().toLowerCase();
    const searched = !search
      ? tracks
      : tracks.filter((track) =>
          [track.title, track.artistName, track.albumName, releaseYear(track.releaseDate)]
            .join(" ")
            .toLowerCase()
            .includes(search),
        );

    const sorted = [...searched].sort((a, b) => {
      if (sortBy === "title") {
        return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
      }
      if (sortBy === "duration") {
        return (a.durationMillis ?? 0) - (b.durationMillis ?? 0);
      }
      const dateA = a.releaseDate ? Date.parse(a.releaseDate) : 0;
      const dateB = b.releaseDate ? Date.parse(b.releaseDate) : 0;
      return dateA - dateB;
    });

    return sortDirection === "asc" ? sorted : sorted.reverse();
  }, [query, sortBy, sortDirection, tracks]);

  const runSearch = useCallback(() => {
    void loadTracks(query);
  }, [loadTracks, query]);

  const renderFilterMenu = () => (
    <Stack.Toolbar.Menu icon="line.3.horizontal.decrease.circle" title={filterLabels.filter}>
      <Stack.Toolbar.MenuAction icon="calendar" isOn={sortBy === "date"} onPress={() => setSortBy("date")}>
        {filterLabels.byDate}
      </Stack.Toolbar.MenuAction>
      <Stack.Toolbar.MenuAction icon="textformat" isOn={sortBy === "title"} onPress={() => setSortBy("title")}>
        {filterLabels.byTitle}
      </Stack.Toolbar.MenuAction>
      <Stack.Toolbar.MenuAction icon="timer" isOn={sortBy === "duration"} onPress={() => setSortBy("duration")}>
        {filterLabels.byDuration}
      </Stack.Toolbar.MenuAction>
      <Stack.Toolbar.MenuAction icon="arrow.up" isOn={sortDirection === "asc"} onPress={() => setSortDirection("asc")}>
        {filterLabels.ascending}
      </Stack.Toolbar.MenuAction>
      <Stack.Toolbar.MenuAction icon="arrow.down" isOn={sortDirection === "desc"} onPress={() => setSortDirection("desc")}>
        {filterLabels.descending}
      </Stack.Toolbar.MenuAction>
    </Stack.Toolbar.Menu>
  );

  const playPreview = useCallback(async (track: LatmiyatTrack) => {
    if (!track.previewUrl) return;

    const isSameTrack =
      latmiyatPlayer.trackId === track.trackId && isLatmiyatTrackActive(latmiyatPlayer.sourceUrl);
    if (isSameTrack) {
      await toggleLatmiyatPlayback();
      return;
    }

    setPreviewLoadingTrackId(track.trackId);

    try {
      pauseQuranPlayback();
      const playableUrl = await resolveLatmiyatPlaybackUrl(track.previewUrl);
      await ensureLatmiyatPlayback({
        track: {
          sourceUrl: playableUrl,
          trackId: track.trackId,
          title: track.title,
          artistName: track.artistName,
          artworkUrl: track.artworkUrl,
          trackUrl: track.trackUrl,
        },
        shouldPlay: true,
      });
      router.push("/latmiyat-player");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("latmiyat.error"));
    } finally {
      setPreviewLoadingTrackId(null);
    }
  }, [latmiyatPlayer.sourceUrl, latmiyatPlayer.trackId, t]);

  const renderItem = ({ item }: { item: LatmiyatTrack }) => {
    const isActive = latmiyatPlayer.trackId === item.trackId;
    const isPlaying = isActive && latmiyatPlayer.isPlaying;
    const isTrackLoading = previewLoadingTrackId === item.trackId || (isActive && latmiyatPlayer.isLoading);
    const year = releaseYear(item.releaseDate);

    return (
      <Card style={styles.card}>
        <View style={styles.rowTop}>
          <View style={styles.titleBlock}>
            <Text numberOfLines={2} style={[styles.title, { color: theme.colors.text }]}>
              {item.title}
            </Text>
            <Text numberOfLines={1} style={[styles.artist, { color: theme.colors.primary }]}>
              {item.artistName}
            </Text>
            {item.albumName ? (
              <Text numberOfLines={1} style={[styles.meta, { color: theme.colors.textMuted }]}>
                {item.albumName}
                {year ? ` • ${year}` : ""}
              </Text>
            ) : year ? (
              <Text numberOfLines={1} style={[styles.meta, { color: theme.colors.textMuted }]}>
                {year}
              </Text>
            ) : null}
          </View>

          <View style={styles.rightActions}>
            <Pressable
              onPress={() => void playPreview(item)}
              disabled={!item.previewUrl || isTrackLoading}
              style={({ pressed }) => [
                styles.iconButton,
                {
                  backgroundColor: theme.colors.primary,
                  opacity: pressed ? 0.82 : 1,
                },
                (!item.previewUrl || isTrackLoading) && styles.disabled,
              ]}
            >
              {isTrackLoading ? (
                <ActivityIndicator size="small" color={theme.colors.background} />
              ) : (
                <MaterialIcons
                  name={isPlaying ? "pause" : "play-arrow"}
                  size={22}
                  color={theme.colors.background}
                />
              )}
            </Pressable>

            <Pressable
              onPress={() => {
                if (!item.trackUrl) return;
                void Linking.openURL(item.trackUrl);
              }}
              disabled={!item.trackUrl}
              style={({ pressed }) => [
                styles.secondaryButton,
                {
                  borderColor: theme.colors.border,
                  backgroundColor: theme.colors.backgroundAlt,
                  opacity: pressed ? 0.85 : 1,
                },
                !item.trackUrl && styles.disabled,
              ]}
            >
              <MaterialIcons name="open-in-new" size={17} color={theme.colors.textMuted} />
            </Pressable>
          </View>
        </View>

        <View style={styles.footerRow}>
          <Text style={[styles.duration, { color: theme.colors.textMuted }]}>
            {item.durationMillis ? formatDuration(item.durationMillis) : "--:--"}
          </Text>
          <Text style={[styles.previewHint, { color: theme.colors.textMuted }]}>
            {item.previewUrl
              ? isPlaying
                ? t("common.pause")
                : t("common.play")
              : t("latmiyat.noPreview")}
          </Text>
        </View>
      </Card>
    );
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: isIOS,
          headerTransparent: true,
          headerStyle: { backgroundColor: "transparent" },
          headerShadowVisible: false,
          headerBackVisible: false,
          headerTitle: "",
          headerRight: () => null,
          headerLeft: () => null,
          headerTintColor: theme.colors.primary,
        }}
      />

      {isIOS ? (
        <>
          <Stack.SearchBar
            placeholder={t("latmiyat.searchPlaceholder")}
            placement="integratedButton"
            allowToolbarIntegration
            hideNavigationBar={false}
            hideWhenScrolling={false}
            obscureBackground={false}
            autoCapitalize="words"
            onChangeText={(event) => setQuery(event.nativeEvent.text)}
            onSearchButtonPress={runSearch}
            onCancelButtonPress={() => {
              setQuery("");
              void loadTracks();
            }}
          />

          <Stack.Toolbar placement="right">
            <Stack.Toolbar.Button icon="magnifyingglass" onPress={runSearch} />
            {renderFilterMenu()}
          </Stack.Toolbar>
        </>
      ) : null}

      <SafeAreaView
        style={[styles.safe, { backgroundColor: theme.colors.background }]}
        edges={isIOS ? ["left", "right"] : ["top", "left", "right"]}
      >
        <FlatList
          data={visibleTracks}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior={isIOS ? "automatic" : "never"}
          automaticallyAdjustContentInsets={isIOS}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={() => void loadTracks(query)} tintColor={theme.colors.primary} />}
          ListHeaderComponent={
            !isIOS ? (
              <View style={styles.searchRow}>
                <View
                  style={[
                    styles.searchInputWrap,
                    {
                      borderColor: theme.colors.border,
                      backgroundColor: theme.colors.card,
                    },
                  ]}
                >
                  <MaterialIcons name="search" size={18} color={theme.colors.textMuted} />
                  <TextInput
                    value={query}
                    onChangeText={setQuery}
                    onSubmitEditing={() => void loadTracks(query)}
                    placeholder={t("latmiyat.searchPlaceholder")}
                    placeholderTextColor={theme.colors.textMuted}
                    style={[styles.searchInput, { color: theme.colors.text }]}
                    autoCapitalize="words"
                  />
                  {query ? (
                    <Pressable onPress={() => setQuery("")} hitSlop={8}>
                      <MaterialIcons name="close" size={18} color={theme.colors.textMuted} />
                    </Pressable>
                  ) : null}
                </View>

                <Pressable
                  onPress={() => void loadTracks(query)}
                  style={({ pressed }) => [
                    styles.searchButton,
                    { backgroundColor: theme.colors.primary, opacity: pressed ? 0.85 : 1 },
                  ]}
                >
                  <MaterialIcons name="arrow-forward" size={18} color={theme.colors.background} />
                </Pressable>

                <Pressable
                  onPress={() => {
                    if (sortBy === "date") {
                      setSortBy("title");
                      return;
                    }
                    if (sortBy === "title") {
                      setSortBy("duration");
                      return;
                    }
                    setSortBy("date");
                  }}
                  onLongPress={() => setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"))}
                  style={[
                    styles.filterButton,
                    {
                      borderColor: theme.colors.border,
                      backgroundColor: theme.colors.card,
                    },
                  ]}
                >
                  <MaterialIcons name="filter-list" size={20} color={theme.colors.textMuted} />
                </Pressable>
              </View>
            ) : null
          }
          ListEmptyComponent={
            !isLoading ? (
              <EmptyState
                title={t("latmiyat.emptyTitle")}
                subtitle={error ?? t("latmiyat.emptySubtitle")}
              />
            ) : (
              <View style={styles.loaderWrap}>
                <ActivityIndicator size="small" color={theme.colors.primary} />
                <Text style={[styles.loaderText, { color: theme.colors.textMuted }]}>{t("latmiyat.loading")}</Text>
              </View>
            )
          }
        />
      </SafeAreaView>
    </>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 16, paddingBottom: 22, paddingTop: 8 },
  searchRow: { marginTop: 4, flexDirection: "row", gap: 8 },
  searchInputWrap: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    minHeight: 40,
    fontSize: 15,
  },
  searchButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  filterButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  card: { marginBottom: 10 },
  rowTop: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  titleBlock: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontSize: 16, fontWeight: "700", lineHeight: 22 },
  artist: { fontSize: 14, fontWeight: "600" },
  meta: { fontSize: 12, marginTop: 1 },
  rightActions: { flexDirection: "row", gap: 8, alignItems: "center" },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  footerRow: { marginTop: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  duration: { fontSize: 12, fontWeight: "600" },
  previewHint: { fontSize: 12, fontWeight: "500" },
  loaderWrap: { marginTop: 22, alignItems: "center", gap: 8 },
  loaderText: { fontSize: 13 },
  disabled: { opacity: 0.45 },
});
