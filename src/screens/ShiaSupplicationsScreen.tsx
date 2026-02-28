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

import {
  fetchShiaSupplicationTracks,
  resolveLatmiyatPlaybackUrl,
  type ShiaSupplicationMode,
} from "../api/latmiyatApi";
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

export const ShiaSupplicationsScreen = () => {
  const theme = useAppTheme();
  const { t } = useI18n();
  const latmiyatPlayer = useAppStore((s) => s.latmiyatPlayer);
  const isIOS = Platform.OS === "ios";
  const iosMajorVersion = (() => {
    if (!isIOS) return 0;
    const raw = Platform.Version;
    if (typeof raw === "number") return Math.floor(raw);
    const parsed = Number.parseInt(String(raw).split(".")[0] ?? "0", 10);
    return Number.isFinite(parsed) ? parsed : 0;
  })();
  const supportsIOS26Toolbar = isIOS && iosMajorVersion >= 26;

  const [mode, setMode] = useState<ShiaSupplicationMode>("dua");
  const [query, setQuery] = useState("");
  const [tracks, setTracks] = useState<LatmiyatTrack[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewLoadingTrackId, setPreviewLoadingTrackId] = useState<string | null>(null);

  const modeLabel = useMemo(
    () => ({
      dua: t("supplications.modeDua"),
      athkar: t("supplications.modeAthkar"),
    }),
    [t],
  );

  const loadTracks = useCallback(
    async (searchText?: string, nextMode?: ShiaSupplicationMode) => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await fetchShiaSupplicationTracks(nextMode ?? mode, searchText);
        setTracks(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : t("supplications.error"));
      } finally {
        setIsLoading(false);
      }
    },
    [mode, t],
  );

  useEffect(() => {
    void loadTracks(query, mode);
  }, [loadTracks, mode]);

  const playTrack = useCallback(
    async (track: LatmiyatTrack) => {
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
        setError(err instanceof Error ? err.message : t("supplications.error"));
      } finally {
        setPreviewLoadingTrackId(null);
      }
    },
    [latmiyatPlayer.sourceUrl, latmiyatPlayer.trackId, t],
  );

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
              onPress={() => void playTrack(item)}
              disabled={!item.previewUrl || isTrackLoading}
              style={({ pressed }) => [
                styles.iconButton,
                { backgroundColor: theme.colors.primary, opacity: pressed ? 0.82 : 1 },
                (!item.previewUrl || isTrackLoading) && styles.disabled,
              ]}
            >
              {isTrackLoading ? (
                <ActivityIndicator size="small" color={theme.colors.background} />
              ) : (
                <MaterialIcons name={isPlaying ? "pause" : "play-arrow"} size={22} color={theme.colors.background} />
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
            {item.previewUrl ? (isPlaying ? t("common.pause") : t("common.play")) : t("supplications.noStream")}
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
          headerTintColor: theme.colors.text,
        }}
      />

      {isIOS ? (
        <>
          <Stack.Toolbar placement="left">
            <Stack.Toolbar.Button icon="chevron.backward" onPress={() => router.back()} />
          </Stack.Toolbar>

          <Stack.SearchBar
            placeholder={t("supplications.searchPlaceholder")}
            placement={supportsIOS26Toolbar ? "integratedCentered" : "stacked"}
            allowToolbarIntegration={supportsIOS26Toolbar}
            hideWhenScrolling={false}
            hideNavigationBar={false}
            obscureBackground={false}
            autoCapitalize="words"
            onChangeText={(event) => setQuery(event.nativeEvent.text)}
            onSearchButtonPress={() => void loadTracks(query, mode)}
            onCancelButtonPress={() => {
              setQuery("");
              void loadTracks("", mode);
            }}
          />

          {supportsIOS26Toolbar ? (
            <Stack.Toolbar placement="right">
              <Stack.Toolbar.Button selected={mode === "dua"} onPress={() => setMode("dua")}>
                {modeLabel.dua}
              </Stack.Toolbar.Button>
              <Stack.Toolbar.Button selected={mode === "athkar"} onPress={() => setMode("athkar")}>
                {modeLabel.athkar}
              </Stack.Toolbar.Button>
            </Stack.Toolbar>
          ) : null}
        </>
      ) : null}

      <SafeAreaView
        style={[styles.safe, { backgroundColor: theme.colors.background }]}
        edges={isIOS ? ["left", "right", "bottom"] : ["top", "left", "right", "bottom"]}
      >
        <FlatList
          data={tracks}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={() => void loadTracks(query, mode)}
              tintColor={theme.colors.primary}
            />
          }
          ListHeaderComponent={
            <View style={styles.headerWrap}>
              <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>{t("supplications.subtitle")}</Text>

              {!supportsIOS26Toolbar ? (
                <>
                  <View
                    style={[
                      styles.segmentWrap,
                      { borderColor: theme.colors.border, backgroundColor: theme.colors.card },
                    ]}
                  >
                    {(["dua", "athkar"] as const).map((value) => {
                      const isActive = mode === value;
                      return (
                        <Pressable
                          key={value}
                          onPress={() => setMode(value)}
                          style={[
                            styles.segmentButton,
                            {
                              backgroundColor: isActive ? theme.colors.primary : "transparent",
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.segmentText,
                              {
                                color: isActive ? theme.colors.background : theme.colors.text,
                              },
                            ]}
                          >
                            {modeLabel[value]}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  <View style={styles.searchRow}>
                    <View
                      style={[
                        styles.searchInputWrap,
                        { borderColor: theme.colors.border, backgroundColor: theme.colors.card },
                      ]}
                    >
                      <MaterialIcons name="search" size={18} color={theme.colors.textMuted} />
                      <TextInput
                        value={query}
                        onChangeText={setQuery}
                        onSubmitEditing={() => void loadTracks(query, mode)}
                        placeholder={t("supplications.searchPlaceholder")}
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
                      onPress={() => void loadTracks(query, mode)}
                      style={({ pressed }) => [
                        styles.searchButton,
                        { backgroundColor: theme.colors.primary, opacity: pressed ? 0.85 : 1 },
                      ]}
                    >
                      <MaterialIcons name="arrow-forward" size={18} color={theme.colors.background} />
                    </Pressable>
                  </View>
                </>
              ) : null}

              <Text style={[styles.count, { color: theme.colors.textMuted }]}>
                {tracks.length ? t("supplications.resultsCount", { n: tracks.length }) : ""}
              </Text>
            </View>
          }
          ListEmptyComponent={
            !isLoading ? (
              <EmptyState
                title={t("supplications.emptyTitle")}
                subtitle={error ?? t("supplications.emptySubtitle")}
              />
            ) : (
              <View style={styles.loaderWrap}>
                <ActivityIndicator size="small" color={theme.colors.primary} />
                <Text style={[styles.loaderText, { color: theme.colors.textMuted }]}>{t("supplications.loading")}</Text>
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
  content: { padding: 16, paddingBottom: 22 },
  headerWrap: { marginBottom: 12, gap: 8 },
  subtitle: { fontSize: 13, lineHeight: 19 },
  segmentWrap: {
    marginTop: 6,
    borderWidth: 1,
    borderRadius: 12,
    padding: 4,
    flexDirection: "row",
    gap: 4,
  },
  segmentButton: {
    flex: 1,
    minHeight: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentText: { fontSize: 14, fontWeight: "700" },
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
  count: { fontSize: 12, minHeight: 16 },
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
