import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Location from "expo-location";

import { useI18n } from "../hooks/useI18n";
import { useAppTheme } from "../hooks/useAppTheme";
import { useAppStore } from "../store/appStore";
import type { Coordinates } from "../types/prayer";
import { calculateQiblaBearing, normalizeDegrees, relativeQiblaAngle } from "../utils/qibla";

const QIBLA_UI = {
  light: {
    bg: "#f4efe6",
    panel: "#fffaf0",
    ring: "#f7f0e4",
    ringBorder: "#dccfb9",
    text: "#2a2118",
    muted: "#776a58",
    primary: "#B08968",
    primaryDark: "#2F241A",
    accent: "#8B6A46",
    grid: "rgba(139,106,70,0.08)",
  },
  dark: {
    bg: "#1A1511",
    panel: "#241C15",
    ring: "#2E241B",
    ringBorder: "rgba(255,255,255,0.08)",
    text: "#f8fafc",
    muted: "#bba98f",
    primary: "#D0B089",
    primaryDark: "#2F241A",
    accent: "#D6B489",
    grid: "rgba(176,137,104,0.08)",
  },
} as const;

export const QiblaScreen = () => {
  const theme = useAppTheme();
  const { t } = useI18n();
  const palette = theme.mode === "dark" ? QIBLA_UI.dark : QIBLA_UI.light;
  const savedCoords = useAppStore((s) => s.coordinates);
  const setCoordinates = useAppStore((s) => s.setCoordinates);
  const setLocationPermission = useAppStore((s) => s.setLocationPermission);
  const manualCity = useAppStore((s) => s.manualCity);

  const [coords, setCoords] = useState<Coordinates | null>(savedCoords);
  const [heading, setHeading] = useState<number>(0);
  const [headingAccuracy, setHeadingAccuracy] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [headingStatus, setHeadingStatus] = useState<"watch" | "poll" | "unavailable">("watch");

  const qiblaBearing = useMemo(() => (coords ? calculateQiblaBearing(coords) : null), [coords]);
  const qiblaRelative = useMemo(
    () => (qiblaBearing == null ? null : relativeQiblaAngle(heading, qiblaBearing)),
    [heading, qiblaBearing],
  );

  const isAligned = qiblaRelative != null && (qiblaRelative <= 5 || qiblaRelative >= 355);

  const resolveCoordinates = async (): Promise<{ coords: Coordinates; source: "gps" | "lastKnown" | "saved" }> => {
    const servicesEnabled = await Location.hasServicesEnabledAsync();
    if (!servicesEnabled) {
      if (savedCoords) {
        return { coords: savedCoords, source: "saved" };
      }
      throw new Error("Location services are off. Turn on GPS/location services and try again.");
    }

    try {
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      return {
        coords: { latitude: pos.coords.latitude, longitude: pos.coords.longitude },
        source: "gps",
      };
    } catch {
      const lastKnown = await Location.getLastKnownPositionAsync({
        maxAge: 1000 * 60 * 60 * 6,
      });
      if (lastKnown) {
        return {
          coords: { latitude: lastKnown.coords.latitude, longitude: lastKnown.coords.longitude },
          source: "lastKnown",
        };
      }
      if (savedCoords) {
        return { coords: savedCoords, source: "saved" };
      }
      throw new Error(
        "Cannot obtain current location. Go outside / enable high accuracy location, then try again.",
      );
    }
  };

  useEffect(() => {
    let cancelled = false;
    let headingSub: { remove: () => void } | null = null;
    let headingTimeout: ReturnType<typeof setTimeout> | null = null;
    let headingPollInterval: ReturnType<typeof setInterval> | null = null;
    let hasReceivedHeading = false;

    const applyHeading = (result: { trueHeading: number; magHeading: number; accuracy?: number }) => {
      const nextHeading =
        Number.isFinite(result.trueHeading) && result.trueHeading >= 0
          ? result.trueHeading
          : result.magHeading;
      setHeading(normalizeDegrees(nextHeading));
      setHeadingAccuracy(result.accuracy ?? null);
      hasReceivedHeading = true;
      setIsLoading(false);
    };

    const startHeadingPollingFallback = () => {
      if (headingPollInterval) return;
      setHeadingStatus("poll");

      const poll = async () => {
        try {
          const result = await Location.getHeadingAsync();
          if (cancelled) return;
          applyHeading(result);
        } catch {
          if (!cancelled) {
            setHeadingStatus("unavailable");
            setError((prev) => prev ?? "Compass sensor unavailable. Qibla bearing is still shown using your saved location.");
            setIsLoading(false);
          }
        }
      };

      void poll();
      headingPollInterval = setInterval(() => {
        void poll();
      }, 1500);
    };

    const start = async () => {
      setIsLoading(true);
      setError(null);
      setHeadingStatus("watch");
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        const granted = permission.status === "granted";
        setLocationPermission(granted ? "granted" : "denied");

        if (!granted) {
          if (savedCoords) {
            setCoords(savedCoords);
          } else {
            throw new Error("Location permission denied. Enable location for exact Qibla direction.");
          }
        } else {
          const resolved = await resolveCoordinates();
          const nextCoords = resolved.coords;
          if (!cancelled) {
            setCoords(nextCoords);
            setCoordinates(nextCoords);
            if (resolved.source !== "gps") {
              setError(
                resolved.source === "lastKnown"
                  ? "Using last known location (GPS fix unavailable right now)."
                  : "Using saved location (current GPS unavailable).",
              );
            }
          }
        }

        if (!cancelled) {
          // Render the compass UI as soon as coordinates are available.
          setIsLoading(false);
        }

        // Do not block the screen loading state waiting for the first compass event.
        headingTimeout = setTimeout(() => {
          if (!cancelled) {
            if (!hasReceivedHeading) {
              startHeadingPollingFallback();
            } else {
              setIsLoading(false);
            }
          }
        }, 1200);

        void Location.watchHeadingAsync((result) => {
          if (cancelled) return;
          setHeadingStatus("watch");
          applyHeading(result);
        })
          .then((subscription) => {
            if (cancelled) {
              subscription.remove();
              return;
            }
            headingSub = subscription;
          })
          .catch((watchError) => {
            if (cancelled) return;
            setError((prev) => prev ?? (watchError instanceof Error ? `Compass watch failed: ${watchError.message}` : "Compass watch failed"));
            startHeadingPollingFallback();
          });
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unable to load Qibla compass");
        }
      } finally {
        // If heading watcher is still initializing, timeout/callback will end loading.
        if (!cancelled && headingTimeout == null) setIsLoading(false);
      }
    };

    void start();

    return () => {
      cancelled = true;
      if (headingTimeout) clearTimeout(headingTimeout);
      if (headingPollInterval) clearInterval(headingPollInterval);
      headingSub?.remove();
    };
  }, [savedCoords, setCoordinates, setLocationPermission]);

  const handleRefresh = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      const granted = permission.status === "granted";
      setLocationPermission(granted ? "granted" : "denied");
      if (!granted) throw new Error("Location permission denied");
      const resolved = await resolveCoordinates();
      const nextCoords = resolved.coords;
      setCoords(nextCoords);
      setCoordinates(nextCoords);
      if (resolved.source !== "gps") {
        setError(
          resolved.source === "lastKnown"
            ? "Using last known location (GPS fix unavailable right now)."
            : "Using saved location (current GPS unavailable).",
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to refresh location");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.bg }]} edges={["top"]}>
      <View style={[styles.bgDecor, { backgroundColor: palette.grid }]} />

      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={[styles.iconBtn, { backgroundColor: palette.panel, borderColor: palette.ringBorder }]}>
          <MaterialIcons name="arrow-back" size={24} color={palette.text} />
        </Pressable>

        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: palette.text }]}>{t("qibla.title")}</Text>
          <Text style={[styles.headerSubtitle, { color: palette.muted }]}>
            {t("qibla.subtitle")}
          </Text>
        </View>

        <Pressable onPress={() => void handleRefresh()} style={[styles.iconBtn, { backgroundColor: palette.panel, borderColor: palette.ringBorder }]}>
          <MaterialIcons name="my-location" size={22} color={palette.text} />
        </Pressable>
      </View>

      <View style={[styles.mainCard, { backgroundColor: palette.panel, borderColor: palette.ringBorder }]}>
        {isLoading && !coords ? (
          <View style={styles.centerState}>
            <ActivityIndicator color={palette.primary} />
            <Text style={[styles.stateText, { color: palette.muted }]}>{t("qibla.calibrating")}</Text>
          </View>
        ) : error && !coords ? (
          <View style={styles.centerState}>
            <MaterialIcons name="explore-off" size={30} color={palette.muted} />
            <Text style={[styles.stateTitle, { color: palette.text }]}>{t("qibla.unavailable")}</Text>
            <Text style={[styles.stateText, { color: palette.muted }]}>{error}</Text>
            {!!manualCity ? (
              <Text style={[styles.stateText, { color: palette.muted }]}>
                {t("qibla.manualCityNeedsGps")}
              </Text>
            ) : null}
          </View>
        ) : (
          <>
            <View style={styles.compassWrap}>
              <View style={[styles.compassOuter, { backgroundColor: palette.ring, borderColor: palette.ringBorder }]}>
                <View style={[styles.compassInner, { borderColor: palette.ringBorder }]}>
                  <View style={[styles.northMarker, { backgroundColor: palette.accent }]} />
                  <Text style={[styles.nLabel, { color: palette.text }]}>N</Text>
                  <Text style={[styles.eLabel, { color: palette.muted }]}>E</Text>
                  <Text style={[styles.sLabel, { color: palette.muted }]}>S</Text>
                  <Text style={[styles.wLabel, { color: palette.muted }]}>W</Text>

                  <View
                    style={[
                      styles.qiblaNeedle,
                      {
                        transform: [{ rotate: `${qiblaRelative ?? 0}deg` }],
                      },
                    ]}
                  >
                    <View style={[styles.needleStem, { backgroundColor: isAligned ? palette.primary : palette.text }]} />
                    <View style={[styles.needleHead, { borderBottomColor: palette.primary }]} />
                  </View>

                  <View style={[styles.centerDot, { backgroundColor: palette.primary }]} />
                </View>
              </View>
            </View>

            <View style={styles.metricsGrid}>
              <View style={[styles.metricCard, { backgroundColor: palette.ring, borderColor: palette.ringBorder }]}>
                <Text style={[styles.metricLabel, { color: palette.muted }]}>{t("qibla.bearing")}</Text>
                <Text style={[styles.metricValue, { color: palette.text }]}>
                  {qiblaBearing != null ? `${Math.round(qiblaBearing)}°` : "--"}
                </Text>
              </View>

              <View style={[styles.metricCard, { backgroundColor: palette.ring, borderColor: palette.ringBorder }]}>
                <Text style={[styles.metricLabel, { color: palette.muted }]}>{t("qibla.heading")}</Text>
                <Text style={[styles.metricValue, { color: palette.text }]}>
                  {Number.isFinite(heading) ? `${Math.round(heading)}°` : "--"}
                </Text>
              </View>

              <View style={[styles.metricCardWide, { backgroundColor: palette.ring, borderColor: palette.ringBorder }]}>
                <View>
                  <Text style={[styles.metricLabel, { color: palette.muted }]}>{t("qibla.alignment")}</Text>
                  <Text style={[styles.metricValue, { color: isAligned ? palette.primary : palette.text }]}>
                    {isAligned ? t("qibla.facing") : qiblaRelative != null ? t("qibla.rightOfNorth", { deg: Math.round(qiblaRelative) }) : "--"}
                  </Text>
                </View>
                <View
                  style={[
                    styles.alignmentBadge,
                    {
                      backgroundColor: isAligned ? "rgba(176,137,104,0.16)" : "transparent",
                      borderColor: isAligned ? "rgba(176,137,104,0.3)" : palette.ringBorder,
                    },
                  ]}
                >
                  <Text style={[styles.alignmentBadgeText, { color: isAligned ? palette.primary : palette.muted }]}>
                    {isAligned ? t("qibla.aligned") : t("qibla.adjust")}
                  </Text>
                </View>
              </View>
            </View>

            <View style={[styles.infoCard, { backgroundColor: palette.ring, borderColor: palette.ringBorder }]}>
              <Text style={[styles.infoTitle, { color: palette.text }]}>{t("qibla.accuracyTitle")}</Text>
              {isLoading ? (
                <Text style={[styles.infoText, { color: palette.muted }]}>
                  {t("qibla.calibratingSensor")}
                </Text>
              ) : null}
              <Text style={[styles.infoText, { color: palette.muted }]}>
                {headingAccuracy != null
                  ? t("qibla.sensorAccuracy", { n: Math.round(headingAccuracy) })
                  : t("qibla.figureEight")}
              </Text>
              <Text style={[styles.coordsText, { color: palette.muted }]}>
                {t("qibla.compassMode", {
                  mode:
                    headingStatus === "watch"
                      ? t("qibla.mode.watch")
                      : headingStatus === "poll"
                        ? t("qibla.mode.poll")
                        : t("qibla.mode.unavailable"),
                })}
              </Text>
              {coords ? (
                <Text style={[styles.coordsText, { color: palette.muted }]}>
                  {t("qibla.gps", { lat: coords.latitude.toFixed(5), lng: coords.longitude.toFixed(5) })}
                </Text>
              ) : null}
              {error ? <Text style={[styles.coordsText, { color: "#ef4444" }]}>{error}</Text> : null}
            </View>
          </>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  bgDecor: {
    position: "absolute",
    top: -140,
    left: -80,
    right: -80,
    height: 260,
    borderBottomLeftRadius: 180,
    borderBottomRightRadius: 180,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
  },
  headerSubtitle: {
    marginTop: 2,
    fontSize: 12,
  },
  mainCard: {
    flex: 1,
    margin: 16,
    marginTop: 18,
    borderWidth: 1,
    borderRadius: 22,
    padding: 16,
  },
  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 12,
  },
  stateTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  stateText: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },
  compassWrap: {
    alignItems: "center",
    marginTop: 6,
    marginBottom: 14,
  },
  compassOuter: {
    width: 286,
    height: 286,
    borderRadius: 143,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  compassInner: {
    width: 246,
    height: 246,
    borderRadius: 123,
    borderWidth: 1,
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  northMarker: {
    position: "absolute",
    top: 12,
    width: 4,
    height: 28,
    borderRadius: 2,
  },
  nLabel: {
    position: "absolute",
    top: 44,
    fontSize: 14,
    fontWeight: "800",
  },
  eLabel: {
    position: "absolute",
    right: 18,
    top: 114,
    fontSize: 13,
    fontWeight: "700",
  },
  sLabel: {
    position: "absolute",
    bottom: 14,
    fontSize: 13,
    fontWeight: "700",
  },
  wLabel: {
    position: "absolute",
    left: 18,
    top: 114,
    fontSize: 13,
    fontWeight: "700",
  },
  qiblaNeedle: {
    position: "absolute",
    width: 220,
    height: 220,
    alignItems: "center",
    justifyContent: "center",
  },
  needleStem: {
    position: "absolute",
    width: 4,
    height: 92,
    top: 18,
    borderRadius: 2,
  },
  needleHead: {
    position: "absolute",
    top: 2,
    width: 0,
    height: 0,
    borderLeftWidth: 13,
    borderRightWidth: 13,
    borderBottomWidth: 24,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
  },
  centerDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  metricCard: {
    flex: 1,
    minWidth: 120,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  metricCardWide: {
    width: "100%",
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  metricValue: {
    marginTop: 4,
    fontSize: 18,
    fontWeight: "800",
  },
  alignmentBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  alignmentBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  infoCard: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  infoText: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 18,
  },
  coordsText: {
    marginTop: 6,
    fontSize: 11,
  },
});
