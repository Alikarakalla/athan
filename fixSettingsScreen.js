const fs = require('fs');
let content = fs.readFileSync('src/screens/SettingsScreen.tsx', 'utf-8');

// Replace imports
content = content.replace(
    /import \{\n  Audio,\n  InterruptionModeAndroid,\n  InterruptionModeIOS,\n  type AVPlaybackStatus,\n\} from "expo-av";/,
    `import {\n  createAudioPlayer,\n  setAudioModeAsync,\n  type AudioPlayer as ExpoAudioPlayer,\n  type AudioStatus,\n} from "expo-audio";`
);

// Replace ref type
content = content.replace(
    /const previewSoundRef = useRef<Audio\.Sound \| null>\(null\);/,
    `const previewSoundRef = useRef<ExpoAudioPlayer | null>(null);`
);

// Replace unloadPreview
content = content.replace(
    /  const unloadPreview = async \(\) => \{\n    if \(\!previewSoundRef\.current\) return;\n    const sound = previewSoundRef\.current;\n    previewSoundRef\.current = null;\n    try \{\n      await sound\.unloadAsync\(\);\n    \} catch \{\n      \/\/ ignore\n    \}\n  \};/,
    `  const unloadPreview = async () => {
    if (!previewSoundRef.current) return;
    const sound = previewSoundRef.current;
    previewSoundRef.current = null;
    try {
      sound.remove();
    } catch {
      // ignore
    }
  };`
);

// Replace playReciterPreview AudioMode and status
content = content.replace(
    /      await Audio\.setAudioModeAsync\(\{\n        allowsRecordingIOS: false,\n        playsInSilentModeIOS: true,\n        staysActiveInBackground: false,\n        interruptionModeAndroid: InterruptionModeAndroid\.DoNotMix,\n        interruptionModeIOS: InterruptionModeIOS\.DoNotMix,\n        shouldDuckAndroid: true,\n      \}\);\n\n      const current = previewSoundRef\.current;\n      if \(current && previewPlayingId === reciter\.id\) \{\n        const status = await current\.getStatusAsync\(\);\n        if \(status\.isLoaded && status\.isPlaying\) \{\n          await current\.pauseAsync\(\);\n          setPreviewPlayingId\(null\);\n          setPreviewLoadingId\(null\);\n          return;\n        \}\n        if \(status\.isLoaded && \!status\.isPlaying\) \{\n          await current\.playAsync\(\);\n          setPreviewPlayingId\(reciter\.id\);\n          setPreviewLoadingId\(null\);\n          return;\n        \}\n      \}\n\n      await unloadPreview\(\);\n      setAthanPreviewPlayingKey\(null\);\n      setAthanPreviewLoadingKey\(null\);\n\n      const uri =\n        previewUrlCacheRef\.current\[reciter\.id\] \?\?\n        \(await fetchQuranReciterPreviewUrl\(reciter\.id\)\);\n      previewUrlCacheRef\.current\[reciter\.id\] = uri;\n\n      const \{ sound \} = await Audio\.Sound\.createAsync\(\n        \{ uri \},\n        \{ shouldPlay: true, progressUpdateIntervalMillis: 250 \},\n        \(status: AVPlaybackStatus\) => \{\n          if \(\!status\.isLoaded\) return;\n          if \(status\.didJustFinish\) \{\n            setPreviewPlayingId\(null\);\n          \} else \{\n            setPreviewPlayingId\(status\.isPlaying \? reciter\.id : null\);\n          \}\n        \},\n      \);\n      previewSoundRef\.current = sound;/,
    `      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
        shouldPlayInBackground: false,
        interruptionMode: 'doNotMix',
      });

      const current = previewSoundRef.current;
      if (current && previewPlayingId === reciter.id) {
        if (current.isLoaded && current.playing) {
          current.pause();
          setPreviewPlayingId(null);
          setPreviewLoadingId(null);
          return;
        }
        if (current.isLoaded && !current.playing) {
          current.play();
          setPreviewPlayingId(reciter.id);
          setPreviewLoadingId(null);
          return;
        }
      }

      await unloadPreview();
      setAthanPreviewPlayingKey(null);
      setAthanPreviewLoadingKey(null);

      const uri =
        previewUrlCacheRef.current[reciter.id] ??
        (await fetchQuranReciterPreviewUrl(reciter.id));
      previewUrlCacheRef.current[reciter.id] = uri;

      const sound = createAudioPlayer(uri, { updateInterval: 250 });
      sound.addListener('playbackStatusUpdate', (status: AudioStatus) => {
        if (!status.isLoaded) return;
        if (status.didJustFinish) {
          setPreviewPlayingId(null);
        } else {
          setPreviewPlayingId(status.playing ? reciter.id : null);
        }
      });
      sound.play();
      previewSoundRef.current = sound;`
);

// Replace playAthanPreview AudioMode and status
content = content.replace(
    /      await Audio\.setAudioModeAsync\(\{\n        allowsRecordingIOS: false,\n        playsInSilentModeIOS: true,\n        staysActiveInBackground: false,\n        interruptionModeAndroid: InterruptionModeAndroid\.DoNotMix,\n        interruptionModeIOS: InterruptionModeIOS\.DoNotMix,\n        shouldDuckAndroid: true,\n      \}\);\n\n      const current = previewSoundRef\.current;\n      if \(current && athanPreviewPlayingKey === key\) \{\n        const status = await current\.getStatusAsync\(\);\n        if \(status\.isLoaded && status\.isPlaying\) \{\n          await current\.pauseAsync\(\);\n          setAthanPreviewPlayingKey\(null\);\n          setAthanPreviewLoadingKey\(null\);\n          return;\n        \}\n        if \(status\.isLoaded && \!status\.isPlaying\) \{\n          await current\.playAsync\(\);\n          setAthanPreviewPlayingKey\(key\);\n          setPreviewPlayingId\(null\);\n          setAthanPreviewLoadingKey\(null\);\n          return;\n        \}\n      \}\n\n      await unloadPreview\(\);\n      setPreviewPlayingId\(null\);\n      setPreviewLoadingId\(null\);\n\n      const uri = await getAthanPreviewUri\(key, filename, previewUrl\);\n\n      const \{ sound \} = await Audio\.Sound\.createAsync\(\n        \{ uri \},\n        \{ shouldPlay: true, progressUpdateIntervalMillis: 250 \},\n        \(status: AVPlaybackStatus\) => \{\n          if \(\!status\.isLoaded\) return;\n          if \(status\.didJustFinish\) \{\n            setAthanPreviewPlayingKey\(null\);\n          \} else \{\n            setAthanPreviewPlayingKey\(status\.isPlaying \? key : null\);\n          \}\n        \},\n      \);\n      previewSoundRef\.current = sound;/,
    `      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
        shouldPlayInBackground: false,
        interruptionMode: 'doNotMix',
      });

      const current = previewSoundRef.current;
      if (current && athanPreviewPlayingKey === key) {
        if (current.isLoaded && current.playing) {
          current.pause();
          setAthanPreviewPlayingKey(null);
          setAthanPreviewLoadingKey(null);
          return;
        }
        if (current.isLoaded && !current.playing) {
          current.play();
          setAthanPreviewPlayingKey(key);
          setPreviewPlayingId(null);
          setAthanPreviewLoadingKey(null);
          return;
        }
      }

      await unloadPreview();
      setPreviewPlayingId(null);
      setPreviewLoadingId(null);

      const uri = await getAthanPreviewUri(key, filename, previewUrl);

      const sound = createAudioPlayer(uri, { updateInterval: 250 });
      sound.addListener('playbackStatusUpdate', (status: AudioStatus) => {
        if (!status.isLoaded) return;
        if (status.didJustFinish) {
          setAthanPreviewPlayingKey(null);
        } else {
          setAthanPreviewPlayingKey(status.playing ? key : null);
        }
      });
      sound.play();
      previewSoundRef.current = sound;`
);

fs.writeFileSync('src/screens/SettingsScreen.tsx', content);
