import { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";

import { fetchSurahList, getCachedSurahList } from "../api/quranApi";
import { useI18n } from "../hooks/useI18n";
import { useAppTheme } from "../hooks/useAppTheme";
import { useAppStore } from "../store/appStore";
import type { SurahSummary } from "../types/quran";

const QURAN_THEME = {
  light: {
    bg: "#f4efe6",
    card: "#fffaf0",
    surface: "#fffaf0",
    hover: "rgba(255,255,255,0.5)",
    border: "#d8cfbf",
    rowBorder: "#eee4d2",
    text: "#2a2118",
    textSecondary: "#776a58",
    textAccentMuted: "#b79f82",
    primary: "#B08968",
    primaryDark: "#2F241A",
    darkSurface: "#3A2D22",
  },
  dark: {
    bg: "#1A1511",
    card: "#2E241B",
    surface: "#2E241B",
    hover: "rgba(46,36,27,0.5)",
    border: "rgba(255,255,255,0.06)",
    rowBorder: "rgba(255,255,255,0.04)",
    text: "#ffffff",
    textSecondary: "#cbd5e1",
    textAccentMuted: "#C7AF8A",
    primary: "#D0B089",
    primaryDark: "#2F241A",
    darkSurface: "#3A2D22",
  },
} as const;

export const QuranListScreen = () => {
  const theme = useAppTheme();
  const { t } = useI18n();
  const palette = theme.mode === "dark" ? QURAN_THEME.dark : QURAN_THEME.light;
  const surahList = useAppStore((s) => s.surahList);
  const lastRead = useAppStore((s) => s.lastRead);
  const setSurahList = useAppStore((s) => s.setSurahList);

  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSurahs = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchSurahList();
      setSurahList(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("quran.errorRefreshList"));
      const cached = await getCachedSurahList();
      if (cached?.length) setSurahList(cached);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (surahList.length) return;
    void loadSurahs();
  }, []); // intentional single run

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) return surahList;
    return surahList.filter((s) =>
      [s.name, s.englishName, s.englishNameTranslation, `${s.number}`].join(" ").toLowerCase().includes(search),
    );
  }, [query, surahList]);

  const renderItem = ({ item }: { item: SurahSummary }) => (
    <Pressable
      onPress={() => router.push(`/quran/${item.number}`)}
      style={({ pressed }) => [
        styles.row,
        {
          borderBottomColor: palette.rowBorder,
          backgroundColor: pressed ? palette.hover : "transparent",
        },
      ]}
    >
      <View style={styles.rowLeft}>
        <View style={styles.badgeWrap}>
          <View style={[styles.badgeDiamond, { borderColor: "rgba(176,137,104,0.3)" }]} />
          <Text style={[styles.badgeNumber, { color: theme.mode === "dark" ? "#fff" : "#334155" }]}>{item.number}</Text>
        </View>

        <View style={styles.surahInfo}>
          <Text style={[styles.surahTitle, { color: palette.text }]}>{item.englishName}</Text>
          <View style={styles.surahMetaRow}>
            <Text style={[styles.surahMetaText, { color: theme.mode === "dark" ? palette.textAccentMuted : palette.textSecondary }]}>
              {item.englishNameTranslation}
            </Text>
            <View style={[styles.metaDot, { backgroundColor: theme.mode === "dark" ? palette.darkSurface : "#cbd5e1" }]} />
            <Text style={[styles.surahMetaText, { color: theme.mode === "dark" ? palette.textAccentMuted : palette.textSecondary }]}>
              {t("quran.ayahsCount", { n: item.numberOfAyahs })}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.rowRight}>
        <Text style={[styles.arabicName, { color: palette.primary }]} numberOfLines={1}>
          {item.name}
        </Text>
      </View>
    </Pressable>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.bg }]} edges={["top"]}>
      <View
        style={[
          styles.header,
          {
            backgroundColor: theme.mode === "dark" ? "rgba(16,34,25,0.95)" : "rgba(246,248,247,0.95)",
            borderBottomColor: palette.border,
          },
        ]}
      >
        <View style={styles.headerTop}>
          <Text style={[styles.headerTitle, { color: palette.text }]}>{t("quran.title")}</Text>
          <Pressable
            onPress={() => router.push("/settings")}
            style={({ pressed }) => [
              styles.iconButton,
              {
                backgroundColor: pressed ? palette.darkSurface : "transparent",
              },
            ]}
          >
            <MaterialIcons
              name="settings"
              size={22}
              color={theme.mode === "dark" ? palette.textAccentMuted : palette.textSecondary}
            />
          </Pressable>
        </View>

        <View style={styles.searchRow}>
          <View style={styles.searchWrap}>
            <MaterialIcons
              name="search"
              size={20}
              color={theme.mode === "dark" ? palette.textAccentMuted : "#94a3b8"}
              style={styles.searchIcon}
            />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t("quran.searchPlaceholder")}
              placeholderTextColor={theme.mode === "dark" ? "rgba(146,201,173,0.6)" : "#94a3b8"}
              style={[
                styles.searchInput,
                {
                  backgroundColor: palette.surface,
                  color: palette.text,
                  borderColor: "transparent",
                },
              ]}
            />
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.filterButton,
              {
                backgroundColor: palette.surface,
                borderColor: pressed ? palette.primary : "transparent",
              },
            ]}
          >
            <MaterialIcons
              name="filter-list"
              size={22}
              color={theme.mode === "dark" ? palette.textAccentMuted : palette.textSecondary}
            />
          </Pressable>
        </View>

        {lastRead ? (
          <Pressable
            onPress={() =>
              router.push({
                pathname: "/quran/[surahNumber]",
                params: {
                  surahNumber: String(lastRead.surahNumber),
                  initialAyahNumber: String(lastRead.ayahNumber),
                },
              })
            }
            style={({ pressed }) => [
              styles.resumePill,
              {
                backgroundColor: pressed ? "rgba(176,137,104,0.25)" : "rgba(176,137,104,0.16)",
                borderColor: "rgba(176,137,104,0.12)",
              },
            ]}
          >
            <View style={styles.resumeLeft}>
              <View style={[styles.resumeIconWrap, { backgroundColor: palette.primary }]}>
                <MaterialIcons name="auto-stories" size={15} color={palette.primaryDark} />
              </View>
              <View>
                <Text style={[styles.resumeKicker, { color: palette.primary }]}>{t("quran.continueReading")}</Text>
                <Text style={[styles.resumeText, { color: palette.text }]}>
                  {lastRead.surahName}: {t("quran.ayahLabel", { n: lastRead.ayahNumber })}
                </Text>
              </View>
            </View>
            <MaterialIcons name="arrow-forward" size={20} color={palette.primary} />
          </Pressable>
        ) : null}
      </View>

      {error ? (
        <View style={[styles.errorBanner, { borderColor: "rgba(239,68,68,0.2)" }]}>
          <Text style={styles.errorTitle}>{t("quran.errorRefreshList")}</Text>
          <Text style={[styles.errorBody, { color: theme.mode === "dark" ? palette.textAccentMuted : palette.textSecondary }]}>
            {error}
          </Text>
        </View>
      ) : null}

      <FlatList
        data={filtered}
        keyExtractor={(item) => `${item.number}`}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={() => void loadSurahs()} tintColor={palette.primary} />
        }
        ListEmptyComponent={
          !isLoading ? (
            <View style={[styles.emptyWrap, { borderColor: palette.border, backgroundColor: palette.surface }]}>
              <MaterialIcons name="menu-book" size={28} color={palette.primary} />
              <Text style={[styles.emptyTitle, { color: palette.text }]}>{t("quran.noSurahs")}</Text>
              <Text style={[styles.emptySub, { color: theme.mode === "dark" ? palette.textAccentMuted : palette.textSecondary }]}>
                {query ? t("quran.tryAnotherSearch") : t("quran.pullToRefreshList")}
              </Text>
            </View>
          ) : null
        }
        ListFooterComponent={isLoading ? <Text style={[styles.footerText, { color: palette.primary }]}>{t("quran.loadingList")}</Text> : null}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  headerTitle: {
    fontSize: 30,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  searchRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 6,
  },
  searchWrap: {
    flex: 1,
    position: "relative",
    justifyContent: "center",
  },
  searchIcon: {
    position: "absolute",
    left: 12,
    zIndex: 1,
  },
  searchInput: {
    minHeight: 48,
    borderRadius: 12,
    paddingLeft: 40,
    paddingRight: 12,
    fontSize: 14,
    borderWidth: 1,
  },
  filterButton: {
    width: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  resumePill: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  resumeLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  resumeIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  resumeKicker: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  resumeText: {
    fontSize: 14,
    fontWeight: "500",
    marginTop: 1,
  },
  errorBanner: {
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 4,
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    backgroundColor: "rgba(239,68,68,0.08)",
  },
  errorTitle: {
    color: "#ef4444",
    fontSize: 12,
    fontWeight: "700",
  },
  errorBody: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 16,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 24,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderRadius: 12,
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    flex: 1,
  },
  badgeWrap: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  badgeDiamond: {
    position: "absolute",
    width: 28,
    height: 28,
    borderWidth: 2,
    borderRadius: 8,
    transform: [{ rotate: "45deg" }],
  },
  badgeNumber: {
    fontSize: 13,
    fontWeight: "700",
  },
  surahInfo: {
    flex: 1,
  },
  surahTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  surahMetaRow: {
    marginTop: 3,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  surahMetaText: {
    fontSize: 12,
  },
  metaDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  rowRight: {
    marginLeft: 10,
    maxWidth: 120,
    alignItems: "flex-end",
  },
  arabicName: {
    fontSize: 22,
    fontWeight: "500",
    lineHeight: 30,
    writingDirection: "rtl",
    textAlign: "right",
  },
  emptyWrap: {
    marginTop: 24,
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
  },
  emptyTitle: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: "700",
  },
  emptySub: {
    marginTop: 6,
    textAlign: "center",
    fontSize: 13,
    lineHeight: 18,
  },
  footerText: {
    textAlign: "center",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 8,
  },
});
