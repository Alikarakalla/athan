export interface SurahSummary {
  number: number;
  name: string;
  englishName: string;
  englishNameTranslation: string;
  revelationType: string;
  numberOfAyahs: number;
}

export interface AyahLine {
  number: number;
  numberInSurah: number;
  juz: number;
  page: number;
  hizbQuarter: number;
  arabicText: string;
  translationText: string;
  audioUrl?: string;
}

export interface SurahDetail {
  surah: SurahSummary;
  ayahs: AyahLine[];
}

export interface QuranBookmark {
  id: string;
  surahNumber: number;
  surahName: string;
  ayahNumber: number;
  ayahArabic: string;
  ayahTranslation: string;
  createdAt: number;
}

export interface LastReadPosition {
  surahNumber: number;
  surahName: string;
  ayahNumber: number;
  updatedAt: number;
}

export interface SurahAudioTrack {
  surahNumber: number;
  reciter: string;
  reciterId?: number;
  ayahAudioUrls: string[];
  fullSurahUrl?: string;
  verseTimestamps?: SurahVerseTimestamp[];
}

export interface SurahVerseTimestamp {
  verseKey: string;
  timestampFrom: number;
  timestampTo: number;
  duration: number;
}

export interface QuranReciter {
  id: number;
  name: string;
  style?: string | null;
}
