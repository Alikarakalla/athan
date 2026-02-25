import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { GestureResponderEvent } from "react-native";

import { useAppTheme } from "../hooks/useAppTheme";
import { toggleLatmiyatPlayback } from "../services/latmiyatPlayerService";
import { useAppStore } from "../store/appStore";

const formatMs = (ms: number): string => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${`${seconds}`.padStart(2, "0")}`;
};

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

export const LatmiyatBottomAccessory = () => {
  const theme = useAppTheme();
  const player = useAppStore((s) => s.latmiyatPlayer);
  const placement = NativeTabs.BottomAccessory.usePlacement();
  const isVisible = player.isLoading || player.isPlaying;

  if (!player.sourceUrl || !player.trackId || !isVisible) {
    return null;
  }

  const isInline = placement === "inline";
  const progress = player.durationMillis > 0 ? clamp(player.positionMillis / player.durationMillis) : 0;
  const iconName = player.isPlaying ? "pause" : "play-arrow";
  const iconSize = isInline ? 18 : 21;

  const handleOpenLatmiyat = () => {
    router.push("/latmiyat-player");
  };

  const handleTogglePlayback = (event: GestureResponderEvent) => {
    event.stopPropagation();
    void toggleLatmiyatPlayback();
  };

  return (
    <Pressable
      key={`${placement}:${player.trackId}:${player.isPlaying ? "play" : "pause"}`}
      onPress={handleOpenLatmiyat}
      style={[
        styles.container,
        isInline ? styles.inlineContainer : styles.regularContainer,
        {
          backgroundColor: "rgba(0,0,0,0.001)",
          borderColor: "transparent",
          borderWidth: 0,
        },
      ]}
    >
      <Pressable
        onPress={handleTogglePlayback}
        hitSlop={8}
        style={[
          styles.playButton,
          isInline ? styles.playButtonInline : null,
          {
            backgroundColor: theme.colors.primary,
          },
        ]}
      >
        <MaterialIcons
          name={iconName}
          size={iconSize}
          style={[styles.iconGlyph, iconName === "play-arrow" ? styles.playIconNudge : styles.pauseIconNudge]}
          color={theme.colors.background}
        />
      </Pressable>

      <View style={styles.content}>
        <Text style={[styles.title, { color: theme.colors.text }]} numberOfLines={1} ellipsizeMode="tail">
          {player.title}
        </Text>
        {!isInline ? (
          <Text style={[styles.subtitle, { color: theme.colors.textMuted }]} numberOfLines={1} ellipsizeMode="tail">
            {player.artistName} • {formatMs(player.positionMillis)} /{" "}
            {player.durationMillis > 0 ? formatMs(player.durationMillis) : "--:--"}
          </Text>
        ) : null}
        <View style={[styles.progressTrack, { backgroundColor: theme.colors.border }]}>
          <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: theme.colors.primary }]} />
        </View>
      </View>

      <View style={styles.trailingIconWrap}>
        <MaterialIcons name="chevron-right" size={20} style={styles.chevronNudge} color={theme.colors.textMuted} />
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    alignSelf: "stretch",
    height: "100%",
    borderWidth: 0,
    borderRadius: 22,
    marginHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 0,
  },
  regularContainer: {
    minHeight: 0,
  },
  inlineContainer: {
    minHeight: 0,
  },
  playButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
  playButtonInline: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  iconGlyph: {
    textAlignVertical: "center",
  },
  playIconNudge: {
    marginLeft: 1,
  },
  pauseIconNudge: {
    marginTop: -0.5,
  },
  content: {
    flex: 1,
    minWidth: 0,
    gap: 3,
    justifyContent: "center",
    overflow: "hidden",
  },
  title: {
    fontSize: 15,
    lineHeight: 19,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: "500",
  },
  progressTrack: {
    marginTop: 2,
    height: 4,
    borderRadius: 99,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 99,
  },
  trailingIconWrap: {
    width: 26,
    height: 26,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
  chevronNudge: {
    marginTop: -1,
  },
});
