import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Text } from "react-native";

import { HomeScreen } from "../screens/HomeScreen";
import { QuranStackNavigator } from "./QuranStackNavigator";
import { BookmarksScreen } from "../screens/BookmarksScreen";
import { SettingsScreen } from "../screens/SettingsScreen";
import type { RootTabParamList } from "../types/navigation";
import { useAppTheme } from "../hooks/useAppTheme";

const Tab = createBottomTabNavigator<RootTabParamList>();

const TabLabelIcon = ({ label, focused, color }: { label: string; focused: boolean; color: string }) => (
  <Text style={{ fontSize: 12, fontWeight: focused ? "800" : "600", color }}>{label}</Text>
);

export const RootTabs = () => {
  const theme = useAppTheme();

  return (
    <Tab.Navigator
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
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "600",
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ color }) => <Text style={{ color, fontWeight: "700" }}>H</Text>,
          tabBarLabel: ({ focused, color }) => <TabLabelIcon label="Home" focused={focused} color={color} />,
        }}
      />
      <Tab.Screen
        name="Quran"
        component={QuranStackNavigator}
        options={{
          tabBarIcon: ({ color }) => <Text style={{ color, fontWeight: "700" }}>Q</Text>,
          tabBarLabel: ({ focused, color }) => <TabLabelIcon label="Quran" focused={focused} color={color} />,
        }}
      />
      <Tab.Screen
        name="Bookmarks"
        component={BookmarksScreen}
        options={{
          tabBarIcon: ({ color }) => <Text style={{ color, fontWeight: "700" }}>B</Text>,
          tabBarLabel: ({ focused, color }) => (
            <TabLabelIcon label="Bookmarks" focused={focused} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarIcon: ({ color }) => <Text style={{ color, fontWeight: "700" }}>S</Text>,
          tabBarLabel: ({ focused, color }) => <TabLabelIcon label="Settings" focused={focused} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
};
