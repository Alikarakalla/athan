import { useEffect, useMemo, useState } from "react";
import { Platform, StyleSheet } from "react-native";
import { Stack, router } from "expo-router";

import { HomeScreen } from "../../../src/screens/HomeScreen";
import { useI18n } from "../../../src/hooks/useI18n";
import { useAppTheme } from "../../../src/hooks/useAppTheme";
import { useAppStore } from "../../../src/store/appStore";

export default function HomeRoute() {
  const theme = useAppTheme();
  const { t, locale, isRTL } = useI18n();
  const prayerTimes = useAppStore((s) => s.prayerTimes);
  const manualCity = useAppStore((s) => s.manualCity);
  const liveActivityEnabled = useAppStore((s) => s.liveActivityEnabled);
  const setLiveActivityEnabled = useAppStore((s) => s.setLiveActivityEnabled);
  const [now, setNow] = useState(() => Date.now());

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
    <>
      <Stack.Screen
        options={{
          title: t("tabs.home"),
          headerTitle: "",
          headerBackVisible: false,
          headerLeft: () => null,
          headerRight: () => null,
        }}
      />

      {Platform.OS === "ios" ? (
        <>
          <Stack.Toolbar placement="left">
            <Stack.Toolbar.Button
              onPress={() => router.push("/city-picker")}
              style={[
                styles.leftToolbarButtonLabel,
                {
                  color: theme.colors.primary,
                  writingDirection: isRTL ? "rtl" : "ltr",
                },
              ]}
              accessibilityLabel={t("home.locationFallback")}
            >
              {isRTL
                ? `${headerMeta.timeLabel} - ${headerMeta.locationName}`
                : `${headerMeta.locationName} - ${headerMeta.timeLabel}`}
            </Stack.Toolbar.Button>
          </Stack.Toolbar>

          <Stack.Toolbar placement="right">
            <Stack.Toolbar.Button
              icon="dot.radiowaves.left.and.right"
              tintColor={liveActivityEnabled ? "#FFFFFF" : theme.colors.textMuted}
              separateBackground
              onPress={() => setLiveActivityEnabled(!liveActivityEnabled)}
              accessibilityLabel={liveActivityEnabled ? t("home.menu.disableLiveActivity") : t("home.menu.enableLiveActivity")}
            />
            <Stack.Toolbar.Button
              icon="book.pages.fill"
              tintColor={theme.colors.primary}
              separateBackground
              onPress={() => router.push("/shia-supplications")}
              accessibilityLabel={t("supplications.title")}
            />
            <Stack.Toolbar.Button
              icon="location.north.line.fill"
              tintColor={theme.colors.primary}
              separateBackground
              onPress={() => router.push("/qibla")}
              accessibilityLabel={t("qibla.title")}
            />
          </Stack.Toolbar>
        </>
      ) : null}

      <HomeScreen />
    </>
  );
}

const styles = StyleSheet.create({
  leftToolbarButtonLabel: {
    fontSize: 13,
    fontWeight: "700",
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
