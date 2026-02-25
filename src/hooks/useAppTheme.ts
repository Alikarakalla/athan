import { useColorScheme } from "react-native";
import { useAppStore } from "../store/appStore";
import { applyThemeCms, resolveTheme } from "../utils/theme";

export const useAppTheme = () => {
  const systemScheme = useColorScheme();
  const themeMode = useAppStore((state) => state.themeMode);
  const themeCms = useAppStore((state) => state.themeCms);
  return applyThemeCms(resolveTheme(themeMode, systemScheme), themeCms);
};
