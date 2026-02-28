import { Stack } from "expo-router";

import { useI18n } from "../../../src/hooks/useI18n";

export default function HomeStackLayout() {
  const { t } = useI18n();

  return (
    <Stack
      screenOptions={{
        headerTransparent: true,
        headerShadowVisible: false,
        headerStyle: { backgroundColor: "transparent" },
        headerTitleAlign: "center",
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: t("tabs.home"),
          headerTitle: "",
        }}
      />
    </Stack>
  );
}
