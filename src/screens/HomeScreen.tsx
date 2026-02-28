import { useMemo } from "react";
import {
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";

import { useAppTheme } from "../hooks/useAppTheme";
import { useI18n } from "../hooks/useI18n";
import { usePrayerTimes } from "../hooks/usePrayerTimes";
import { useAppStore } from "../store/appStore";

type PrayerIconName =
  | "wb-twilight"
  | "wb-sunny"
  | "light-mode"
  | "brightness-5"
  | "nights-stay"
  | "bedtime";

type HomePalette = {
  bg: string;
  text: string;
  textMuted: string;
  card: string;
  cardBorder: string;
  rowHover: string;
  primary: string;
  primaryTextDark: string;
  surfaceDark: string;
  surfaceDarker: string;
  border: string;
  danger: string;
};

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

const PRAYER_ICON_MAP: Record<string, PrayerIconName> = {
  Fajr: "wb-twilight",
  Sunrise: "wb-sunny",
  Dhuhr: "light-mode",
  Asr: "brightness-5",
  Maghrib: "nights-stay",
  Isha: "bedtime",
};

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

const formatRelativeCountdown = (ms: number, locale: string, isArabic: boolean): string => {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const nf = new Intl.NumberFormat(isArabic ? "ar" : locale);
  if (isArabic) {
    if (hours > 0) return `بعد ${nf.format(hours)} ساعة ${nf.format(minutes)} دقيقة`;
    return `بعد ${nf.format(minutes)} دقيقة`;
  }
  if (hours > 0) return `in ${nf.format(hours)} hr${hours > 1 ? "s" : ""} ${nf.format(minutes)} min${minutes !== 1 ? "s" : ""}`;
  return `in ${nf.format(minutes)} min${minutes !== 1 ? "s" : ""}`;
};

const formatGregorian = (date: Date, timeZone?: string): string =>
  date.toLocaleDateString(undefined, {
    timeZone,
    weekday: "long",
    day: "2-digit",
    month: "short",
  });

const HIJRI_MONTHS_AR: Record<string, string> = {
  Muharram: "محرم",
  Safar: "صفر",
  "Rabiʻ I": "ربيع الأول",
  "Rabiʻ II": "ربيع الثاني",
  "Jumada I": "جمادى الأولى",
  "Jumada II": "جمادى الآخرة",
  Rajab: "رجب",
  "Shaʻban": "شعبان",
  Ramadan: "رمضان",
  Shawwal: "شوال",
  "Dhuʻl-Qiʻdah": "ذو القعدة",
  "Dhuʻl-Hijjah": "ذو الحجة",
};

const formatIslamic = (date: Date, timeZone?: string, locale = "en", isArabic = false): string => {
  try {
    const formatter = new Intl.DateTimeFormat(`${locale}-u-ca-islamic`, {
      timeZone,
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const formatted = formatter.format(date);
    if (!isArabic) return formatted;

    const enParts = new Intl.DateTimeFormat("en-u-ca-islamic", {
      timeZone,
      day: "numeric",
      month: "long",
      year: "numeric",
    }).formatToParts(date);
    const day = enParts.find((p) => p.type === "day")?.value ?? "";
    const month = enParts.find((p) => p.type === "month")?.value ?? "";
    const year = enParts.find((p) => p.type === "year")?.value ?? "";
    const arMonth = HIJRI_MONTHS_AR[month] ?? month;
    return `${toArabicDigits(day)} ${arMonth} ${toArabicDigits(year)}`.trim();
  } catch {
    return isArabic ? "التاريخ الهجري غير متوفر" : "Islamic date unavailable";
  }
};

const GAUGE_SEGMENTS = 42;
const getIOSMajorVersion = (): number => {
  if (Platform.OS !== "ios") return 0;
  const version = Platform.Version;
  if (typeof version === "number") return version;
  const parsed = Number.parseInt(`${version}`.split(".")[0] ?? "0", 10);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getNextPrayerProgress = (
  prayers: NonNullable<ReturnType<typeof useAppStore.getState>["prayerTimes"]>["prayers"] | undefined,
  nextPrayerTimestamp: number | undefined,
  nowTs: number,
) => {
  if (!prayers?.length || !nextPrayerTimestamp) {
    return {
      progress: 0,
      previousPrayerName: "Previous",
      nextPrayerName: "Next",
      elapsedMs: 0,
      totalMs: 1,
    };
  }

  const nextIndex = prayers.findIndex((p) => p.timestamp === nextPrayerTimestamp || p.name === prayers.find((x) => x.timestamp === nextPrayerTimestamp)?.name);
  const fallbackNextIndex = nextIndex >= 0 ? nextIndex : prayers.findIndex((p) => p.timestamp > nowTs);
  const resolvedNextIndex = fallbackNextIndex >= 0 ? fallbackNextIndex : prayers.findIndex((p) => p.name === "Fajr");
  if (resolvedNextIndex < 0) {
    return {
      progress: 0,
      previousPrayerName: "Previous",
      nextPrayerName: "Next",
      elapsedMs: 0,
      totalMs: 1,
    };
  }

  const nextPrayer = prayers[resolvedNextIndex];
  const prevPrayer = prayers[(resolvedNextIndex - 1 + prayers.length) % prayers.length];
  const nextTs = nextPrayerTimestamp;

  let prevTs = prevPrayer.timestamp;
  if (nextTs > prayers[prayers.length - 1].timestamp && nextPrayer.name === "Fajr") {
    prevTs = prayers[prayers.length - 1].timestamp;
  } else if (resolvedNextIndex === 0 && nowTs < nextPrayer.timestamp) {
    prevTs = prevPrayer.timestamp - 24 * 60 * 60 * 1000;
  }

  const totalMs = Math.max(1, nextTs - prevTs);
  const elapsedMs = Math.min(totalMs, Math.max(0, nowTs - prevTs));

  return {
    progress: Math.min(1, Math.max(0, elapsedMs / totalMs)),
    previousPrayerName: prevPrayer.name,
    nextPrayerName: nextPrayer.name,
    elapsedMs,
    totalMs,
  };
};

type HeroGaugeProps = {
  palette: HomePalette;
  nextPrayerName: string;
  nextPrayerTime: string;
  countdownLabel: string;
  nextPrayerRelative: string;
  notificationsEnabled: boolean;
  progress: number;
  previousPrayerName: string;
  isNightTheme: boolean;
  nextPrayerPillLabel: string;
};

const HeroPrayerGauge = ({
  palette,
  nextPrayerName,
  nextPrayerTime,
  countdownLabel,
  nextPrayerRelative,
  notificationsEnabled,
  progress,
  previousPrayerName,
  isNightTheme,
  nextPrayerPillLabel,
}: HeroGaugeProps) => {
  const gaugeSize = 248;
  const radius = 108;
  const center = gaugeSize / 2;
  const filledSegments = Math.max(0, Math.min(GAUGE_SEGMENTS - 1, Math.round(progress * (GAUGE_SEGMENTS - 1))));
  const dotRatio = filledSegments / (GAUGE_SEGMENTS - 1);
  const activeAngle = 180 + dotRatio * 180;
  const activeRad = (activeAngle * Math.PI) / 180;
  const dotX = center + Math.cos(activeRad) * radius;
  const dotY = center + Math.sin(activeRad) * radius;
  const progressColor = palette.primary;
  const dimArcColor = hexToRgba(palette.primary, isNightTheme ? 0.22 : 0.14);
  const dotGlowColor = hexToRgba(palette.primary, isNightTheme ? 0.36 : 0.24);

  return (
    <View
      style={[
        styles.featureCard,
        styles.heroGaugeCard,
        {
          backgroundColor: palette.surfaceDark,
          borderColor: palette.cardBorder,
        },
      ]}
    >
      <View style={styles.heroNoiseLayer} />
      <View style={[styles.heroGlowA, { backgroundColor: hexToRgba(palette.primary, 0.12) }]} />
      <View style={[styles.heroGlowB, { backgroundColor: hexToRgba(palette.primary, 0.08) }]} />
      <View style={[styles.ramadanStar, styles.ramadanStarA, { backgroundColor: hexToRgba(palette.primary, 0.45) }]} />
      <View style={[styles.ramadanStar, styles.ramadanStarB, { backgroundColor: hexToRgba(palette.primary, 0.45) }]} />
      <View style={[styles.ramadanStar, styles.ramadanStarC, { backgroundColor: hexToRgba(palette.primary, 0.45) }]} />
      <View style={styles.featureTopRow}>
        <View style={styles.topPillRow}>
          <View
            style={[
              styles.nextPill,
              {
                backgroundColor: hexToRgba(palette.primary, 0.16),
                borderColor: hexToRgba(palette.primary, 0.2),
              },
            ]}
          >
            <Text style={[styles.nextPillText, { color: palette.primary }]}>{nextPrayerPillLabel}</Text>
          </View>
        </View>
        <Pressable>
          <MaterialIcons
            name={notificationsEnabled ? "notifications-active" : "notifications-off"}
            size={22}
            color={palette.textMuted}
          />
        </Pressable>
      </View>

      <View style={styles.gaugeWrap}>
        <View style={[styles.gaugeVisualArea, { width: gaugeSize, height: gaugeSize / 2 + 20 }]}>
          <View style={[styles.gaugeHalfMask, { width: gaugeSize, height: gaugeSize / 2 + 0 }]}>
            <View style={[styles.gaugeCircleBase, { width: gaugeSize, height: gaugeSize }]}>
              {Array.from({ length: GAUGE_SEGMENTS }).map((_, index) => {
                const ratio = index / (GAUGE_SEGMENTS - 1);
                const angle = 180 + ratio * 180;
                const rad = (angle * Math.PI) / 180;
                const x = center + Math.cos(rad) * radius;
                const y = center + Math.sin(rad) * radius;
                const isFilled = index <= filledSegments;
                return (
                  <View
                    key={`seg-${index}`}
                    style={[
                      styles.gaugeSegment,
                      {
                        left: x - 10,
                        top: y - 2,
                        transform: [{ rotate: `${angle + 90}deg` }],
                        backgroundColor: isFilled ? progressColor : dimArcColor,
                        opacity: isFilled ? 1 : 0.9,
                        shadowColor: isFilled ? palette.primary : "transparent",
                        shadowOpacity: isFilled ? 0.3 : 0,
                        shadowRadius: isFilled ? 6 : 0,
                        shadowOffset: { width: 0, height: 0 },
                      },
                    ]}
                  />
                );
              })}

              <View
                style={[
                  styles.gaugeDotGlow,
                  {
                    left: dotX - 9,
                    top: dotY - 9,
                    backgroundColor: dotGlowColor,
                  },
                ]}
              />
              <View
                style={[
                  styles.gaugeDot,
                  {
                    left: dotX - 4.5,
                    top: dotY - 4.5,
                    backgroundColor: progressColor,
                    borderColor: palette.border,
                  },
                ]}
              />
            </View>
          </View>

          <View style={styles.gaugeCenterContent}>
            <Text style={[styles.featurePrayerName, { color: palette.text }]}>{nextPrayerName}</Text>
            <Text style={[styles.gaugeBigTime, { color: palette.text }]}>{nextPrayerTime}</Text>
            <Text style={[styles.gaugeCountdownText, { color: palette.textMuted }]}>
              {nextPrayerRelative} <Text style={[styles.gaugeCountdownCode, { color: palette.textMuted }]}>({countdownLabel})</Text>
            </Text>
          </View>

          <View style={styles.arcEdgeLabels} pointerEvents="none">
            <Text numberOfLines={1} style={[styles.arcEdgeLabelText, { color: palette.textMuted }]}>
              {previousPrayerName}
            </Text>
            <Text numberOfLines={1} style={[styles.arcEdgeLabelText, styles.arcEdgeLabelTextRight, { color: palette.textMuted }]}>
              {nextPrayerName}
            </Text>
          </View>
        </View>

      </View>
    </View>
  );
};

export const HomeScreen = () => {
  const insets = useSafeAreaInsets();
  const theme = useAppTheme();
  const prayerTimes = useAppStore((s) => s.prayerTimes);
  const manualCity = useAppStore((s) => s.manualCity);
  const notificationsEnabled = useAppStore((s) => s.notificationsEnabled);
  const prayerNotificationPrefs = useAppStore((s) => s.prayerNotificationPrefs);
  const togglePrayerNotificationEnabled = useAppStore((s) => s.togglePrayerNotificationEnabled);
  const { isLoading, error, nextPrayer, countdownLabel, refreshPrayerTimes } = usePrayerTimes();
  const { t, prayerName, locale, isRTL } = useI18n();

  const palette: HomePalette = {
    bg: theme.colors.background,
    text: theme.colors.text,
    textMuted: theme.colors.textMuted,
    card: theme.colors.card,
    cardBorder: theme.colors.border,
    rowHover: theme.colors.backgroundAlt,
    primary: theme.colors.primary,
    primaryTextDark: theme.colors.background,
    surfaceDark: theme.colors.card,
    surfaceDarker: theme.colors.backgroundAlt,
    border: theme.colors.border,
    danger: theme.colors.danger,
  };
  const nowTs = Date.now();

  const today = useMemo(() => new Date(), [prayerTimes?.dateKey, countdownLabel]);
  const gregorianDate = today.toLocaleDateString(locale, {
    timeZone: prayerTimes?.timezone,
    weekday: "long",
    day: "2-digit",
    month: "short",
  });
  const islamicDate = formatIslamic(today, prayerTimes?.timezone, locale, isRTL);

  const nextPrayerName = nextPrayer?.prayer.name ? prayerName(nextPrayer.prayer.name) : t("prayer.nextPrayer");
  const nextPrayerTime = nextPrayer?.prayer.displayTime ? localizeClockLabel(nextPrayer.prayer.displayTime, isRTL) : "--:--";
  const nextPrayerRelative = nextPrayer ? formatRelativeCountdown(nextPrayer.remainingMs, locale, isRTL) : t("prayer.refreshHint");
  const heroProgress = getNextPrayerProgress(prayerTimes?.prayers, nextPrayer?.prayer.timestamp, nowTs);
  const sunrisePrayer = prayerTimes?.prayers.find((p) => p.name === "Sunrise");
  const maghribPrayer = prayerTimes?.prayers.find((p) => p.name === "Maghrib");
  const isNightHero =
    sunrisePrayer && maghribPrayer
      ? nowTs < sunrisePrayer.timestamp || nowTs >= maghribPrayer.timestamp
      : true;
  const isIOSNativeTabs = Platform.OS === "ios" && getIOSMajorVersion() >= 26;
  const topContentInset = 0;
  const bottomContentInset =
    Platform.OS === "ios"
      ? isIOSNativeTabs
        ? Math.max(insets.bottom + 12, 20)
        : Math.max(insets.bottom + 86, 86)
      : Math.max(insets.bottom + 86, 86);

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: palette.bg }]}
      edges={Platform.OS === "ios" ? ["left", "right", "bottom"] : ["top", "left", "right", "bottom"]}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="never"
        scrollIndicatorInsets={{
          top: topContentInset,
          bottom: bottomContentInset,
        }}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: topContentInset,
            paddingBottom: bottomContentInset,
          },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={() => void refreshPrayerTimes()}
            tintColor={palette.primary}
          />
        }
      >
        <View style={styles.main}>
          <View style={styles.featureWrap}>
            <HeroPrayerGauge
              palette={palette}
              nextPrayerName={nextPrayerName}
              nextPrayerTime={nextPrayerTime}
              countdownLabel={localizeClockLabel(countdownLabel, isRTL)}
              nextPrayerRelative={nextPrayer ? nextPrayerRelative : t("prayer.unavailable")}
              notificationsEnabled={notificationsEnabled}
              progress={heroProgress.progress}
              previousPrayerName={prayerName(heroProgress.previousPrayerName)}
              isNightTheme={isNightHero}
              nextPrayerPillLabel={t("prayer.nextPrayer")}
            />
          </View>

          <View style={styles.dateRow}>
            <View>
              <Text style={[styles.dateTitle, { color: palette.text }]}>{gregorianDate}</Text>
              <Text style={[styles.dateSub, { color: palette.textMuted }]}>{islamicDate}</Text>
            </View>
            <Pressable style={[styles.headerIconBtn, { backgroundColor: palette.rowHover }]}>
              <MaterialIcons name="calendar-month" size={22} color={palette.textMuted} />
            </Pressable>
          </View>

          {!!error && (
            <View
              style={[
                styles.errorBox,
                {
                  backgroundColor: hexToRgba(palette.danger, 0.12),
                  borderColor: hexToRgba(palette.danger, 0.4),
                },
              ]}
            >
              <Text style={[styles.errorTitle, { color: palette.danger }, isRTL && styles.rtlText]}>{t("prayer.errorTitle")}</Text>
              <Text style={[styles.errorText, { color: palette.textMuted }]}>{error}</Text>
            </View>
          )}

          <View style={styles.prayerList}>
            {prayerTimes?.prayers?.map((prayer) => {
              const isNext = nextPrayer?.prayer.name === prayer.name;
              const isPassed = prayer.timestamp < nowTs && !isNext;
              const iconName = PRAYER_ICON_MAP[prayer.name] ?? "schedule";
              const showNotifButton = prayer.name !== "Sunrise";
              const prayerNotifEnabled = (prayerNotificationPrefs[prayer.name] ?? true) && notificationsEnabled;

              return (
                <View
                  key={prayer.name}
                  style={[
                    styles.prayerItem,
                    {
                      backgroundColor: palette.card,
                      borderColor: isNext ? hexToRgba(palette.primary, 0.35) : palette.cardBorder,
                      opacity: isPassed ? 0.7 : 1,
                    },
                    isNext && styles.prayerItemActive,
                    isNext && {
                      borderLeftColor: palette.primary,
                      shadowColor: palette.primary,
                    },
                  ]}
                >
                  <View style={styles.prayerLeft}>
                    <View
                      style={[
                        styles.prayerIconWrap,
                        {
                          backgroundColor: isNext
                            ? hexToRgba(palette.primary, 0.14)
                            : palette.rowHover,
                        },
                      ]}
                    >
                      <MaterialIcons
                        name={iconName as never}
                        size={20}
                        color={isNext ? palette.primary : palette.textMuted}
                      />
                    </View>
                    <Text
                      style={[
                        styles.prayerName,
                        { color: isNext ? palette.primary : palette.text },
                        isNext && styles.prayerNameActive,
                      ]}
                    >
                      {prayerName(prayer.name)}
                    </Text>
                  </View>

                  <View style={styles.prayerRight}>
                    <Text
                      style={[
                        styles.prayerTime,
                        { color: isNext ? palette.primary : palette.text },
                        isNext && styles.prayerTimeActive,
                      ]}
                    >
                      {localizeClockLabel(prayer.displayTime, isRTL)}
                    </Text>
                    {showNotifButton ? (
                      <Pressable
                        onPress={() => togglePrayerNotificationEnabled(prayer.name)}
                        hitSlop={8}
                        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                      >
                        <MaterialIcons
                          name={
                            prayerNotifEnabled
                              ? isNext
                                ? "notifications-active"
                                : "notifications"
                              : "notifications-off"
                          }
                          size={20}
                          color={prayerNotifEnabled ? (isNext ? palette.primary : palette.textMuted) : palette.textMuted}
                        />
                      </Pressable>
                    ) : (
                      <View style={{ width: 20 }} />
                    )}
                  </View>
                </View>
              );
            })}

            {!prayerTimes && (
              <View
                style={[
                  styles.emptyBox,
                  {
                    backgroundColor: palette.card,
                    borderColor: palette.cardBorder,
                  },
                ]}
                >
                <Text style={[styles.emptyTitle, { color: palette.text }]}>{t("prayer.unavailableTitle")}</Text>
                <Text style={[styles.emptySub, { color: palette.textMuted }]}>
                  {t("prayer.unavailableBody")}
                </Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  header: {
    borderBottomWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  inlineTransparentHeader: {
    borderBottomWidth: 1,
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitleWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  headerTitle: {
    textAlign: "center",
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  headerSubTitle: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: "500",
  },
  qiblaPill: {
    minHeight: 32,
    borderRadius: 999,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  qiblaPillText: {
    fontSize: 11,
    fontWeight: "700",
  },
  scrollContent: {
    paddingTop: 0,
    paddingBottom: 0,
  },
  main: {
    paddingHorizontal: 20,
    paddingTop: 0,
    gap: 18,
  },
  featureWrap: {},
  featureCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  heroGaugeCard: {
    padding: 18,
    minHeight: 266,
    position: "relative",
  },
  heroNoiseLayer: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.35,
    backgroundColor: "transparent",
  },
  heroGlowA: {
    position: "absolute",
    top: -40,
    left: -20,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "rgba(176,137,104,0.08)",
  },
  heroGlowB: {
    position: "absolute",
    right: -30,
    bottom: 40,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  featureTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  },
  topPillRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    flex: 1,
  },
  nextPill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "rgba(176,137,104,0.16)",
    borderWidth: 1,
    borderColor: "rgba(176,137,104,0.20)",
  },
  nextPillText: {
    fontSize: 12,
    fontWeight: "500",
  },
  featureBottom: {
    gap: 6,
  },
  featurePrayerName: {
    color: "#ffffff",
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: -0.8,
  },
  gaugeWrap: {
    marginTop: 10,
    alignItems: "center",
  },
  gaugeVisualArea: {
    position: "relative",
    alignItems: "center",
  },
  gaugeHalfMask: {
    overflow: "hidden",
    alignItems: "center",
  },
  gaugeCircleBase: {
    position: "relative",
  },
  gaugeSegment: {
    position: "absolute",
    width: 20,
    height: 4,
    borderRadius: 999,
  },
  gaugeSegmentActive: {
    shadowColor: "#B08968",
    shadowOpacity: 0.35,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  gaugeDotGlow: {
    position: "absolute",
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  gaugeDot: {
    position: "absolute",
    width: 9,
    height: 9,
    borderRadius: 999,
    borderWidth: 1.5,
  },
  gaugeCenterContent: {
    position: "absolute",
    top: 48,
    left: 0,
    right: 0,
    alignItems: "center",
    gap: 2,
  },
  arcEdgeLabels: {
    position: "absolute",
    top: 110,
    left: -20,
    right: -15,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  arcEdgeLabelText: {
    maxWidth: 84,
    color: "rgba(255,255,255,0.88)",
    fontSize: 11,
    fontWeight: "700",
  },
  arcEdgeLabelTextRight: {
    textAlign: "right",
  },
  gaugeBigTime: {
    fontSize: 34,
    fontWeight: "300",
    letterSpacing: -0.8,
  },
  gaugeCountdownText: {
    color: "rgba(255,255,255,0.92)",
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
  gaugeCountdownCode: {
    color: "rgba(255,255,255,0.76)",
    fontWeight: "700",
  },
  ramadanStar: {
    position: "absolute",
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.45)",
  },
  ramadanStarNight: {
    backgroundColor: "rgba(139,218,255,0.55)",
  },
  ramadanStarA: {
    top: 58,
    left: 46,
  },
  ramadanStarB: {
    top: 92,
    right: 54,
  },
  ramadanStarC: {
    top: 124,
    left: 70,
  },
  featureDetailsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 10,
  },
  featureTime: {
    fontSize: 30,
    fontWeight: "300",
    marginTop: 2,
  },
  featureCountdownRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  featureCountdownText: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "600",
  },
  locationBlock: {
    maxWidth: 130,
    alignItems: "flex-end",
  },
  locationLabel: {
    color: "#94a3b8",
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 1,
    fontWeight: "700",
  },
  locationValue: {
    color: "#e2e8f0",
    fontSize: 13,
    marginTop: 4,
  },
  dateRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 2,
  },
  dateTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  dateSub: {
    marginTop: 2,
    fontSize: 12,
  },
  errorBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  errorTitle: {
    color: "#ef4444",
    fontWeight: "700",
    fontSize: 13,
  },
  errorText: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 17,
  },
  prayerList: {
    gap: 10,
    paddingBottom: 6,
  },
  prayerItem: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  prayerItemActive: {
    borderLeftWidth: 4,
    borderLeftColor: "transparent",
    shadowColor: "transparent",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  prayerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  prayerIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  prayerName: {
    fontSize: 16,
    fontWeight: "500",
  },
  prayerNameActive: {
    fontWeight: "700",
  },
  prayerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  prayerTime: {
    fontSize: 16,
    fontWeight: "500",
  },
  prayerTimeActive: {
    fontWeight: "700",
  },
  emptyBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  emptySub: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 18,
  },
  rtlText: {
    writingDirection: "rtl",
    textAlign: "right",
  },
});
