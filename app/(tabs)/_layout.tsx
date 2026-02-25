import { MaterialIcons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { Platform } from "react-native";

import { QuranBottomAccessory } from "../../src/components/QuranBottomAccessory";
import { useI18n } from "../../src/hooks/useI18n";
import { useAppTheme } from "../../src/hooks/useAppTheme";
import { useAppStore } from "../../src/store/appStore";

const getIOSMajorVersion = (): number => {
  if (Platform.OS !== "ios") return 0;
  const version = Platform.Version;
  if (typeof version === "number") return version;
  const parsed = Number.parseInt(`${version}`.split(".")[0] ?? "0", 10);
  return Number.isFinite(parsed) ? parsed : 0;
};

export default function TabsLayout() {
  const theme = useAppTheme();
  const { t } = useI18n();
  const quranPlayer = useAppStore((s) => s.quranPlayer);
  const useNativeTabs = Platform.OS === "ios" && getIOSMajorVersion() >= 26;
  const showBottomAccessory = quranPlayer.isLoading || quranPlayer.isPlaying;

  if (useNativeTabs) {
    return (
      <NativeTabs
        backBehavior="history"
        tintColor={theme.colors.primary}
        iconColor={{
          default: theme.colors.textMuted,
          selected: theme.colors.primary,
        }}
        labelStyle={{
          default: { color: theme.colors.textMuted },
          selected: { color: theme.colors.primary },
        }}
      >
        {showBottomAccessory ? (
          <NativeTabs.BottomAccessory>
            <QuranBottomAccessory />
          </NativeTabs.BottomAccessory>
        ) : null}

        <NativeTabs.Trigger name="index">
          <NativeTabs.Trigger.Label>{t("tabs.home")}</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={{ default: "house", selected: "house.fill" }} />
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="quran">
          <NativeTabs.Trigger.Label>{t("tabs.quran")}</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={{ default: "book.closed", selected: "book.closed.fill" }} />
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="bookmarks">
          <NativeTabs.Trigger.Label>{t("tabs.bookmarks")}</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={{ default: "bookmark", selected: "bookmark.fill" }} />
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="calendar">
          <NativeTabs.Trigger.Label>{t("home.calendar")}</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={{ default: "calendar", selected: "calendar" }} />
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="settings">
          <NativeTabs.Trigger.Label>{t("tabs.settings")}</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={{ default: "gearshape", selected: "gearshape.fill" }} />
        </NativeTabs.Trigger>
      </NativeTabs>
    );
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarStyle: {
          backgroundColor: theme.colors.card,
          borderTopColor: theme.colors.border,
          height: 64,
          paddingBottom: 6,
          paddingTop: 6,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("tabs.home"),
          tabBarIcon: ({ color }) => <MaterialIcons name="home" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="quran"
        options={{
          title: t("tabs.quran"),
          tabBarIcon: ({ color }) => <MaterialIcons name="menu-book" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="bookmarks"
        options={{
          title: t("tabs.bookmarks"),
          tabBarIcon: ({ color }) => <MaterialIcons name="bookmark" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: t("home.calendar"),
          tabBarIcon: ({ color }) => <MaterialIcons name="calendar-month" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t("tabs.settings"),
          tabBarIcon: ({ color }) => <MaterialIcons name="settings" size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}
