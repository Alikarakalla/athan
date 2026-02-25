import type { NativeSyntheticEvent, StyleProp, ViewStyle } from "react-native";
import { Platform, UIManager, requireNativeComponent } from "react-native";

export type NativeCityMenuItem = {
  id: string;
  title: string;
  sf?: string;
};

type NativeCityMenuSelectEvent = NativeSyntheticEvent<{
  id: string;
  title?: string;
}>;

type NativeCityMenuButtonProps = {
  title: string;
  items: NativeCityMenuItem[];
  onSelectAction?: (event: NativeCityMenuSelectEvent) => void;
  titleColor?: string;
  pillBackgroundColor?: string;
  pillBorderColor?: string;
  style?: StyleProp<ViewStyle>;
};

const getAvailableManagerName = (): string | null => {
  if (Platform.OS !== "ios") return null;
  const candidates = ["CityMenuButton", "CityMenuButtonManager", "RCTCityMenuButton"] as const;
  for (const name of candidates) {
    try {
      const cfg = typeof UIManager.getViewManagerConfig === "function"
        ? UIManager.getViewManagerConfig(name)
        : (UIManager as unknown as Record<string, unknown>)[name];
      if (cfg) return name;
    } catch {
      // noop
    }
  }
  return null;
};

let cachedNativeComponent: ReturnType<typeof requireNativeComponent<NativeCityMenuButtonProps>> | null = null;

const getNativeCityMenuComponent = () => {
  if (cachedNativeComponent) return cachedNativeComponent;
  const managerName = getAvailableManagerName();
  if (!managerName) return null;
  cachedNativeComponent = requireNativeComponent<NativeCityMenuButtonProps>(managerName);
  return cachedNativeComponent;
};

export const isNativeCityMenuAvailable = () => getAvailableManagerName() !== null;

export const NativeCityMenuButton = (props: NativeCityMenuButtonProps) => {
  const IOSNativeCityMenuButton = getNativeCityMenuComponent();
  if (!IOSNativeCityMenuButton) {
    return null;
  }
  return <IOSNativeCityMenuButton {...props} />;
};
