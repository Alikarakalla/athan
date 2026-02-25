import {
  createAudioPlayer,
  setAudioModeAsync,
  type AudioPlayer as ExpoAudioPlayer,
  type AudioStatus,
} from "expo-audio";

import { useAppStore } from "../store/appStore";

interface QuranTrackMeta {
  sourceUrl: string;
  surahNumber: number;
  surahName: string;
  totalAyahs: number;
}

let sharedPlayer: ExpoAudioPlayer | null = null;
let sharedSourceUrl: string | null = null;
let statusSubscription: { remove: () => void } | null = null;

const updateState = (patch: Partial<ReturnType<typeof useAppStore.getState>["quranPlayer"]>) => {
  useAppStore.getState().setQuranPlayerState(patch);
};

const configureAudioMode = async () => {
  await setAudioModeAsync({
    allowsRecording: false,
    playsInSilentMode: true,
    shouldPlayInBackground: true,
    interruptionMode: "doNotMix",
  });
};

const detachStatusSubscription = () => {
  if (!statusSubscription) return;
  try {
    statusSubscription.remove();
  } catch {
    // Ignore detach errors.
  }
  statusSubscription = null;
};

const attachStatusListener = (player: ExpoAudioPlayer) => {
  detachStatusSubscription();
  statusSubscription = player.addListener("playbackStatusUpdate", (status: AudioStatus) => {
    if (!status.isLoaded) return;
    updateState({
      isLoading: false,
      isPlaying: status.playing,
      positionMillis: status.currentTime * 1000,
      durationMillis: status.duration * 1000,
      error: null,
    });
  });
};

const teardownPlayer = () => {
  detachStatusSubscription();
  if (!sharedPlayer) return;
  try {
    sharedPlayer.remove();
  } catch {
    // Ignore cleanup errors.
  }
  sharedPlayer = null;
  sharedSourceUrl = null;
};

const applyTrackMeta = (meta: QuranTrackMeta) => {
  updateState({
    sourceUrl: meta.sourceUrl,
    surahNumber: meta.surahNumber,
    surahName: meta.surahName,
    totalAyahs: meta.totalAyahs,
    error: null,
  });
};

export const ensureQuranPlayback = async (opts: {
  track: QuranTrackMeta;
  startMillis?: number;
  shouldPlay?: boolean;
}) => {
  const { track, startMillis, shouldPlay } = opts;
  await configureAudioMode();
  applyTrackMeta(track);

  const hasStartMillis = typeof startMillis === "number";
  const safeStartMillis = Math.max(0, startMillis ?? 0);

  updateState({
    isLoading: true,
    error: null,
  });

  if (sharedPlayer && sharedSourceUrl === track.sourceUrl && sharedPlayer.isLoaded) {
    if (hasStartMillis) {
      await sharedPlayer.seekTo(safeStartMillis / 1000);
      updateState({ positionMillis: safeStartMillis });
    }
    if (shouldPlay === true) {
      sharedPlayer.play();
    } else if (shouldPlay === false) {
      sharedPlayer.pause();
    }
    updateState({ isLoading: false });
    return sharedPlayer;
  }

  teardownPlayer();

  const nextPlayer = createAudioPlayer(track.sourceUrl, { updateInterval: 250 });
  sharedPlayer = nextPlayer;
  sharedSourceUrl = track.sourceUrl;
  attachStatusListener(nextPlayer);

  if (hasStartMillis) {
    await nextPlayer.seekTo(safeStartMillis / 1000);
  }
  if (shouldPlay) {
    nextPlayer.play();
  }
  updateState({
    isLoading: false,
    isPlaying: !!shouldPlay,
  });
  return nextPlayer;
};

export const seekQuranToMillis = async (millis: number, shouldPlay?: boolean) => {
  if (!sharedPlayer || !sharedPlayer.isLoaded) return;
  const safeMillis = Math.max(0, millis);
  updateState({ isLoading: true, error: null });
  try {
    await sharedPlayer.seekTo(safeMillis / 1000);
    if (shouldPlay === true) {
      sharedPlayer.play();
    } else if (shouldPlay === false) {
      sharedPlayer.pause();
    }
    updateState({
      isLoading: false,
      positionMillis: safeMillis,
    });
  } catch (error) {
    updateState({
      isLoading: false,
      error: error instanceof Error ? error.message : "Unable to seek audio",
    });
    throw error;
  }
};

export const toggleQuranPlayback = async () => {
  if (!sharedPlayer || !sharedPlayer.isLoaded) return;
  if (sharedPlayer.playing) {
    sharedPlayer.pause();
    updateState({ isPlaying: false });
  } else {
    sharedPlayer.play();
    updateState({ isPlaying: true });
  }
};

export const pauseQuranPlayback = () => {
  if (!sharedPlayer || !sharedPlayer.isLoaded) return;
  sharedPlayer.pause();
  updateState({ isPlaying: false });
};

export const resumeQuranPlayback = () => {
  if (!sharedPlayer || !sharedPlayer.isLoaded) return;
  sharedPlayer.play();
  updateState({ isPlaying: true });
};

export const setQuranCurrentAyah = (ayahNumber: number | null) => {
  updateState({ currentAyah: ayahNumber });
};

export const isQuranTrackActive = (sourceUrl?: string | null) =>
  !!sourceUrl && sourceUrl === sharedSourceUrl && !!sharedPlayer && sharedPlayer.isLoaded;
