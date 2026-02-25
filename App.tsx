import "react-native-gesture-handler";

import { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AppNavigator } from "./src/navigation/AppNavigator";
import { useAppTheme } from "./src/hooks/useAppTheme";
import { configureNotificationBehavior, initializeNotificationChannel } from "./src/services/notificationService";

configureNotificationBehavior();

export default function App() {
  const theme = useAppTheme();

  useEffect(() => {
    void initializeNotificationChannel();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style={theme.mode === "dark" ? "light" : "dark"} />
        <AppNavigator />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
