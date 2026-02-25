import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import {
  Audio,
  InterruptionModeAndroid,
  InterruptionModeIOS,
  type AVPlaybackStatusSuccess,
} from "expo-av";

import { useAppTheme } from "../hooks/useAppTheme";
import { Card } from "./Card";

interface AudioPlayerProps {
  ayahAudioUrls: string[];
  title?: string;
  subtitle?: string;
}

export const AudioPlayer = ({ ayahAudioUrls, title = "Surah Audio", subtitle }: AudioPlayerProps) => {
  const theme = useAppTheme();
  const soundRef = useRef<Audio.Sound | null>(null);
  const queueRef = useRef<string[]>(ayahAudioUrls);
  const currentIndexRef = useRef(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    queueRef.current = ayahAudioUrls;
    currentIndexRef.current = 0;
    setCurrentIndex(0);
    setIsPlaying(false);
    setError(null);

    const reset = async () => {
      if (soundRef.current) {
        try {
          await soundRef.current.unloadAsync();
        } catch {
          // Ignore cleanup errors.
        }
        soundRef.current = null;
      }
    };
    void reset();
  }, [ayahAudioUrls]);

  const totalTracks = useMemo(() => ayahAudioUrls.length, [ayahAudioUrls.length]);

  const unloadCurrent = useCallback(async () => {
    if (!soundRef.current) return;
    try {
      await soundRef.current.unloadAsync();
    } finally {
      soundRef.current = null;
    }
  }, []);

  const playIndex = useCallback(
    async (index: number) => {
      if (!queueRef.current[index]) return;
      setIsLoading(true);
      setError(null);

      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
          interruptionModeIOS: InterruptionModeIOS.DoNotMix,
          shouldDuckAndroid: true,
        });

        await unloadCurrent();

        const { sound } = await Audio.Sound.createAsync(
          { uri: queueRef.current[index] },
          { shouldPlay: true },
          async (status) => {
            if (!status.isLoaded) return;
            const loadedStatus = status as AVPlaybackStatusSuccess;
            setIsPlaying(loadedStatus.isPlaying);

            if (loadedStatus.didJustFinish) {
              const nextIndex = currentIndexRef.current + 1;
              if (queueRef.current[nextIndex]) {
                currentIndexRef.current = nextIndex;
                setCurrentIndex(nextIndex);
                await playIndex(nextIndex);
              } else {
                setIsPlaying(false);
                setCurrentIndex(0);
                currentIndexRef.current = 0;
                await unloadCurrent();
              }
            }
          },
        );

        soundRef.current = sound;
        currentIndexRef.current = index;
        setCurrentIndex(index);
        setIsPlaying(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to play audio");
        setIsPlaying(false);
      } finally {
        setIsLoading(false);
      }
    },
    [unloadCurrent],
  );

  const handlePlayPause = useCallback(async () => {
    if (!queueRef.current.length) return;

    try {
      if (!soundRef.current) {
        await playIndex(currentIndexRef.current);
        return;
      }

      const status = await soundRef.current.getStatusAsync();
      if (!status.isLoaded) {
        await playIndex(currentIndexRef.current);
        return;
      }

      if (status.isPlaying) {
        await soundRef.current.pauseAsync();
        setIsPlaying(false);
      } else {
        await soundRef.current.playAsync();
        setIsPlaying(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Audio action failed");
    }
  }, [playIndex]);

  const handleStop = useCallback(async () => {
    setIsPlaying(false);
    setCurrentIndex(0);
    currentIndexRef.current = 0;
    await unloadCurrent();
  }, [unloadCurrent]);

  useEffect(() => {
    return () => {
      void unloadCurrent();
    };
  }, [unloadCurrent]);

  return (
    <Card>
      <View style={styles.headerRow}>
        <View style={styles.headerCopy}>
          <Text style={[styles.title, { color: theme.colors.text }]}>{title}</Text>
          {subtitle ? <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>{subtitle}</Text> : null}
          <Text style={[styles.progress, { color: theme.colors.textMuted }]}>
            {totalTracks ? `Ayah ${Math.min(currentIndex + 1, totalTracks)} / ${totalTracks}` : "No audio"}
          </Text>
        </View>
        {isLoading ? <ActivityIndicator size="small" color={theme.colors.primary} /> : null}
      </View>

      <View style={styles.controlsRow}>
        <Pressable
          onPress={handlePlayPause}
          disabled={!totalTracks || isLoading}
          style={({ pressed }) => [
            styles.primaryButton,
            { backgroundColor: theme.colors.primary, opacity: pressed ? 0.85 : 1 },
            (!totalTracks || isLoading) && styles.disabled,
          ]}
        >
          <Text style={styles.primaryButtonText}>{isPlaying ? "Pause" : "Play"}</Text>
        </Pressable>

        <Pressable
          onPress={handleStop}
          disabled={isLoading && !soundRef.current}
          style={({ pressed }) => [
            styles.secondaryButton,
            { borderColor: theme.colors.border, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Text style={[styles.secondaryButtonText, { color: theme.colors.text }]}>Stop</Text>
        </Pressable>
      </View>

      {error ? <Text style={[styles.errorText, { color: theme.colors.danger }]}>{error}</Text> : null}
    </Card>
  );
};

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  headerCopy: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 13,
  },
  progress: {
    fontSize: 12,
    marginTop: 2,
  },
  controlsRow: {
    marginTop: 12,
    flexDirection: "row",
    gap: 10,
  },
  primaryButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  secondaryButton: {
    paddingHorizontal: 18,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    fontWeight: "600",
  },
  disabled: {
    opacity: 0.5,
  },
  errorText: {
    marginTop: 10,
    fontSize: 12,
  },
});
