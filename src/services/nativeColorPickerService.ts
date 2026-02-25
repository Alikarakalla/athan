import { NativeModules, Platform } from "react-native";

export interface NativeUIColorPickerOptions {
  initialHex: string;
  supportsAlpha?: boolean;
  title?: string;
}

export interface NativeUIColorPickerResult {
  hex: string;
}

type NativeUIColorPickerModule = {
  presentColorPicker: (options: NativeUIColorPickerOptions) => Promise<NativeUIColorPickerResult>;
};

const moduleRef = NativeModules.ExpoUIColorPicker as NativeUIColorPickerModule | undefined;

export const isNativeUIColorPickerSupported = () => Platform.OS === "ios";

export const isNativeUIColorPickerAvailable = () =>
  Platform.OS === "ios" && !!moduleRef && typeof moduleRef.presentColorPicker === "function";

export const presentNativeUIColorPicker = async (
  options: NativeUIColorPickerOptions,
): Promise<NativeUIColorPickerResult> => {
  if (Platform.OS !== "ios") {
    throw new Error("Native UIColorPickerViewController is only available on iOS.");
  }
  if (!moduleRef || typeof moduleRef.presentColorPicker !== "function") {
    throw new Error("ExpoUIColorPicker native module is not installed yet. Build on Mac and add the iOS module.");
  }
  return moduleRef.presentColorPicker(options);
};

