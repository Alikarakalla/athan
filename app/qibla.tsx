import { Stack } from "expo-router";

import { QiblaScreen } from "../src/screens/QiblaScreen";

export default function QiblaRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: "Qibla" }} />
      <QiblaScreen />
    </>
  );
}

