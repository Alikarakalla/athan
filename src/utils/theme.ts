import type { ThemeCmsConfig, ThemeMode } from "../types/settings";

export interface AppTheme {
  mode: "light" | "dark";
  colors: {
    background: string;
    backgroundAlt: string;
    card: string;
    border: string;
    text: string;
    textMuted: string;
    primary: string;
    accent: string;
    danger: string;
    success: string;
  };
}

export const lightTheme: AppTheme = {
  mode: "light",
  colors: {
    background: "#F4F0E5",
    backgroundAlt: "#EFE7D1",
    card: "#FFFDF7",
    border: "#D8CFB5",
    text: "#1F1A12",
    textMuted: "#6E6454",
    primary: "#B08968",
    accent: "#9C7A52",
    danger: "#B14A42",
    success: "#8B6A46",
  },
};

export const darkTheme: AppTheme = {
  mode: "dark",
  colors: {
    background: "#16110D",
    backgroundAlt: "#221A14",
    card: "#2A2119",
    border: "#4A3A2D",
    text: "#F0E9D4",
    textMuted: "#C0B39F",
    primary: "#D0B089",
    accent: "#CBA67A",
    danger: "#F27C74",
    success: "#D6B489",
  },
};

export const resolveTheme = (mode: ThemeMode, systemScheme: "light" | "dark" | null | undefined): AppTheme => {
  if (mode === "system") {
    return systemScheme === "dark" ? darkTheme : lightTheme;
  }
  return mode === "dark" ? darkTheme : lightTheme;
};

export const applyThemeCms = (
  baseTheme: AppTheme,
  cms: ThemeCmsConfig | null | undefined,
): AppTheme => {
  if (!cms) return baseTheme;
  const modeOverrides = baseTheme.mode === "dark" ? cms.dark : cms.light;
  return {
    ...baseTheme,
    colors: {
      ...baseTheme.colors,
      ...modeOverrides,
    },
  };
};
