import type { NavigatorScreenParams } from "@react-navigation/native";

export type QuranStackParamList = {
  QuranList: undefined;
  SurahDetail: {
    surahNumber: number;
    initialAyahNumber?: number;
  };
};

export type RootTabParamList = {
  Home: undefined;
  Quran: NavigatorScreenParams<QuranStackParamList>;
  Bookmarks: undefined;
  Settings: undefined;
};

