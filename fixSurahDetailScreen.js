const fs = require('fs');

let content = fs.readFileSync('src/screens/SurahDetailScreen.tsx', 'utf-8');

// Replace imports
content = content.replace(
    /import \{\n  Audio,\n  InterruptionModeAndroid,\n  InterruptionModeIOS,\n  type AVPlaybackStatus,\n  type AVPlaybackStatusSuccess,\n\} from "expo-av";/,
    `import {\n  createAudioPlayer,\n  setAudioModeAsync,\n  type AudioPlayer as ExpoAudioPlayer,\n  type AudioStatus\n} from "expo-audio";`
);

// Replace soundRef
content = content.replace(
    /const soundRef = useRef<Audio\.Sound \| null>\(null\);/,
    `const soundRef = useRef<ExpoAudioPlayer | null>(null);`
);

// Replace loop in loadTimingProfile
content = content.replace(
    /          let sound: Audio\.Sound \| null = null;\n          try \{\n            const created = await Audio\.Sound\.createAsync\(\n              \{ uri \},\n              \{ shouldPlay: false, progressUpdateIntervalMillis: 50 \},\n            \);\n            sound = created\.sound;\n            const status = await sound\.getStatusAsync\(\);\n            durations\.push\(status\.isLoaded \? status\.durationMillis \?\? 0 : 0\);\n          \} catch \{\n            durations\.push\(0\);\n          \} finally \{\n            if \(sound\) \{\n              try \{\n                await sound\.unloadAsync\(\);\n              \} catch \{\n                \/\/ no-op\n              \}\n            \}\n          \}/g,
    `          try {
            const sound = createAudioPlayer(uri);
            await new Promise((resolve) => {
              const listener = sound.addListener('playbackStatusUpdate', (status) => {
                if (status.isLoaded) {
                  listener.remove();
                  resolve(status);
                }
              });
              setTimeout(() => { listener.remove(); resolve(null); }, 3000);
            });
            durations.push(sound.duration ? sound.duration * 1000 : 0);
            sound.remove();
          } catch {
            durations.push(0);
          }
`
);

// Replace configureAudioMode
content = content.replace(
    /  const configureAudioMode = useCallback\(async \(\) => \{\n    await Audio\.setAudioModeAsync\(\{\n      allowsRecordingIOS: false,\n      playsInSilentModeIOS: true,\n      staysActiveInBackground: false,\n      interruptionModeAndroid: InterruptionModeAndroid\.DoNotMix,\n      interruptionModeIOS: InterruptionModeIOS\.DoNotMix,\n      shouldDuckAndroid: true,\n    \}\);\n  \}, \[\]\);/,
    `  const configureAudioMode = useCallback(async () => {
    await setAudioModeAsync({
      allowsRecording: false,
      playsInSilentMode: true,
      shouldPlayInBackground: false,
      interruptionMode: 'doNotMix',
    });
  }, []);`
);

// Replace unloadSound
content = content.replace(
    /  const unloadSound = useCallback\(async \(\) => \{\n    const sound = soundRef\.current;\n    if \(\!sound\) return;\n    soundRef\.current = null;\n    try \{\n      await sound\.unloadAsync\(\);\n    \} catch \{\n      \/\/ Ignore cleanup errors\.\n    \}\n  \}, \[\]\);/,
    `  const unloadSound = useCallback(async () => {
    const sound = soundRef.current;
    if (!sound) return;
    soundRef.current = null;
    try {
      sound.remove();
    } catch {
      // Ignore cleanup errors.
    }
  }, []);`
);

// Replace ensureFullSurahSound
content = content.replace(
    /      if \(soundRef\.current\) \{\n        const existingStatus = await soundRef\.current\.getStatusAsync\(\);\n        if \(existingStatus\.isLoaded\) \{\n          if \(hasStartMillis\) \{\n            await soundRef\.current\.setPositionAsync\(startMillis\);\n            setPositionMillis\(startMillis\);\n          \}\n          if \(shouldPlay === true\) \{\n            await soundRef\.current\.playAsync\(\);\n          \} else if \(shouldPlay === false\) \{\n            await soundRef\.current\.pauseAsync\(\);\n          \}\n          return soundRef\.current;\n        \}\n      \}\n\n      await unloadSound\(\);\n\n      const onStatusUpdate = \(status: AVPlaybackStatus\) => \{\n        if \(\!status\.isLoaded\) return;\n        const loaded = status as AVPlaybackStatusSuccess;\n        setIsAudioPlaying\(loaded\.isPlaying\);\n        setPositionMillis\(loaded\.positionMillis \?\? 0\);\n        setDurationMillis\(loaded\.durationMillis \?\? 0\);\n\n        if \(loaded\.didJustFinish && \!loaded\.isLooping\) \{\n          setIsAudioPlaying\(false\);\n          setPositionMillis\(loaded\.durationMillis \?\? 0\);\n        \}\n      \};\n\n      const \{ sound, status \} = await Audio\.Sound\.createAsync\(\n        \{ uri: audioTrack\.fullSurahUrl \},\n        \{\n          shouldPlay: shouldPlay \?\? false,\n          positionMillis: startMillis,\n          progressUpdateIntervalMillis: 250,\n        \},\n        onStatusUpdate,\n      \);\n      soundRef\.current = sound;\n\n      if \(status\.isLoaded\) \{\n        setPositionMillis\(status\.positionMillis \?\? 0\);\n        setDurationMillis\(status\.durationMillis \?\? 0\);\n        setIsAudioPlaying\(status\.isPlaying\);\n        if \(\(status\.durationMillis \?\? 0\) > 0 && \(status\.positionMillis \?\? 0\) > 0\) \{\n          const idx = audioTrack\.verseTimestamps\?\.length\n            \? findCurrentAyahIndexByTimestamps\(audioTrack\.verseTimestamps, status\.positionMillis \?\? 0\)\n            : findCurrentAyahIndexByProgress\(\n                ayahStartFractions,\n                \(status\.positionMillis \?\? 0\) \/ Math\.max\(1, status\.durationMillis \?\? 1\),\n              \);\n          currentAyahIndexRef\.current = idx;\n          setCurrentAudioIndex\(idx\);\n        \}\n      \}\n\n      return sound;\n    \},/,
    `      if (soundRef.current) {
        if (soundRef.current.isLoaded) {
          if (hasStartMillis) {
            await soundRef.current.seekTo(startMillis / 1000);
            setPositionMillis(startMillis);
          }
          if (shouldPlay === true) {
            soundRef.current.play();
          } else if (shouldPlay === false) {
            soundRef.current.pause();
          }
          return soundRef.current;
        }
      }

      await unloadSound();

      const sound = createAudioPlayer(audioTrack.fullSurahUrl, {
        updateInterval: 250,
      });

      const onStatusUpdate = (status: AudioStatus) => {
        if (!status.isLoaded) return;
        setIsAudioPlaying(status.playing);
        setPositionMillis(status.currentTime * 1000);
        setDurationMillis(status.duration * 1000);

        if (status.didJustFinish && !status.loop) {
          setIsAudioPlaying(false);
          setPositionMillis(status.duration * 1000);
        }
      };

      sound.addListener('playbackStatusUpdate', onStatusUpdate);
      
      if (hasStartMillis) {
        await sound.seekTo(startMillis / 1000);
      }
      if (shouldPlay) {
        sound.play();
      }

      soundRef.current = sound;

      return sound;
    },`
);

// Replace seekToProgress
content = content.replace(
    /        if \(targetMillis === 0 && durationMillis <= 0\) \{\n          const freshStatus = await sound\.getStatusAsync\(\);\n          if \(freshStatus\.isLoaded && freshStatus\.durationMillis\) \{\n            const resolvedTarget = Math\.floor\(freshStatus\.durationMillis \* bounded\);\n            await sound\.setPositionAsync\(resolvedTarget\);\n            if \(shouldPlay\) await sound\.playAsync\(\);\n            setPositionMillis\(resolvedTarget\);\n            setDurationMillis\(freshStatus\.durationMillis\);\n          \}\n        \}/,
    `        if (targetMillis === 0 && durationMillis <= 0) {
          if (sound.isLoaded && sound.duration) {
            const resolvedTarget = Math.floor(sound.duration * 1000 * bounded);
            await sound.seekTo(resolvedTarget / 1000);
            if (shouldPlay) sound.play();
            setPositionMillis(resolvedTarget);
            setDurationMillis(sound.duration * 1000);
          }
        }`
);

// Replace togglePlayback
content = content.replace(
    /      const sound = await ensureFullSurahSound\(\);\n      const status = await sound\.getStatusAsync\(\);\n      if \(\!status\.isLoaded\) \{\n        await ensureFullSurahSound\(\{ shouldPlay: true \}\);\n      \} else if \(status\.isPlaying\) \{\n        await sound\.pauseAsync\(\);\n        setIsAudioPlaying\(false\);\n      \} else \{\n        await sound\.playAsync\(\);\n        setIsAudioPlaying\(true\);\n      \}/,
    `      const sound = await ensureFullSurahSound();
      if (!sound.isLoaded) {
        await ensureFullSurahSound({ shouldPlay: true });
      } else if (sound.playing) {
        sound.pause();
        setIsAudioPlaying(false);
      } else {
        sound.play();
        setIsAudioPlaying(true);
      }`
);

fs.writeFileSync('src/screens/SurahDetailScreen.tsx', content);
