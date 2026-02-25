import { useCallback, useMemo, useState } from "react";
import {
  Image,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { Stack, router } from "expo-router";

import { useI18n } from "../hooks/useI18n";
import { useAppTheme } from "../hooks/useAppTheme";
import {
  seekLatmiyatToMillis,
  toggleLatmiyatPlayback,
} from "../services/latmiyatPlayerService";
import { useAppStore } from "../store/appStore";

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

const formatMs = (ms: number): string => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${`${seconds}`.padStart(2, "0")}`;
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

export const LatmiyatPlayerScreen = () => {
  const theme = useAppTheme();
  const { t } = useI18n();
  const player = useAppStore((s) => s.latmiyatPlayer);
  const isIOS = Platform.OS === "ios";

  const [timelineWidth, setTimelineWidth] = useState(0);
  const [scrubProgress, setScrubProgress] = useState<number | null>(null);

  const progress = useMemo(
    () => (player.durationMillis > 0 ? clamp(player.positionMillis / player.durationMillis) : 0),
    [player.durationMillis, player.positionMillis],
  );
  const displayedProgress = scrubProgress ?? progress;
  const displayedPositionMillis =
    scrubProgress !== null && player.durationMillis > 0
      ? Math.floor(player.durationMillis * scrubProgress)
      : player.positionMillis;

  const seekToProgress = useCallback(
    async (nextProgress: number) => {
      if (player.durationMillis <= 0) return;
      const bounded = clamp(nextProgress);
      const targetMillis = Math.floor(player.durationMillis * bounded);
      await seekLatmiyatToMillis(targetMillis, player.isPlaying);
    },
    [player.durationMillis, player.isPlaying],
  );

  const onTimelineLayout = (event: LayoutChangeEvent) => {
    setTimelineWidth(event.nativeEvent.layout.width);
  };

  const onTimelinePress = useCallback(
    (x: number) => {
      if (!timelineWidth) return;
      const nextProgress = clamp(x / timelineWidth);
      setScrubProgress(nextProgress);
      void seekToProgress(nextProgress).finally(() => {
        setScrubProgress(null);
      });
    },
    [seekToProgress, timelineWidth],
  );

  const seekBy = useCallback(
    (deltaMs: number) => {
      const next = Math.max(0, Math.min(player.durationMillis || Number.MAX_SAFE_INTEGER, player.positionMillis + deltaMs));
      void seekLatmiyatToMillis(next, player.isPlaying);
    },
    [player.durationMillis, player.isPlaying, player.positionMillis],
  );

  const hasTrack = !!player.sourceUrl && !!player.trackId;

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
          headerLeft: () => null,
          headerRight: () => null,
          headerTitleAlign: "center",
        }}
      />
      {isIOS ? (
        <>
          <Stack.Screen.Title
            style={{
              color: theme.colors.textMuted,
              fontSize: 13,
              fontWeight: "700",
            }}
          >
            {t("latmiyat.nowPlaying")}
          </Stack.Screen.Title>

          <Stack.Toolbar placement="left">
            <Stack.Toolbar.Button icon="chevron.down" onPress={() => router.back()} />
          </Stack.Toolbar>

          <Stack.Toolbar placement="right">
            <Stack.Toolbar.Button
              icon="arrow.up.forward.app"
              onPress={() => {
                if (!player.trackUrl) return;
                void Linking.openURL(player.trackUrl);
              }}
            />
          </Stack.Toolbar>

          <Stack.Toolbar placement="bottom">
            <Stack.Toolbar.Button
              icon="gobackward.15"
              onPress={() => {
                if (!hasTrack) return;
                seekBy(-15000);
              }}
            />
            <Stack.Toolbar.Button
              icon={player.isLoading ? "hourglass" : player.isPlaying ? "pause.fill" : "play.fill"}
              onPress={() => {
                if (!hasTrack) return;
                void toggleLatmiyatPlayback();
              }}
            />
            <Stack.Toolbar.Button
              icon="goforward.15"
              onPress={() => {
                if (!hasTrack) return;
                seekBy(15000);
              }}
            />
          </Stack.Toolbar>
        </>
      ) : null}
      <SafeAreaView
        style={[styles.safe, { backgroundColor: isIOS ? "transparent" : theme.colors.background }]}
        edges={["top", "left", "right", "bottom"]}
      >
        {!isIOS ? (
          <View style={styles.topRow}>
            <Pressable onPress={() => router.back()} style={[styles.iconButton, { borderColor: theme.colors.border }]}>
              <MaterialIcons name="keyboard-arrow-down" size={26} color={theme.colors.text} />
            </Pressable>
            <Text style={[styles.nowPlayingLabel, { color: theme.colors.textMuted }]}>
              {t("latmiyat.nowPlaying")}
            </Text>
            <Pressable
              onPress={() => {
                if (!player.trackUrl) return;
                void Linking.openURL(player.trackUrl);
              }}
              disabled={!player.trackUrl}
              style={[
                styles.iconButton,
                { borderColor: theme.colors.border, opacity: player.trackUrl ? 1 : 0.4 },
              ]}
            >
              <MaterialIcons name="open-in-new" size={20} color={theme.colors.text} />
            </Pressable>
          </View>
        ) : null}

        <View
          style={[
            styles.artworkWrap,
            isIOS ? styles.artworkWrapSheet : null,
            { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
          ]}
        >
          {player.artworkUrl ? (
            <Image
              source={{ uri: player.artworkUrl }}
              style={styles.artwork}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.artworkFallback, { backgroundColor: hexToRgba(theme.colors.primary, 0.12) }]}>
              <MaterialIcons name="music-note" size={76} color={theme.colors.primary} />
            </View>
          )}
        </View>

        <View style={styles.metaWrap}>
          <Text style={[styles.title, isIOS ? styles.titleSheet : null, { color: theme.colors.text }]} numberOfLines={2}>
            {hasTrack ? player.title : t("latmiyat.noActiveTrack")}
          </Text>
          <Text style={[styles.artist, isIOS ? styles.artistSheet : null, { color: theme.colors.textMuted }]} numberOfLines={1}>
            {player.artistName || t("common.unknown")}
          </Text>
        </View>

        <View style={styles.seekWrap}>
          <Pressable
            onLayout={onTimelineLayout}
            onPress={(e) => onTimelinePress(e.nativeEvent.locationX)}
            onStartShouldSetResponder={() => true}
            onMoveShouldSetResponder={() => true}
            onResponderGrant={(e) => {
              if (!timelineWidth) return;
              setScrubProgress(clamp(e.nativeEvent.locationX / timelineWidth));
            }}
            onResponderMove={(e) => {
              if (!timelineWidth) return;
              setScrubProgress(clamp(e.nativeEvent.locationX / timelineWidth));
            }}
            onResponderRelease={(e) => {
              if (!timelineWidth) {
                setScrubProgress(null);
                return;
              }
              const nextProgress = clamp(e.nativeEvent.locationX / timelineWidth);
              setScrubProgress(nextProgress);
              void seekToProgress(nextProgress).finally(() => {
                setScrubProgress(null);
              });
            }}
            onResponderTerminate={() => setScrubProgress(null)}
            style={[styles.timelineTrack, { backgroundColor: theme.colors.border }]}
          >
            <View
              style={[
                styles.timelineFill,
                { width: `${displayedProgress * 100}%`, backgroundColor: theme.colors.primary },
              ]}
            />
            <View
              pointerEvents="none"
              style={[
                styles.timelineThumb,
                {
                  backgroundColor: theme.colors.primary,
                  left: Math.max(0, Math.min(Math.max(0, timelineWidth - 14), timelineWidth * displayedProgress - 7)),
                },
              ]}
            />
          </Pressable>

          <View style={styles.timeRow}>
            <Text style={[styles.timeText, { color: theme.colors.textMuted }]}>
              {formatMs(displayedPositionMillis)}
            </Text>
            <Text style={[styles.timeText, { color: theme.colors.textMuted }]}>
              {player.durationMillis > 0 ? formatMs(player.durationMillis) : "--:--"}
            </Text>
          </View>
        </View>

        {!isIOS ? (
          <View style={styles.controlsRow}>
            <Pressable
              onPress={() => seekBy(-15000)}
              disabled={!hasTrack}
              style={[styles.secondaryControl, { borderColor: theme.colors.border, opacity: hasTrack ? 1 : 0.4 }]}
            >
              <MaterialIcons name="replay-10" size={28} color={theme.colors.text} />
            </Pressable>

            <Pressable
              onPress={() => void toggleLatmiyatPlayback()}
              disabled={!hasTrack}
              style={[
                styles.primaryControl,
                { backgroundColor: theme.colors.primary, opacity: hasTrack ? 1 : 0.4 },
              ]}
            >
              <MaterialIcons
                name={player.isLoading ? "hourglass-empty" : player.isPlaying ? "pause" : "play-arrow"}
                size={36}
                color={theme.colors.background}
              />
            </Pressable>

            <Pressable
              onPress={() => seekBy(15000)}
              disabled={!hasTrack}
              style={[styles.secondaryControl, { borderColor: theme.colors.border, opacity: hasTrack ? 1 : 0.4 }]}
            >
              <MaterialIcons name="forward-10" size={28} color={theme.colors.text} />
            </Pressable>
          </View>
        ) : null}
      </SafeAreaView>
    </>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  nowPlayingLabel: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  artworkWrap: {
    marginTop: 10,
    width: "100%",
    aspectRatio: 1,
    borderRadius: 22,
    borderWidth: 1,
    overflow: "hidden",
    alignSelf: "center",
  },
  artworkWrapSheet: {
    width: 180,
    aspectRatio: 1,
    marginTop: 8,
    borderRadius: 18,
  },
  artwork: {
    width: "100%",
    height: "100%",
  },
  artworkFallback: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  metaWrap: {
    marginTop: 12,
    gap: 4,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "800",
  },
  titleSheet: {
    fontSize: 20,
    lineHeight: 24,
    textAlign: "center",
  },
  artist: {
    fontSize: 16,
    fontWeight: "600",
  },
  artistSheet: {
    fontSize: 14,
    textAlign: "center",
  },
  seekWrap: {
    marginTop: 12,
  },
  timelineTrack: {
    height: 7,
    borderRadius: 999,
    overflow: "visible",
    justifyContent: "center",
  },
  timelineFill: {
    height: 7,
    borderRadius: 999,
  },
  timelineThumb: {
    position: "absolute",
    top: -3.5,
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  timeRow: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  timeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  controlsRow: {
    marginTop: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 18,
  },
  primaryControl: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryControl: {
    flex: 1,
    height: 62,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
