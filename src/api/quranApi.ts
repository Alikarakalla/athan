import type {
  AyahLine,
  QuranReciter,
  SurahAudioTrack,
  SurahDetail,
  SurahSummary,
  SurahVerseTimestamp,
} from "../types/quran";
import { API_BASES, STORAGE_KEYS } from "../utils/constants";
import { storage } from "../utils/storage";

interface SurahListResponse {
  code: number;
  data: SurahSummary[];
}

interface EditionAyah {
  number: number;
  numberInSurah: number;
  juz: number;
  page: number;
  hizbQuarter: number;
  text: string;
  audio?: string;
}

interface EditionPayload {
  number: number;
  name: string;
  englishName: string;
  englishNameTranslation: string;
  revelationType: string;
  numberOfAyahs: number;
  ayahs: EditionAyah[];
}

interface MultiEditionResponse {
  code: number;
  data: EditionPayload[];
}

interface AudioEditionResponse {
  code: number;
  data: EditionPayload;
}

interface QuranComRecitationsResponse {
  recitations: Array<{
    id: number;
    reciter_name: string;
    style: string | null;
    translated_name?: { name?: string };
  }>;
}

interface QuranComChapterRecitationResponse {
  audio_file: {
    audio_url: string;
    timestamps?: Array<{
      verse_key: string;
      timestamp_from: number;
      timestamp_to: number;
      duration: number;
    }>;
  };
}

const fetchJson = async <T>(url: string): Promise<T> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Quran API request failed (${response.status})`);
  }
  return (await response.json()) as T;
};

export const fetchSurahList = async (): Promise<SurahSummary[]> => {
  const payload = await fetchJson<SurahListResponse>(`${API_BASES.quranCloud}/surah`);
  if (payload.code !== 200 || !Array.isArray(payload.data)) {
    throw new Error("Invalid Quran surah list response");
  }
  await storage.setJSON(STORAGE_KEYS.quranSurahList, payload.data);
  return payload.data;
};

export const getCachedSurahList = async (): Promise<SurahSummary[] | null> => {
  return storage.getJSON<SurahSummary[]>(STORAGE_KEYS.quranSurahList);
};

export const clearQuranCache = async (): Promise<void> => {
  await storage.remove(STORAGE_KEYS.quranSurahList);
};

export const fetchQuranReciters = async (): Promise<QuranReciter[]> => {
  const payload = await fetchJson<QuranComRecitationsResponse>("https://api.quran.com/api/v4/resources/recitations?language=en");
  return (payload.recitations ?? []).map((reciter) => ({
    id: reciter.id,
    name: reciter.translated_name?.name || reciter.reciter_name,
    style: reciter.style,
  }));
};

export const fetchQuranReciterPreviewUrl = async (reciterId: number): Promise<string> => {
  const payload = await fetchJson<QuranComChapterRecitationResponse>(
    `https://api.quran.com/api/v4/chapter_recitations/${reciterId}/1?segments=false`,
  );
  const url = payload.audio_file?.audio_url;
  if (!url) {
    throw new Error("Preview audio unavailable for this reciter");
  }
  return url;
};

export const fetchSurahDetail = async (surahNumber: number): Promise<SurahDetail> => {
  const payload = await fetchJson<MultiEditionResponse>(
    `${API_BASES.quranCloud}/surah/${surahNumber}/editions/quran-uthmani,en.asad`,
  );

  if (payload.code !== 200 || !Array.isArray(payload.data) || payload.data.length < 2) {
    throw new Error("Invalid Quran surah detail response");
  }

  const arabicEdition = payload.data[0];
  const translationEdition = payload.data[1];
  const translationByAyah = new Map<number, EditionAyah>();
  translationEdition.ayahs.forEach((ayah) => {
    translationByAyah.set(ayah.numberInSurah, ayah);
  });

  const ayahs: AyahLine[] = arabicEdition.ayahs.map((ayah) => ({
    number: ayah.number,
    numberInSurah: ayah.numberInSurah,
    juz: ayah.juz,
    page: ayah.page,
    hizbQuarter: ayah.hizbQuarter,
    arabicText: ayah.text,
    translationText: translationByAyah.get(ayah.numberInSurah)?.text ?? "",
  }));

  return {
    surah: {
      number: arabicEdition.number,
      name: arabicEdition.name,
      englishName: arabicEdition.englishName,
      englishNameTranslation: arabicEdition.englishNameTranslation,
      revelationType: arabicEdition.revelationType,
      numberOfAyahs: arabicEdition.numberOfAyahs,
    },
    ayahs,
  };
};

export const fetchSurahAudioTrack = async (surahNumber: number, reciterId = 7): Promise<SurahAudioTrack> => {
  try {
    const quranCom = await fetchJson<QuranComChapterRecitationResponse>(
      `https://api.quran.com/api/v4/chapter_recitations/${reciterId}/${surahNumber}?segments=true`,
    );

    const verseTimestamps: SurahVerseTimestamp[] = (quranCom.audio_file?.timestamps ?? []).map((t) => ({
      verseKey: t.verse_key,
      timestampFrom: t.timestamp_from,
      timestampTo: t.timestamp_to,
      duration: t.duration,
    }));

    return {
      surahNumber,
      reciter: "Quran.com Reciter",
      reciterId,
      ayahAudioUrls: [],
      fullSurahUrl: quranCom.audio_file?.audio_url,
      verseTimestamps,
    };
  } catch {
    // Fallback to AlQuran.cloud + known full MP3 URL for Alafasy only.
    const payload = await fetchJson<AudioEditionResponse>(`${API_BASES.quranCloud}/surah/${surahNumber}/ar.alafasy`);
    if (payload.code !== 200 || !payload.data?.ayahs) {
      throw new Error("Invalid Quran audio response");
    }

    return {
      surahNumber,
      reciter: "Mishary Rashid Alafasy",
      reciterId: 7,
      ayahAudioUrls: payload.data.ayahs.map((ayah) => ayah.audio).filter(Boolean) as string[],
      fullSurahUrl: `https://download.quranicaudio.com/quran/mishaari_raashid_al_3afaasee/${`${surahNumber}`.padStart(3, "0")}.mp3`,
    };
  }
};
