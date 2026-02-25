import { useEffect, useMemo, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Stack, router } from "expo-router";
import { IconSymbol } from "@/components/ui/icon-symbol";

import { NativeCityMenuButton, isNativeCityMenuAvailable } from "../../../src/components/NativeCityMenuButton";
import { useI18n } from "../../../src/hooks/useI18n";
import { useAppTheme } from "../../../src/hooks/useAppTheme";
import { useAppStore } from "../../../src/store/appStore";

export default function HomeStackLayout() {
  const theme = useAppTheme();
  const { t, locale, isRTL } = useI18n();
  const prayerTimes = useAppStore((s) => s.prayerTimes);
  const manualCity = useAppStore((s) => s.manualCity);
  const setManualCity = useAppStore((s) => s.setManualCity);
  const [now, setNow] = useState(() => Date.now());
  const hasNativeCityMenu = Platform.OS === "ios" && isNativeCityMenuAvailable();

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const headerMeta = useMemo(() => {
    const timezone = prayerTimes?.timezone;
    const tzCity = timezone?.split("/").pop()?.replace(/_/g, " ");
    const locationName = prayerTimes?.city?.city ?? manualCity?.city ?? tzCity ?? t("home.locationFallback");
    const rawTimeLabel = new Date(now).toLocaleTimeString(locale, {
      timeZone: timezone,
      hour: "numeric",
      minute: "2-digit",
    });
    const timeLabel = localizeClockLabel(rawTimeLabel, isRTL);
    return { locationName, timeLabel };
  }, [isRTL, locale, manualCity?.city, now, prayerTimes?.city?.city, prayerTimes?.timezone, t]);

  return (
    <Stack
      screenOptions={{
        headerTransparent: true,
        headerShadowVisible: false,
        headerStyle: { backgroundColor: "transparent" },
        headerTitleAlign: "center",
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: t("tabs.home"),
          headerLeft: () => (
            hasNativeCityMenu ? (
              <NativeCityMenuButton
                style={styles.headerLeftNativeMenu}
                title={
                  isRTL
                    ? `${headerMeta.timeLabel} - ${headerMeta.locationName}`
                    : `${headerMeta.locationName} - ${headerMeta.timeLabel}`
                }
                titleColor={theme.colors.primary}
                pillBackgroundColor={theme.colors.card}
                pillBorderColor={theme.colors.border}
                items={[
                  {
                    id: "search",
                    title: isRTL ? "بحث عن مدينة" : "Search Cities",
                    sf: "magnifyingglass",
                  },
                  {
                    id: "auto",
                    title: isRTL ? "استخدام الموقع الحالي" : "Use Current Location",
                    sf: "location",
                  },
                ]}
                onSelectAction={(event) => {
                  const actionId = event.nativeEvent?.id;
                  if (actionId === "search") {
                    router.push("/city-picker");
                    return;
                  }
                  if (actionId === "auto") {
                    setManualCity(null);
                  }
                }}
              />
            ) : (
              <Pressable
                onPress={() => router.push("/city-picker")}
                hitSlop={8}
                style={({ pressed }) => [
                  styles.headerLeftContainer,
                  { opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Text
                  style={{
                    color: theme.colors.primary,
                    fontSize: 13,
                    fontWeight: "700",
                    writingDirection: isRTL ? "rtl" : "ltr",
                  }}
                >
                  {isRTL
                    ? `${headerMeta.timeLabel} - ${headerMeta.locationName}`
                    : `${headerMeta.locationName} - ${headerMeta.timeLabel}`}
                </Text>
              </Pressable>
            )
          ),
          headerRight: () => (
            <Pressable
              onPress={() => router.push("/qibla")}
              hitSlop={8}
              style={styles.headerRightContainer}
            >
              <IconSymbol
                name="location.north.line.fill"
                size={20}
                color={theme.colors.primary}
                fallbackName="explore"
              />
            </Pressable>
          ),
          headerTitle: () => (
            <View />
          ),
        }}
      />
    </Stack>
  );
}

const styles = StyleSheet.create({
  headerLeftContainer: {
    marginLeft: 16,
    marginRight: 16,
    marginTop: 0,
    marginBottom: 0,
    // paddingBottom: 4,
    flexDirection: 'column',
    justifyContent: 'center',
  },
  headerLeftNativeMenu: {
    marginLeft: 16,
    marginRight: 12,
    height: 34,
    minWidth: 170,
    maxWidth: 300,
  },

  headerRightContainer: {
    width: 20,
    height: 20,
    borderRadius: 50,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: 'transparent',
        marginHorizontal: 8,
      },
      android: {
        backgroundColor: 'rgba(0,0,0,0.05)',
        marginHorizontal: 8,
      }
    })
  }
})

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
