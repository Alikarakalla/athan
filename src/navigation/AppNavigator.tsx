import { useMemo } from "react";
import { NavigationContainer, type Theme as NavigationTheme } from "@react-navigation/native";

import { RootTabs } from "./RootTabs";
import { useAppTheme } from "../hooks/useAppTheme";

export const AppNavigator = () => {
  const theme = useAppTheme();

  const navigationTheme = useMemo<NavigationTheme>(
    () => ({
      dark: false,
      colors: {
        primary: theme.colors.primary,
        background: theme.colors.background,
        card: theme.colors.card,
        text: theme.colors.text,
        border: theme.colors.border,
        notification: theme.colors.accent,
      },
      fonts: {
        regular: { fontFamily: "System", fontWeight: "400" },
        medium: { fontFamily: "System", fontWeight: "500" },
        bold: { fontFamily: "System", fontWeight: "700" },
        heavy: { fontFamily: "System", fontWeight: "800" },
      },
    }),
    [theme],
  );

  return (
    <NavigationContainer theme={navigationTheme}>
      <RootTabs />
    </NavigationContainer>
  );
};
