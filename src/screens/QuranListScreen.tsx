import { useEffect, useMemo, useState } from "react";
import {
  FlatList,
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

import { fetchSurahList, getCachedSurahList } from "../api/quranApi";
import { useI18n } from "../hooks/useI18n";
import { useAppTheme } from "../hooks/useAppTheme";
import { useAppStore } from "../store/appStore";
import type { SurahSummary } from "../types/quran";

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

type SortBy = "number" | "name" | "ayahs";
type SortDirection = "asc" | "desc";

export const QuranListScreen = () => {
  const theme = useAppTheme();
  const { t, isRTL } = useI18n();
  const palette = useMemo(
    () => ({
      bg: theme.colors.background,
      card: theme.colors.card,
      surface: theme.colors.card,
      hover: theme.colors.backgroundAlt,
      border: theme.colors.border,
      rowBorder: hexToRgba(theme.colors.border, 0.7),
      text: theme.colors.text,
      textSecondary: theme.colors.textMuted,
      primary: theme.colors.primary,
      primaryDark: theme.colors.background,
      danger: theme.colors.danger,
    }),
    [theme.colors],
  );
  const isIOS = Platform.OS === "ios";

  const surahList = useAppStore((s) => s.surahList);
  const lastRead = useAppStore((s) => s.lastRead);
  const setSurahList = useAppStore((s) => s.setSurahList);

  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("number");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filterLabels = useMemo(
    () =>
      isRTL
        ? {
            filter: "تصفية",
            byNumber: "حسب الرقم",
            byName: "حسب الاسم",
            byAyahs: "حسب عدد الآيات",
            ascending: "تصاعدي",
            descending: "تنازلي",
          }
        : {
            filter: "Filter",
            byNumber: "By Number",
            byName: "By Name",
            byAyahs: "By Ayahs",
            ascending: "Ascending",
            descending: "Descending",
          },
    [isRTL],
  );

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
    const searched = !search
      ? surahList
      : surahList.filter((s) =>
          [s.name, s.englishName, s.englishNameTranslation, `${s.number}`]
            .join(" ")
            .toLowerCase()
            .includes(search),
        );

    const sorted = [...searched].sort((a, b) => {
      if (sortBy === "number") return a.number - b.number;
      if (sortBy === "ayahs") return a.numberOfAyahs - b.numberOfAyahs;
      return a.englishName.localeCompare(b.englishName, undefined, { sensitivity: "base" });
    });

    return sortDirection === "asc" ? sorted : sorted.reverse();
  }, [query, sortBy, sortDirection, surahList]);

  const renderFilterMenu = () => (
    <Stack.Toolbar.Menu icon="line.3.horizontal.decrease.circle" title={filterLabels.filter}>
      <Stack.Toolbar.MenuAction
        icon="number"
        isOn={sortBy === "number"}
        onPress={() => setSortBy("number")}
      >
        {filterLabels.byNumber}
      </Stack.Toolbar.MenuAction>
      <Stack.Toolbar.MenuAction
        icon="textformat"
        isOn={sortBy === "name"}
        onPress={() => setSortBy("name")}
      >
        {filterLabels.byName}
      </Stack.Toolbar.MenuAction>
      <Stack.Toolbar.MenuAction
        icon="list.number"
        isOn={sortBy === "ayahs"}
        onPress={() => setSortBy("ayahs")}
      >
        {filterLabels.byAyahs}
      </Stack.Toolbar.MenuAction>
      <Stack.Toolbar.MenuAction
        icon="arrow.up"
        isOn={sortDirection === "asc"}
        onPress={() => setSortDirection("asc")}
      >
        {filterLabels.ascending}
      </Stack.Toolbar.MenuAction>
      <Stack.Toolbar.MenuAction
        icon="arrow.down"
        isOn={sortDirection === "desc"}
        onPress={() => setSortDirection("desc")}
      >
        {filterLabels.descending}
      </Stack.Toolbar.MenuAction>
    </Stack.Toolbar.Menu>
  );

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
          <View style={[styles.badgeDiamond, { borderColor: hexToRgba(palette.primary, 0.3) }]} />
          <Text style={[styles.badgeNumber, { color: palette.text }]}>{item.number}</Text>
        </View>

        <View style={styles.surahInfo}>
          <Text style={[styles.surahTitle, { color: palette.text }]}>{item.englishName}</Text>
          <View style={styles.surahMetaRow}>
            <Text style={[styles.surahMetaText, { color: palette.textSecondary }]}>
              {item.englishNameTranslation}
            </Text>
            <View style={[styles.metaDot, { backgroundColor: palette.border }]} />
            <Text style={[styles.surahMetaText, { color: palette.textSecondary }]}>
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

  const listHeader = (
    <View style={styles.listHeaderWrap}>
      {!isIOS ? (
        <View style={styles.searchRow}>
          <View style={styles.searchWrap}>
            <MaterialIcons
              name="search"
              size={20}
              color={palette.textSecondary}
              style={styles.searchIcon}
            />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t("quran.searchPlaceholder")}
              placeholderTextColor={palette.textSecondary}
              style={[
                styles.searchInput,
                {
                  backgroundColor: palette.surface,
                  color: palette.text,
                  borderColor: palette.border,
                },
              ]}
            />
          </View>

          <Pressable
            onPress={() => {
              if (sortBy === "number") {
                setSortBy("name");
                return;
              }
              if (sortBy === "name") {
                setSortBy("ayahs");
                return;
              }
              setSortBy("number");
            }}
            onLongPress={() => setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"))}
            style={[
              styles.filterButton,
              {
                backgroundColor: palette.surface,
                borderColor: palette.border,
              },
            ]}
          >
            <MaterialIcons name="filter-list" size={22} color={palette.textSecondary} />
          </Pressable>

          <Pressable
            onPress={() => router.push("/bookmarks")}
            style={[
              styles.filterButton,
              {
                backgroundColor: palette.surface,
                borderColor: palette.border,
              },
            ]}
          >
            <MaterialIcons name="bookmark-border" size={22} color={palette.textSecondary} />
          </Pressable>
        </View>
      ) : null}

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
              backgroundColor: pressed ? hexToRgba(palette.primary, 0.25) : hexToRgba(palette.primary, 0.16),
              borderColor: hexToRgba(palette.primary, 0.12),
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
  );

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
          headerTintColor: palette.primary,
        }}
      />

      {isIOS ? (
        <>
          <Stack.SearchBar
            placeholder={t("quran.searchPlaceholder")}
            placement="integratedButton"
            allowToolbarIntegration
            hideNavigationBar={false}
            hideWhenScrolling={false}
            obscureBackground={false}
            autoCapitalize="words"
            onChangeText={(event) => setQuery(event.nativeEvent.text)}
            onCancelButtonPress={() => setQuery("")}
          />

          <Stack.Toolbar placement="right">
            <Stack.Toolbar.Button
              icon="bookmark"
              onPress={() => router.push("/bookmarks")}
            />
            {renderFilterMenu()}
          </Stack.Toolbar>
        </>
      ) : null}

      <SafeAreaView style={[styles.safe, { backgroundColor: palette.bg }]} edges={isIOS ? ["left", "right"] : ["top", "left", "right"]}>
        {error ? (
          <View
            style={[
              styles.errorBanner,
              {
                borderColor: hexToRgba(palette.danger, 0.25),
                backgroundColor: hexToRgba(palette.danger, 0.08),
              },
            ]}
          >
            <Text style={[styles.errorTitle, { color: palette.danger }]}>{t("quran.errorRefreshList")}</Text>
            <Text style={[styles.errorBody, { color: palette.textSecondary }]}>{error}</Text>
          </View>
        ) : null}

        <FlatList
          data={filtered}
          keyExtractor={(item) => `${item.number}`}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior={isIOS ? "automatic" : "never"}
          automaticallyAdjustContentInsets={isIOS}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={() => void loadSurahs()} tintColor={palette.primary} />
          }
          ListHeaderComponent={listHeader}
          ListEmptyComponent={
            !isLoading ? (
              <View style={[styles.emptyWrap, { borderColor: palette.border, backgroundColor: palette.surface }]}> 
                <MaterialIcons name="menu-book" size={28} color={palette.primary} />
                <Text style={[styles.emptyTitle, { color: palette.text }]}>{t("quran.noSurahs")}</Text>
                <Text style={[styles.emptySub, { color: palette.textSecondary }]}> 
                  {query ? t("quran.tryAnotherSearch") : t("quran.pullToRefreshList")}
                </Text>
              </View>
            ) : null
          }
          ListFooterComponent={
            isLoading ? <Text style={[styles.footerText, { color: palette.primary }]}>{t("quran.loadingList")}</Text> : null
          }
        />
      </SafeAreaView>
    </>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  listHeaderWrap: {
    paddingTop: 8,
    paddingBottom: 6,
  },
  searchRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 10,
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
  },
  errorTitle: {
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
