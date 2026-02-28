import { useAppStore } from "../store/appStore";
import { applyThemeCms, darkTheme } from "../utils/theme";

export const useAppTheme = () => {
  const themeCms = useAppStore((state) => state.themeCms);
  return applyThemeCms(darkTheme, themeCms);
};
