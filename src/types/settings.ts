export type ThemeMode = "system" | "light" | "dark";
export type TimeFormat = "12h" | "24h";
export type PermissionState = "unknown" | "granted" | "denied";
export type AthanSoundKey = "default" | "athan_makkah" | "athan_madina" | "athan_iraq";
export type AppLanguage = "en" | "ar";

export type ThemeColorKey =
  | "background"
  | "backgroundAlt"
  | "card"
  | "border"
  | "text"
  | "textMuted"
  | "primary"
  | "accent"
  | "danger"
  | "success";

export type ThemeColorOverrides = Partial<Record<ThemeColorKey, string>>;

export interface ThemeCmsConfig {
  light: ThemeColorOverrides;
  dark: ThemeColorOverrides;
}
