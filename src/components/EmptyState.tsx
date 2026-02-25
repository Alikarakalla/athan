import { StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "../hooks/useAppTheme";

interface EmptyStateProps {
  title: string;
  subtitle?: string;
}

export const EmptyState = ({ title, subtitle }: EmptyStateProps) => {
  const theme = useAppTheme();

  return (
    <View style={[styles.container, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}>
      <Text style={[styles.title, { color: theme.colors.text }]}>{title}</Text>
      {subtitle ? <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>{subtitle}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { borderWidth: 1, borderRadius: 14, padding: 16, alignItems: "center" },
  title: { fontSize: 16, fontWeight: "700", textAlign: "center" },
  subtitle: { marginTop: 6, textAlign: "center", fontSize: 13, lineHeight: 18 },
});

