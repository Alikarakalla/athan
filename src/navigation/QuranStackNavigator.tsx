import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { QuranListScreen } from "../screens/QuranListScreen";
import { SurahDetailScreen } from "../screens/SurahDetailScreen";
import type { QuranStackParamList } from "../types/navigation";
import { useAppTheme } from "../hooks/useAppTheme";

const Stack = createNativeStackNavigator<QuranStackParamList>();

export const QuranStackNavigator = () => {
  const theme = useAppTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.colors.background,
        },
        headerShadowVisible: false,
        headerTintColor: theme.colors.text,
        headerTitleStyle: {
          fontWeight: "700",
        },
        contentStyle: {
          backgroundColor: theme.colors.background,
        },
      }}
    >
      <Stack.Screen name="QuranList" component={QuranListScreen} options={{ title: "Quran" }} />
      <Stack.Screen
        name="SurahDetail"
        component={SurahDetailScreen}
        options={({ route }) => ({ title: `Surah ${route.params.surahNumber}` })}
      />
    </Stack.Navigator>
  );
};

