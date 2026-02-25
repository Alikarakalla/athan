import { useMemo } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";

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

const DESIGN = {
  light: {
    bg: "#f6f8f7",
    text: "#0f172a",
    textMuted: "#64748b",
    headerBorder: "#e5e7eb",
    card: "#ffffff",
    cardBorder: "#f0f2f2",
    rowHover: "#f8fafc",
    primary: "#B08968",
    primaryTextDark: "#2F241A",
    surfaceDark: "#3A2D22",
    surfaceDarker: "#2F241A",
  },
  dark: {
    bg: "#1A1511",
    text: "#f8fafc",
    textMuted: "#94a3b8",
    headerBorder: "rgba(255,255,255,0.06)",
    card: "#2A2119",
    cardBorder: "rgba(255,255,255,0.06)",
    rowHover: "#241C15",
    primary: "#D0B089",
    primaryTextDark: "#2F241A",
    surfaceDark: "#2E241B",
    surfaceDarker: "#241C15",
  },
} as const;

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
  palette: (typeof DESIGN)[keyof typeof DESIGN];
  isDark: boolean;
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
  isDark,
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
  const dimArcColor = isNightTheme ? "rgba(139,218,255,0.14)" : "rgba(255,255,255,0.10)";
  const dotGlowColor = isNightTheme ? "rgba(139,218,255,0.30)" : "rgba(176,137,104,0.24)";

  return (
    <View
      style={[
        styles.featureCard,
        styles.heroGaugeCard,
        {
          backgroundColor: palette.surfaceDark,
          borderColor: "rgba(255,255,255,0.06)",
        },
      ]}
    >
      <View style={styles.heroNoiseLayer} />
      <View style={styles.heroGlowA} />
      <View style={styles.heroGlowB} />
      <View style={[styles.ramadanStar, styles.ramadanStarA, isNightTheme && styles.ramadanStarNight]} />
      <View style={[styles.ramadanStar, styles.ramadanStarB, isNightTheme && styles.ramadanStarNight]} />
      <View style={[styles.ramadanStar, styles.ramadanStarC, isNightTheme && styles.ramadanStarNight]} />
      <View style={styles.featureTopRow}>
        <View style={styles.topPillRow}>
          <View style={styles.nextPill}>
            <Text style={[styles.nextPillText, { color: palette.primary }]}>{nextPrayerPillLabel}</Text>
          </View>
        </View>
        <Pressable>
          <MaterialIcons
            name={notificationsEnabled ? "notifications-active" : "notifications-off"}
            size={22}
            color="rgba(255,255,255,0.8)"
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
                      },
                      isFilled && styles.gaugeSegmentActive,
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
                    borderColor: isDark ? palette.surfaceDark : "#0f172a",
                  },
                ]}
              />
            </View>
          </View>

          <View style={styles.gaugeCenterContent}>
            <Text style={styles.featurePrayerName}>{nextPrayerName}</Text>
            <Text style={[styles.gaugeBigTime, { color: "#FFFFFF" }]}>{nextPrayerTime}</Text>
            <Text style={styles.gaugeCountdownText}>
              {nextPrayerRelative} <Text style={styles.gaugeCountdownCode}>({countdownLabel})</Text>
            </Text>
          </View>

          <View style={styles.arcEdgeLabels} pointerEvents="none">
            <Text numberOfLines={1} style={styles.arcEdgeLabelText}>
              {previousPrayerName}
            </Text>
            <Text numberOfLines={1} style={[styles.arcEdgeLabelText, styles.arcEdgeLabelTextRight]}>
              {nextPrayerName}
            </Text>
          </View>
        </View>

      </View>
    </View>
  );
};

export const HomeScreen = () => {
  const prayerTimes = useAppStore((s) => s.prayerTimes);
  const manualCity = useAppStore((s) => s.manualCity);
  const notificationsEnabled = useAppStore((s) => s.notificationsEnabled);
  const prayerNotificationPrefs = useAppStore((s) => s.prayerNotificationPrefs);
  const togglePrayerNotificationEnabled = useAppStore((s) => s.togglePrayerNotificationEnabled);
  const themeMode = useAppStore((s) => s.themeMode);
  const { isLoading, error, nextPrayer, countdownLabel, refreshPrayerTimes } = usePrayerTimes();
  const { t, prayerName, locale, isRTL } = useI18n();

  const palette = themeMode === "light" ? DESIGN.light : DESIGN.dark;
  const isDark = themeMode !== "light";
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

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: palette.bg }]}
      edges={["left", "right"]}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
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
              isDark={isDark}
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
            <Pressable style={styles.headerIconBtn}>
              <MaterialIcons name="calendar-month" size={22} color={palette.textMuted} />
            </Pressable>
          </View>

          {!!error && (
            <View
              style={[
                styles.errorBox,
                {
                  backgroundColor: isDark ? "rgba(239,68,68,0.08)" : "#fff1f2",
                  borderColor: isDark ? "rgba(239,68,68,0.2)" : "#fecdd3",
                },
              ]}
            >
              <Text style={[styles.errorTitle, isRTL && styles.rtlText]}>{t("prayer.errorTitle")}</Text>
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
                      borderColor: isNext ? "rgba(176,137,104,0.30)" : palette.cardBorder,
                      opacity: isPassed ? 0.7 : 1,
                    },
                    isNext && styles.prayerItemActive,
                  ]}
                >
                  <View style={styles.prayerLeft}>
                    <View
                      style={[
                        styles.prayerIconWrap,
                        {
                          backgroundColor: isNext
                            ? (isDark ? "rgba(176,137,104,0.16)" : "rgba(176,137,104,0.10)")
                            : (isDark ? "rgba(255,255,255,0.05)" : "#f1f5f9"),
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
                        { color: palette.text },
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
                        { color: palette.text },
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
    paddingBottom: 24,
  },
  main: {
    paddingHorizontal: 20,
    paddingTop: 20,
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
    borderLeftColor: "#B08968",
    shadowColor: "#B08968",
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
