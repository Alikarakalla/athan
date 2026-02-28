import { NativeModules, Platform, TurboModuleRegistry } from "react-native";

import type { PrayerName } from "../types/prayer";
import type { AppLanguage } from "../types/settings";
import type { AppTheme } from "../utils/theme";

type WidgetThemePayload = Pick<
  AppTheme["colors"],
  "background" | "backgroundAlt" | "card" | "border" | "text" | "textMuted" | "primary" | "accent"
>;

export interface AthanWidgetPayload {
  nextPrayerName: PrayerName;
  nextPrayerTimestampMs: number;
  nextPrayerDisplayTime: string;
  timezone: string;
  cityLabel: string | null;
  language: AppLanguage;
  theme: WidgetThemePayload;
}

type AthanWidgetBridgeModule = {
  setWidgetPayload: (payload: Record<string, unknown>) => void;
  clearWidgetPayload: () => void;
  setLiveActivityEnabled: (enabled: boolean) => void;
};

const MODULE_NAME = "AthanWidgetBridge";

const isBridgeShape = (value: unknown): value is AthanWidgetBridgeModule => {
  if (!value || (typeof value !== "object" && typeof value !== "function")) return false;
  const mod = value as Record<string, unknown>;
  return (
    typeof mod.setWidgetPayload === "function" &&
    typeof mod.clearWidgetPayload === "function" &&
    typeof mod.setLiveActivityEnabled === "function"
  );
};

const resolveWidgetBridge = (): AthanWidgetBridgeModule | null => {
  const native = NativeModules[MODULE_NAME] as unknown;
  if (isBridgeShape(native)) return native;

  const turbo = TurboModuleRegistry.get(MODULE_NAME);
  if (isBridgeShape(turbo)) return turbo;

  return null;
};

const normalizeColor = (value: string): string => {
  const clean = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(clean)) return clean.toUpperCase();
  return "#000000";
};

export const syncAthanWidget = (payload: AthanWidgetPayload): void => {
  if (Platform.OS !== "ios") return;
  const bridge = resolveWidgetBridge();
  if (!bridge) return;
  if (!Number.isFinite(payload.nextPrayerTimestampMs)) return;

  bridge.setWidgetPayload({
    nextPrayerName: payload.nextPrayerName,
    nextPrayerTimestampMs: Math.round(payload.nextPrayerTimestampMs),
    nextPrayerDisplayTime: payload.nextPrayerDisplayTime,
    timezone: payload.timezone,
    cityLabel: payload.cityLabel,
    language: payload.language,
    theme: {
      background: normalizeColor(payload.theme.background),
      backgroundAlt: normalizeColor(payload.theme.backgroundAlt),
      card: normalizeColor(payload.theme.card),
      border: normalizeColor(payload.theme.border),
      text: normalizeColor(payload.theme.text),
      textMuted: normalizeColor(payload.theme.textMuted),
      primary: normalizeColor(payload.theme.primary),
      accent: normalizeColor(payload.theme.accent),
    },
    updatedAtMs: Date.now(),
  });
};

export const clearAthanWidget = (): void => {
  if (Platform.OS !== "ios") return;
  const bridge = resolveWidgetBridge();
  bridge?.clearWidgetPayload();
};

export const syncLiveActivityEnabled = (enabled: boolean): void => {
  if (Platform.OS !== "ios") return;
  const bridge = resolveWidgetBridge();
  bridge?.setLiveActivityEnabled(Boolean(enabled));
};
