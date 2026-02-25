import { useLocalSearchParams } from "expo-router";

import { SurahDetailScreen } from "../../src/screens/SurahDetailScreen";

export default function SurahDetailStandaloneRoute() {
  const params = useLocalSearchParams<{
    surahNumber?: string;
    initialAyahNumber?: string;
  }>();

  const surahNumber = Number.parseInt(`${params.surahNumber ?? "0"}`, 10);
  const initialAyahNumber = params.initialAyahNumber
    ? Number.parseInt(`${params.initialAyahNumber}`, 10)
    : undefined;

  return (
    <>
      <SurahDetailScreen surahNumber={surahNumber} initialAyahNumber={initialAyahNumber} />
    </>
  );
}
