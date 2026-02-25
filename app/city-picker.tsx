import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Stack, router } from "expo-router";
import { BlurView } from "expo-blur";
import { MaterialIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { fetchInitialCitySuggestions, searchCitiesWorldwide } from "../src/api/cityApi";
import { useI18n } from "../src/hooks/useI18n";
import { useAppTheme } from "../src/hooks/useAppTheme";
import { useAppStore } from "../src/store/appStore";
import type { CitySearchResult } from "../src/types/location";

const PAGE_SIZE = 100;

export default function CityPickerScreen() {
  const theme = useAppTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const prayerTimes = useAppStore((s) => s.prayerTimes);
  const manualCity = useAppStore((s) => s.manualCity);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CitySearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const hasUserScrolledRef = useRef(false);

  const activeLocationLabel = useMemo(() => {
    const tzCity = prayerTimes?.timezone?.split("/").pop()?.replace(/_/g, " ");
    return prayerTimes?.city?.city ?? manualCity?.city ?? tzCity ?? t("common.unknown");
  }, [manualCity?.city, prayerTimes?.city?.city, prayerTimes?.timezone, t]);

  useEffect(() => {
    let cancelled = false;
    const q = query.trim();
    if (q.length > 0 && q.length < 2) {
      setResults([]);
      setIsLoading(false);
      setError(null);
      return;
    }
    const timeout = setTimeout(async () => {
      setIsLoading(true);
      setError(null);
      setOffset(0);
      hasUserScrolledRef.current = false;
      try {
        const page =
          q.length >= 2
            ? await searchCitiesWorldwide(q, { limit: PAGE_SIZE, offset: 0 })
            : await fetchInitialCitySuggestions(undefined, { limit: PAGE_SIZE, offset: 0 });
        if (!cancelled) {
          setResults(page.results);
          setTotalCount(page.totalCount);
          setOffset(page.results.length);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t("cityPicker.searchError"));
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }, 220);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [activeLocationLabel, query]);

  const loadMore = async () => {
    if (isLoading || isLoadingMore) return;
    if (!hasUserScrolledRef.current) return;
    if (results.length >= totalCount && totalCount > 0) return;
    const q = query.trim();
    if (q.length > 0 && q.length < 2) return;

    setIsLoadingMore(true);
    setError(null);
    try {
      const page =
        q.length >= 2
          ? await searchCitiesWorldwide(q, { limit: PAGE_SIZE, offset })
          : await fetchInitialCitySuggestions(undefined, { limit: PAGE_SIZE, offset });
      setResults((prev) => {
        const seen = new Set(prev.map((x) => x.id));
        const merged = [...prev];
        for (const item of page.results) {
          if (!seen.has(item.id)) merged.push(item);
        }
        return merged;
      });
      setTotalCount(page.totalCount);
      setOffset((prev) => prev + page.results.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("cityPicker.loadMoreError"));
    } finally {
      setIsLoadingMore(false);
    }
  };

  const selectCity = (city: CitySearchResult) => {
    useAppStore.setState({
      manualCity: {
        city: city.name,
        country: city.country,
      },
      coordinates: {
        latitude: city.latitude,
        longitude: city.longitude,
      },
    });
    router.back();
  };
  const isIOS = Platform.OS === "ios";
  const adaptiveTopPadding = 212;

  return (
    <>
      <Stack.Screen
        options={{
          title: t("cityPicker.title"),
          headerShown: true,
          // Native iOS search bar + transparent headers in formSheet can mislayout RN scroll views.
          // Keep native search and let UIKit own the header layout for reliable list positioning.
          headerTransparent: false,
          headerShadowVisible: false,
          headerStyle: { backgroundColor: "transparent" },
          headerBackground: () =>
            isIOS ? <BlurView intensity={35} tint={theme.mode === "dark" ? "dark" : "light"} style={{ flex: 1 }} /> : null,
          headerTintColor: theme.colors.primary,
          headerTitleStyle: {
            color: theme.colors.text,
            fontWeight: "700",
          },
          headerLargeTitle: false,
          headerSearchBarOptions:
            isIOS
              ? {
                  placeholder: t("cityPicker.searchPlaceholder"),
                  hideWhenScrolling: false,
                  obscureBackground: false,
                  autoCapitalize: "words",
                  onChangeText: (event) => setQuery(event.nativeEvent.text),
                  onCancelButtonPress: () => setQuery(""),
                }
              : undefined,
          headerRight: () => (
            <Pressable onPress={() => router.back()} hitSlop={8}>
              <Text style={{ color: theme.colors.primary, fontWeight: "700", fontSize: 16 }}>{t("common.done")}</Text>
            </Pressable>
          ),
        }}
      />

      <View
        style={[
          styles.screen,
          {
            backgroundColor: theme.colors.background,
            paddingTop: adaptiveTopPadding,
            paddingBottom: Math.max(12, insets.bottom + 8),
          },
        ]}
      >
        {isIOS ? (
          <BlurView intensity={45} tint={theme.mode === "dark" ? "dark" : "light"} style={StyleSheet.absoluteFill} />
        ) : null}

        <View style={styles.contentWrap}>
          {!isIOS ? (
            <View
              style={[
                styles.inlineSearchWrap,
                {
                  backgroundColor:theme.colors.primary,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <MaterialIcons name="search" size={18} color={theme.colors.textMuted} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={t("cityPicker.searchPlaceholder")}
                placeholderTextColor={theme.colors.textMuted}
                style={[styles.inlineSearchInput, { color: theme.colors.text }]}
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="search"
                clearButtonMode="while-editing"
              />
            </View>
          ) : null}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <FlatList
            data={results}
            style={styles.list}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            contentInsetAdjustmentBehavior={isIOS ? "automatic" : "never"}
            automaticallyAdjustContentInsets={isIOS}
            contentContainerStyle={[styles.listContent, results.length === 0 ? { flexGrow: 1 } : null]}
            onEndReachedThreshold={0.12}
            onEndReached={() => void loadMore()}
            onScroll={(e) => {
              if (e.nativeEvent.contentOffset.y > 12) {
                hasUserScrolledRef.current = true;
              }
            }}
            scrollEventThrottle={16}
            ListEmptyComponent={
              !isLoading ? (
                <Text style={[styles.emptyText, { color: theme.colors.textMuted }]}>
                  {query.trim().length > 0 && query.trim().length < 2
                    ? t("cityPicker.type2Chars")
                    : query.trim()
                      ? t("cityPicker.noneFound")
                      : t("cityPicker.startTyping")}
                </Text>
              ) : null
            }
            renderItem={({ item }) => (
              <View style={styles.cityRowWrap}>
                <Pressable
                  onPress={() => selectCity(item)}
                  style={({ pressed }) => [
                    styles.cityRow,
                    {
                      opacity: pressed ? 0.85 : 1,
                      borderColor: theme.colors.primary,
                      backgroundColor: (() => {
                        const isSelected = prayerTimes?.city?.city === item.name || manualCity?.city === item.name;
                        if (isSelected) {
                          return theme.mode === "dark" ? "rgba(176,137,104,0.18)" : "rgba(176,137,104,0.14)";
                        }
                        return theme.mode === "dark" ? "rgba(44,34,26,0.78)" : "rgba(255,248,240,0.9)";
                      })(),
                    },
                  ]}
                >
                  <View style={styles.cityRowLeft}>
                    <View
                      style={[
                        styles.cityDot,
                        {
                          backgroundColor: theme.colors.primary,
                        },
                      ]}
                    />
                    <View style={styles.cityTextWrap}>
                      <Text style={[styles.cityName, { color: theme.colors.text }]} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={[styles.cityMeta, { color: theme.colors.textMuted }]} numberOfLines={1}>
                        {[item.region, item.country].filter(Boolean).join(", ")}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.cityTimezone, { color: theme.colors.textMuted }]} numberOfLines={1}>
                    {item.timezone?.split("/").pop()?.replace(/_/g, " ") ?? ""}
                  </Text>
                </Pressable>
              </View>
            )}
            ListFooterComponent={
              isLoadingMore ? (
                <View style={styles.footerLoading}>
                  <ActivityIndicator color={theme.colors.primary} />
                </View>
              ) : results.length > 0 && totalCount > 0 ? (
                <Text style={[styles.footerCount, { color: theme.colors.textMuted }]}>
                  {t("cityPicker.showingCount", { shown: results.length, total: totalCount })}
                </Text>
              ) : null
            }
          />
        </View>

        {isLoading ? (
          <View style={styles.loadingOverlay} pointerEvents="none">
            <ActivityIndicator color={theme.colors.primary} />
          </View>
        ) : null}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: 12,
  },
  sheet: {
    flex: 1,
  },
  contentWrap: {
    flex: 1,
    paddingHorizontal: 0,
  },
  inlineSearchWrap: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  inlineSearchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 8,
  },
  errorText: {
    color: "#ef4444",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 8,
  },
  listContent: {
    paddingBottom: 20,
    paddingTop: 6,
    gap: 8,
    alignItems: "center",
  },
  list: {
    flex: 1,
  },
  cityRow: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    // marginLeft: 12,
    gap:10,
    width: "90%",
  },
  cityRowWrap: {
    width: "100%",
    alignItems: "center",
  },
  cityRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  cityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  cityTextWrap: {
    flex: 1,
  },
  cityName: {
    fontSize: 15,
    fontWeight: "700",
  },
  cityMeta: {
    marginTop: 2,
    fontSize: 12,
  },
  cityTimezone: {
    fontSize: 11,
    maxWidth: 100,
    textAlign: "right",
  },
  emptyText: {
    textAlign: "center",
    marginTop: 24,
    fontSize: 13,
  },
  footerLoading: {
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  footerCount: {
    textAlign: "center",
    fontSize: 11,
    marginTop: 8,
    marginBottom: 10,
  },
  loadingOverlay: {
    position: "absolute",
    top: Platform.OS === "ios" ? 88 : 14,
    right: 18,
  },
});
