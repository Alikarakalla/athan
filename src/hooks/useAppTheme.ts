import { useAppStore } from "../store/appStore";
import { applyThemeCms, lightTheme } from "../utils/theme";

export const useAppTheme = () => {
  const themeCms = useAppStore((state) => state.themeCms);
  return applyThemeCms(lightTheme, themeCms);
};
