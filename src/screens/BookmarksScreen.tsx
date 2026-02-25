import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

import { Card } from "../components/Card";
import { EmptyState } from "../components/EmptyState";
import { useI18n } from "../hooks/useI18n";
import { useAppTheme } from "../hooks/useAppTheme";
import { useAppStore } from "../store/appStore";

export const BookmarksScreen = () => {
  const theme = useAppTheme();
  const { t } = useI18n();
  const bookmarks = useAppStore((s) => s.bookmarks);
  const removeBookmark = useAppStore((s) => s.removeBookmark);

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <FlatList
        data={bookmarks}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.headerWrap}>
            <Text style={[styles.title, { color: theme.colors.text }]}>{t("bookmarks.title")}</Text>
            <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
              {t("bookmarks.subtitle")}
            </Text>
          </View>
        }
        ListEmptyComponent={<EmptyState title={t("bookmarks.emptyTitle")} subtitle={t("bookmarks.emptySubtitle")} />}
        renderItem={({ item }) => (
          <Card style={styles.cardSpacing}>
            <Text style={[styles.bookmarkTitle, { color: theme.colors.text }]}>
              {t("bookmarks.itemTitle", { surah: item.surahName, ayah: item.ayahNumber })}
            </Text>
            <Text numberOfLines={2} style={[styles.arabic, { color: theme.colors.text }]}>
              {item.ayahArabic}
            </Text>
            <Text numberOfLines={3} style={[styles.translation, { color: theme.colors.textMuted }]}>
              {item.ayahTranslation}
            </Text>

            <View style={styles.actionsRow}>
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: "/quran/[surahNumber]",
                    params: {
                      surahNumber: String(item.surahNumber),
                      initialAyahNumber: String(item.ayahNumber),
                    },
                  })
                }
                style={({ pressed }) => [
                  styles.primaryButton,
                  { backgroundColor: theme.colors.primary, opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Text style={styles.primaryButtonText}>{t("common.open")}</Text>
              </Pressable>

              <Pressable
                onPress={() => removeBookmark(item.id)}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  { borderColor: theme.colors.border, opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Text style={[styles.secondaryButtonText, { color: theme.colors.text }]}>{t("common.remove")}</Text>
              </Pressable>
            </View>
          </Card>
        )}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 16, paddingBottom: 24 },
  headerWrap: { marginBottom: 10, gap: 6 },
  title: { fontSize: 26, fontWeight: "800" },
  subtitle: { fontSize: 13, lineHeight: 18 },
  cardSpacing: { marginBottom: 10 },
  bookmarkTitle: { fontSize: 15, fontWeight: "700" },
  arabic: {
    marginTop: 8,
    fontSize: 18,
    lineHeight: 32,
    textAlign: "right",
    writingDirection: "rtl",
  },
  translation: { marginTop: 8, fontSize: 13, lineHeight: 20 },
  actionsRow: { marginTop: 12, flexDirection: "row", gap: 10 },
  primaryButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  primaryButtonText: { color: "#fff", fontWeight: "700" },
  secondaryButton: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: { fontWeight: "600" },
});
