import "react-native-gesture-handler";

import { useEffect } from "react";
import { Platform } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { useAppTheme } from "../src/hooks/useAppTheme";
import {
  configureNotificationBehavior,
  initializeNotificationChannel,
} from "../src/services/notificationService";

configureNotificationBehavior();

export default function RootLayout() {
  const theme = useAppTheme();

  useEffect(() => {
    void initializeNotificationChannel();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style={theme.mode === "dark" ? "light" : "dark"} />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="city-picker"
            options={{
              headerShown: true,
              headerTransparent: true,
              headerShadowVisible: false,
              headerStyle: {
                backgroundColor: "transparent",
              },
              headerBackground: () => null,
              presentation: Platform.OS === "ios" ? "formSheet" : "modal",
              animation: Platform.OS === "ios" ? "default" : "slide_from_bottom",
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
