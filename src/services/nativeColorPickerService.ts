import { NativeModules, Platform, TurboModuleRegistry } from "react-native";

export interface NativeUIColorPickerOptions {
  initialHex: string;
  supportsAlpha?: boolean;
  title?: string;
}

export interface NativeUIColorPickerResult {
  hex: string;
}

type ResolvedNativeModule = {
  moduleName: string;
  methodName: string;
  source: "turboRegistry" | "turboProxy" | "nativeModules" | "nativeModulesScan";
  invoke: (options: NativeUIColorPickerOptions) => Promise<NativeUIColorPickerResult>;
};

const MODULE_NAME_CANDIDATES = ["ExpoUIColorPicker", "UIColorPicker"] as const;
const METHOD_NAME_CANDIDATES = ["presentColorPicker", "presentColorPickerWithOptions"] as const;

const resolveFromReference = (
  moduleName: string,
  source: ResolvedNativeModule["source"],
  moduleRef: unknown,
): ResolvedNativeModule | null => {
  if (!moduleRef || (typeof moduleRef !== "object" && typeof moduleRef !== "function")) {
    return null;
  }

  for (const methodName of METHOD_NAME_CANDIDATES) {
    let methodRef: unknown;
    try {
      methodRef = (moduleRef as Record<string, unknown>)[methodName];
    } catch {
      methodRef = undefined;
    }
    if (typeof methodRef === "function") {
      return {
        moduleName,
        methodName,
        source,
        invoke: (options) => (methodRef as (opts: NativeUIColorPickerOptions) => Promise<NativeUIColorPickerResult>)(options),
      };
    }
  }

  return null;
};

const resolveNativeUIColorPickerModule = (): ResolvedNativeModule | null => {
  for (const moduleName of MODULE_NAME_CANDIDATES) {
    const turboModule = TurboModuleRegistry.get(moduleName);
    const resolvedFromTurboRegistry = resolveFromReference(moduleName, "turboRegistry", turboModule);
    if (resolvedFromTurboRegistry) {
      return resolvedFromTurboRegistry;
    }
  }

  const turboProxy = (globalThis as { __turboModuleProxy?: (name: string) => unknown }).__turboModuleProxy;
  if (typeof turboProxy === "function") {
    for (const moduleName of MODULE_NAME_CANDIDATES) {
      const turboModule = turboProxy(moduleName);
      const resolvedFromTurboProxy = resolveFromReference(moduleName, "turboProxy", turboModule);
      if (resolvedFromTurboProxy) {
        return resolvedFromTurboProxy;
      }
    }
  }

  for (const moduleName of MODULE_NAME_CANDIDATES) {
    let moduleRef: unknown;
    try {
      moduleRef = NativeModules[moduleName];
    } catch {
      moduleRef = undefined;
    }
    const resolvedFromNativeModules = resolveFromReference(moduleName, "nativeModules", moduleRef);
    if (resolvedFromNativeModules) {
      return resolvedFromNativeModules;
    }
  }

  for (const [moduleName, maybeModule] of Object.entries(NativeModules)) {
    if (!maybeModule || (typeof maybeModule !== "object" && typeof maybeModule !== "function")) continue;
    if (!/color|picker/i.test(moduleName)) continue;
    const resolvedFromScan = resolveFromReference(moduleName, "nativeModulesScan", maybeModule);
    if (resolvedFromScan) {
      return resolvedFromScan;
    }
  }

  return null;
};

export const getNativeUIColorPickerDebugInfo = () => {
  const moduleNames = Object.keys(NativeModules)
    .filter((name) => /color|picker/i.test(name))
    .sort();
  const resolved = resolveNativeUIColorPickerModule();
  const turboProxy = (globalThis as { __turboModuleProxy?: unknown }).__turboModuleProxy;
  return {
    platform: Platform.OS,
    totalNativeModules: Object.keys(NativeModules).length,
    candidateModules: moduleNames,
    turboProxyAvailable: typeof turboProxy === "function",
    resolvedModuleName: resolved?.moduleName ?? null,
    resolvedMethodName: resolved?.methodName ?? null,
    resolvedSource: resolved?.source ?? null,
  };
};

export const isNativeUIColorPickerSupported = () => Platform.OS === "ios";

export const isNativeUIColorPickerAvailable = () => {
  return Platform.OS === "ios" && resolveNativeUIColorPickerModule() !== null;
};

export const presentNativeUIColorPicker = async (
  options: NativeUIColorPickerOptions,
): Promise<NativeUIColorPickerResult> => {
  const resolved = resolveNativeUIColorPickerModule();
  if (Platform.OS !== "ios") {
    throw new Error("Native UIColorPickerViewController is only available on iOS.");
  }
  if (!resolved) {
    throw new Error("ExpoUIColorPicker native module is not loaded in the iOS runtime.");
  }
  return resolved.invoke(options);
};
