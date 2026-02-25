import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "../hooks/useAppTheme";

interface LoadingStateProps {
  label?: string;
}

export const LoadingState = ({ label = "Loading..." }: LoadingStateProps) => {
  const theme = useAppTheme();

  return (
    <View style={styles.container}>
      <ActivityIndicator size="small" color={theme.colors.primary} />
      <Text style={[styles.label, { color: theme.colors.textMuted }]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8 },
  label: { fontSize: 14 },
});

