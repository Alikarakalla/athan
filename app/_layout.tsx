import "react-native-gesture-handler";

import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { useAppTheme } from "../src/hooks/useAppTheme";
import {
  configureNotificationBehavior,
  initializeNotificationChannel,
} from "../src/services/notificationService";

configureNotificationBehavior();

const getStatusBarStyle = (background: string): "light" | "dark" => {
  const clean = background.replace("#", "").trim();
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) {
    return "light";
  }
  const value = Number.parseInt(clean, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.62 ? "dark" : "light";
};

export default function RootLayout() {
  const theme = useAppTheme();
  const isIOS = Platform.OS === "ios";

  useEffect(() => {
    void initializeNotificationChannel();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style={getStatusBarStyle(theme.colors.background)} />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen
            name="(tabs)"
            options={{
              headerShown: false,
              headerTitle: "",
            }}
          />
          <Stack.Screen
            name="latmiyat-player"
            options={{
              headerShown: false,
              presentation: isIOS ? "formSheet" : "modal",
              animation: isIOS ? "default" : "slide_from_bottom",
              sheetAllowedDetents: isIOS ? [0.5] : undefined,
              sheetInitialDetentIndex: isIOS ? 0 : undefined,
              sheetGrabberVisible: isIOS,
              sheetExpandsWhenScrolledToEdge: false,
              sheetCornerRadius: isIOS ? 34 : undefined,
              contentStyle: {
                backgroundColor: isIOS ? "transparent" : theme.colors.background,
              },
            }}
          />
          <Stack.Screen
            name="city-picker"
            options={{
              headerShown: true,
              presentation: "card",
              animation: "default",
              contentStyle: {
                backgroundColor: theme.colors.background,
              },
              gestureEnabled: true,
            }}
          />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
