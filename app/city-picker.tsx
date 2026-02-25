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
import { MaterialIcons } from "@expo/vector-icons";
import type { SearchBarCommands } from "react-native-screens";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { fetchInitialCitySuggestions, searchCitiesWorldwide } from "../src/api/cityApi";
import { useI18n } from "../src/hooks/useI18n";
import { useAppTheme } from "../src/hooks/useAppTheme";
import { useAppStore } from "../src/store/appStore";
import type { CitySearchResult } from "../src/types/location";

const PAGE_SIZE = 100;

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

export default function CityPickerScreen() {
  const theme = useAppTheme();
  const { t, locale, isRTL } = useI18n();
  const insets = useSafeAreaInsets();
  const isIOS = Platform.OS === "ios";
  const iosMajorVersion = (() => {
    if (!isIOS) return 0;
    const raw = Platform.Version;
    if (typeof raw === "number") return Math.floor(raw);
    const parsed = Number.parseInt(String(raw).split(".")[0] ?? "0", 10);
    return Number.isFinite(parsed) ? parsed : 0;
  })();
  const supportsToolbarSearchSlot = iosMajorVersion >= 26;
  const prayerTimes = useAppStore((s) => s.prayerTimes);
  const manualCity = useAppStore((s) => s.manualCity);
  const setManualCity = useAppStore((s) => s.setManualCity);
  const setCoordinates = useAppStore((s) => s.setCoordinates);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CitySearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const searchBarRef = useRef<SearchBarCommands | null>(null);
  const hasUserScrolledRef = useRef(false);

  const activeLocationLabel = useMemo(() => {
    const tzCity = prayerTimes?.timezone?.split("/").pop()?.replace(/_/g, " ");
    return prayerTimes?.city?.city ?? manualCity?.city ?? tzCity ?? t("common.unknown");
  }, [manualCity?.city, prayerTimes?.city?.city, prayerTimes?.timezone, t]);

  const headerLocationTime = useMemo(() => {
    const timezone = prayerTimes?.timezone;
    const rawTimeLabel = new Date(now).toLocaleTimeString(locale, {
      timeZone: timezone,
      hour: "numeric",
      minute: "2-digit",
    });
    const timeLabel = localizeClockLabel(rawTimeLabel, isRTL);
    return isRTL ? `${timeLabel} - ${activeLocationLabel}` : `${activeLocationLabel} - ${timeLabel}`;
  }, [activeLocationLabel, isRTL, locale, now, prayerTimes?.timezone]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

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
    setQuery("");
    searchBarRef.current?.clearText();
    searchBarRef.current?.cancelSearch();
  };
  const adaptiveTopPadding = isIOS ? 6 : insets.top + 8;

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTransparent: true,
          headerStyle: { backgroundColor: "transparent" },
          headerShadowVisible: false,
          headerBackVisible: false,
          headerTitle: headerLocationTime,
          headerTitleAlign: "center",
          headerTitleStyle: {
            color: theme.colors.primary,
            fontSize: 13,
            fontWeight: "700",
          },
          headerRight: () => null,
          headerTintColor: theme.colors.primary,
        }}
      />
      {isIOS ? (
        <>
          <Stack.Toolbar placement="left">
            <Stack.Toolbar.Button icon="chevron.backward" onPress={() => router.back()} />
          </Stack.Toolbar>

          <Stack.Toolbar placement="right">
            <Stack.Toolbar.Button
              icon="location.fill"
              accessibilityLabel="Use current location"
              onPress={() => {
                setManualCity(null);
                setCoordinates(null);
              }}
            />
          </Stack.Toolbar>

          <Stack.SearchBar
            ref={searchBarRef}
            placeholder={t("cityPicker.searchPlaceholder")}
            placement={supportsToolbarSearchSlot ? "automatic" : "stacked"}
            allowToolbarIntegration={supportsToolbarSearchSlot}
            hideWhenScrolling={false}
            obscureBackground={false}
            autoCapitalize="words"
            onChangeText={(event) => setQuery(event.nativeEvent.text)}
            onCancelButtonPress={() => setQuery("")}
          />

          {supportsToolbarSearchSlot ? (
            <Stack.Toolbar placement="bottom">
              <Stack.Toolbar.SearchBarSlot />
            </Stack.Toolbar>
          ) : null}
        </>
      ) : null}

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
        <View style={styles.contentWrap}>
          {!isIOS ? (
            <View
              style={[
                styles.inlineSearchWrap,
                {
                  backgroundColor: theme.colors.card,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <MaterialIcons name="search" size={20} color={theme.colors.textMuted} />
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

          {error ? <Text style={[styles.errorText, { color: theme.colors.danger }]}>{error}</Text> : null}

          <FlatList
            data={results}
            style={styles.list}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            contentInsetAdjustmentBehavior={isIOS ? "automatic" : "never"}
            automaticallyAdjustContentInsets={isIOS}
            contentContainerStyle={styles.listContent}
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
            renderItem={({ item }) => {
              const isSelected = prayerTimes?.city?.city === item.name || manualCity?.city === item.name;
              return (
                <View style={styles.cityRowWrap}>
                  <Pressable
                    onPress={() => selectCity(item)}
                    style={({ pressed }) => [
                      styles.cityRow,
                      {
                        opacity: pressed ? 0.9 : 1,
                        borderColor: isSelected ? theme.colors.primary : hexToRgba(theme.colors.border, 0.65),
                        backgroundColor: isSelected ? hexToRgba(theme.colors.primary, 0.14) : hexToRgba(theme.colors.card, 0.92),
                      },
                    ]}
                  >
                    <View style={styles.cityRowLeft}>
                      <View
                        style={[
                          styles.cityDotWrap,
                          {
                            borderColor: isSelected ? theme.colors.primary : hexToRgba(theme.colors.border, 0.8),
                            backgroundColor: isSelected ? hexToRgba(theme.colors.primary, 0.12) : "transparent",
                          },
                        ]}
                      >
                        <View
                          style={[
                            styles.cityDot,
                            {
                              backgroundColor: theme.colors.primary,
                              opacity: isSelected ? 1 : 0.7,
                            },
                          ]}
                        />
                      </View>
                      <View style={styles.cityTextWrap}>
                        <Text style={[styles.cityName, { color: theme.colors.text }]} numberOfLines={1}>
                          {item.name}
                        </Text>
                        <Text style={[styles.cityMeta, { color: theme.colors.textMuted }]} numberOfLines={1}>
                          {[item.region, item.country].filter(Boolean).join(", ")}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.cityRight}>
                      <Text
                        style={[
                          styles.cityTimezone,
                          {
                            color: isSelected ? theme.colors.text : theme.colors.textMuted,
                            borderColor: hexToRgba(theme.colors.border, 0.8),
                            backgroundColor: hexToRgba(theme.colors.backgroundAlt, 0.55),
                          },
                        ]}
                        numberOfLines={1}
                      >
                        {item.timezone?.split("/").pop()?.replace(/_/g, " ") ?? ""}
                      </Text>
                      {isSelected ? (
                        <MaterialIcons name="check-circle" size={18} color={theme.colors.primary} />
                      ) : (
                        <MaterialIcons name="chevron-right" size={18} color={hexToRgba(theme.colors.textMuted, 0.9)} />
                      )}
                    </View>
                  </Pressable>
                </View>
              );
            }}
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
    paddingHorizontal: 14,
  },
  sheet: {
    flex: 1,
  },
  contentWrap: {
    flex: 1,
    minHeight: 0,
    paddingHorizontal: 0,
  },
  inlineSearchWrap: {
    minHeight: 48,
    borderRadius: 24,
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
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 8,
  },
  listContent: {
    flexGrow: 1,
    paddingBottom: 24,
    paddingTop: 8,
    gap: 10,
    alignItems: "stretch",
  },
  list: {
    flex: 1,
    width: "100%",
  },
  cityRow: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    width: "100%",
  },
  cityRowWrap: {
    width: "100%",
  },
  cityRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  cityDotWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  cityDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  cityTextWrap: {
    flex: 1,
  },
  cityRight: {
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 7,
    maxWidth: 118,
  },
  cityName: {
    fontSize: 16,
    fontWeight: "700",
  },
  cityMeta: {
    marginTop: 3,
    fontSize: 13,
  },
  cityTimezone: {
    fontSize: 11,
    maxWidth: 118,
    textAlign: "right",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    overflow: "hidden",
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
    top: Platform.OS === "ios" ? 60 : 14,
    right: 18,
  },
});

const toArabicDigits = (value: string): string =>
  value.replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)] ?? d);

const localizeClockLabel = (value: string, isArabic: boolean): string => {
  if (!isArabic) return value;
  return toArabicDigits(
    value
      .replace(/\bAM\b/i, "ص")
      .replace(/\bPM\b/i, "م"),
  );
};
