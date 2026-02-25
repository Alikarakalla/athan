import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";

import { Card } from "../components/Card";
import { ScreenContainer } from "../components/ScreenContainer";
import { useI18n } from "../hooks/useI18n";
import { useAppTheme } from "../hooks/useAppTheme";
import { buildCalendarDayCell } from "../utils/shiaEvents";
import type { CalendarDayCell, ShiaEventDefinition } from "../types/calendar";

const WEEKDAY_LABELS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAY_LABELS_AR = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

const CATEGORY_COLORS = {
  eid: "#B08968",
  wiladah: "#8E6F4C",
  shahadah: "#A84A4A",
  commemoration: "#7C6A57",
} as const;

const HIJRI_MONTH_LABELS_AR: Record<string, string> = {
  Muharram: "محرم",
  Safar: "صفر",
  "Rabi al-Awwal": "ربيع الأول",
  "Rabi al-Thani": "ربيع الثاني",
  "Jumada al-Awwal": "جمادى الأولى",
  "Jumada al-Thani": "جمادى الآخرة",
  Rajab: "رجب",
  Shaban: "شعبان",
  Ramadan: "رمضان",
  Shawwal: "شوال",
  "Dhu al-Qadah": "ذو القعدة",
  "Dhu al-Hijjah": "ذو الحجة",
};

const toArabicDigits = (value: string): string => value.replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)] ?? d);

const formatNumber = (n: number, locale: string, isRTL: boolean) => {
  const raw = new Intl.NumberFormat(locale).format(n);
  return isRTL ? toArabicDigits(raw) : raw;
};

const formatHijriMonthLabel = (monthKey: string, isRTL: boolean) =>
  isRTL ? HIJRI_MONTH_LABELS_AR[monthKey] ?? monthKey : monthKey;

const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const addMonths = (d: Date, months: number) => new Date(d.getFullYear(), d.getMonth() + months, 1);

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const getMonthGrid = (monthDate: Date, timeZone?: string): Array<CalendarDayCell | null> => {
  const first = startOfMonth(monthDate);
  const monthIndex = first.getMonth();
  const days: Array<CalendarDayCell | null> = [];

  for (let i = 0; i < first.getDay(); i += 1) days.push(null);

  let cursor = new Date(first);
  while (cursor.getMonth() === monthIndex) {
    days.push(buildCalendarDayCell(new Date(cursor), timeZone));
    cursor.setDate(cursor.getDate() + 1);
  }

  while (days.length % 7 !== 0) days.push(null);
  return days;
};

const strings = {
  en: {
    title: "Islamic Calendar",
    subtitle: "Current month with Hijri dates and Shia events",
    selectedDay: "Selected Day",
    noEvents: "No listed Shia events on this date",
    monthEvents: "This Month's Shia Events",
    noMonthEvents: "No major listed events this month",
    today: "Today",
  },
  ar: {
    title: "التقويم الإسلامي",
    subtitle: "الشهر الحالي بالتاريخ الهجري وأحداث الشيعة",
    selectedDay: "اليوم المحدد",
    noEvents: "لا توجد أحداث شيعية مدرجة في هذا اليوم",
    monthEvents: "أحداث الشيعة هذا الشهر",
    noMonthEvents: "لا توجد أحداث رئيسية مدرجة هذا الشهر",
    today: "اليوم",
  },
} as const;

const AR_EVENT_OVERRIDES: Record<string, { title: string; subtitle?: string }> = {
  "muh-1": { title: "بداية شهر محرم", subtitle: "بداية الشهر الحرام وموسم العزاء." },
  "muh-9": { title: "تاسوعاء", subtitle: "ليلة عاشوراء وذكرى كربلاء." },
  "muh-10": { title: "عاشوراء (استشهاد الإمام الحسين)", subtitle: "أعظم أيام العزاء في ذكرى كربلاء." },
  "muh-11": { title: "سبي أهل البيت" },
  "safar-1": { title: "بداية صفر" },
  "safar-20": { title: "الأربعين", subtitle: "اليوم الأربعون بعد عاشوراء (زيارة الأربعين)." },
  "safar-28": { title: "رحيل النبي محمد واستشهاد الإمام الحسن" },
  "safar-30": { title: "استشهاد الإمام الرضا" },
  "rabi1-8": { title: "استشهاد الإمام الحسن العسكري" },
  "rabi1-9": { title: "بدء إمامة الإمام المهدي" },
  "rabi1-17": { title: "مولد النبي محمد والإمام جعفر الصادق" },
  "rabi2-8": { title: "مولد الإمام الحسن العسكري" },
  "jum1-15": { title: "مولد السيدة زينب" },
  "jum2-3": { title: "استشهاد السيدة فاطمة الزهراء (الفاطمية الثانية)" },
  "jum2-20": { title: "مولد السيدة فاطمة الزهراء" },
  "rajab-1": { title: "مولد الإمام محمد الباقر" },
  "rajab-3": { title: "استشهاد الإمام علي الهادي" },
  "rajab-10": { title: "مولد الإمام محمد التقي (الجواد)" },
  "rajab-13": { title: "مولد الإمام علي بن أبي طالب" },
  "rajab-15": { title: "استشهاد السيدة زينب (شائع)" },
  "rajab-25": { title: "استشهاد الإمام موسى الكاظم" },
  "rajab-27": { title: "المبعث النبوي" },
  "shaban-3": { title: "مولد الإمام الحسين" },
  "shaban-4": { title: "مولد العباس بن علي" },
  "shaban-5": { title: "مولد الإمام زين العابدين" },
  "shaban-11": { title: "مولد علي الأكبر" },
  "shaban-15": { title: "مولد الإمام المهدي (النصف من شعبان)" },
  "ramadan-15": { title: "مولد الإمام الحسن المجتبى" },
  "ramadan-19": { title: "ضربة الإمام علي" },
  "ramadan-21": { title: "استشهاد الإمام علي" },
  "shawwal-1": { title: "عيد الفطر" },
  "shawwal-25": { title: "استشهاد الإمام جعفر الصادق" },
  "dhq-11": { title: "مولد الإمام الرضا" },
  "dhh-1": { title: "زواج الإمام علي والسيدة فاطمة" },
  "dhh-7": { title: "استشهاد الإمام محمد الباقر" },
  "dhh-9": { title: "يوم عرفة" },
  "dhh-10": { title: "عيد الأضحى" },
  "dhh-15": { title: "مولد الإمام علي الهادي" },
  "dhh-18": { title: "عيد الغدير" },
  "dhh-24": { title: "يوم المباهلة" },
  "dhh-25": { title: "ذكرى سورة الإنسان (هل أتى)" },
};

const looksBrokenArabic = (value?: string | null) =>
  !!value && !/[\u0600-\u06FF]/.test(value) && value.includes("?");

const eventTitle = (event: ShiaEventDefinition, isRTL: boolean) => {
  if (!isRTL) return event.titleEn;
  return AR_EVENT_OVERRIDES[event.id]?.title ?? (looksBrokenArabic(event.titleAr) ? event.titleEn : event.titleAr);
};

const eventSubtitle = (event: ShiaEventDefinition, isRTL: boolean) => {
  if (!isRTL) return event.subtitleEn;
  return AR_EVENT_OVERRIDES[event.id]?.subtitle ?? (looksBrokenArabic(event.subtitleAr) ? event.subtitleEn : event.subtitleAr);
};

export const CalendarScreen = () => {
  const theme = useAppTheme();
  const { locale, isRTL } = useI18n();
  const copy = isRTL ? strings.ar : strings.en;

  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => new Date());

  const today = new Date();
  const monthGrid = useMemo(() => getMonthGrid(visibleMonth), [visibleMonth]);

  const selectedCell = useMemo(() => {
    return monthGrid.find((cell) => cell && isSameDay(cell.date, selectedDate)) ?? null;
  }, [monthGrid, selectedDate]);

  const fallbackSelectedCell = useMemo(() => {
    if (selectedCell) return selectedCell;
    const firstDayCell = monthGrid.find((c): c is CalendarDayCell => c !== null) ?? null;
    return firstDayCell;
  }, [monthGrid, selectedCell]);

  const monthEvents = useMemo(() => {
    const rows = monthGrid.filter((c): c is CalendarDayCell => c !== null);
    return rows
      .flatMap((cell) => cell.events.map((event) => ({ cell, event })))
      .sort((a, b) => a.cell.date.getTime() - b.cell.date.getTime());
  }, [monthGrid]);

  const monthLabel = visibleMonth.toLocaleDateString(locale, {
    month: "long",
    year: "numeric",
  });

  const weekdayLabels = isRTL ? WEEKDAY_LABELS_AR : WEEKDAY_LABELS_EN;

  return (
    <ScreenContainer>
      <View style={styles.headerWrap}>
        <Text style={[styles.title, { color: theme.colors.text }]}>{copy.title}</Text>
        <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>{copy.subtitle}</Text>
      </View>

      <Card>
        <View style={styles.monthHeader}>
          <Pressable
            onPress={() => setVisibleMonth((m) => addMonths(m, -1))}
            style={({ pressed }) => [
              styles.iconBtn,
              {
                borderColor: theme.colors.border,
                backgroundColor: pressed ? theme.colors.backgroundAlt : "transparent",
              },
            ]}
          >
            <MaterialIcons name={isRTL ? "chevron-right" : "chevron-left"} size={22} color={theme.colors.primary} />
          </Pressable>

          <View style={styles.monthCenter}>
            <Text style={[styles.monthLabel, { color: theme.colors.text }]}>{isRTL ? toArabicDigits(monthLabel) : monthLabel}</Text>
          </View>

          <Pressable
            onPress={() => setVisibleMonth((m) => addMonths(m, 1))}
            style={({ pressed }) => [
              styles.iconBtn,
              {
                borderColor: theme.colors.border,
                backgroundColor: pressed ? theme.colors.backgroundAlt : "transparent",
              },
            ]}
          >
            <MaterialIcons name={isRTL ? "chevron-left" : "chevron-right"} size={22} color={theme.colors.primary} />
          </Pressable>
        </View>

        <View style={styles.weekRow}>
          {weekdayLabels.map((label) => (
            <Text key={label} style={[styles.weekLabel, { color: theme.colors.textMuted }]}> 
              {label}
            </Text>
          ))}
        </View>

        <View style={styles.gridWrap}>
          {monthGrid.map((cell, idx) => {
            if (!cell) {
              return (
                <View key={`empty-${idx}`} style={styles.dayCellSlot}>
                  <View style={styles.dayCellPlaceholder} />
                </View>
              );
            }

            const isToday = isSameDay(cell.date, today);
            const isSelected = fallbackSelectedCell ? isSameDay(cell.date, fallbackSelectedCell.date) : false;
            const hasEvents = cell.events.length > 0;

            return (
              <View key={cell.date.toISOString()} style={styles.dayCellSlot}>
                <Pressable
                  onPress={() => setSelectedDate(cell.date)}
                  style={({ pressed }) => [
                    styles.dayCell,
                    {
                      borderColor: isSelected ? theme.colors.primary : theme.colors.border,
                      backgroundColor: isSelected
                        ? theme.colors.backgroundAlt
                        : pressed
                          ? theme.colors.backgroundAlt
                          : theme.colors.card,
                      opacity: pressed ? 0.94 : 1,
                    },
                  ]}
                >
                  <Text style={[styles.gregorianDay, { color: isToday ? theme.colors.primary : theme.colors.text }]}>
                    {formatNumber(cell.gregorianDay, locale, isRTL)}
                  </Text>
                  <Text style={[styles.hijriDay, { color: theme.colors.textMuted }]}>
                    {formatNumber(cell.hijri.day, locale, isRTL)}
                  </Text>
                  {hasEvents ? (
                    <View style={styles.eventDotsRow}>
                      {cell.events.slice(0, 3).map((event) => (
                        <View
                          key={event.id}
                          style={[styles.eventDot, { backgroundColor: CATEGORY_COLORS[event.category] ?? theme.colors.primary }]}
                        />
                      ))}
                    </View>
                  ) : null}
                  {isToday ? (
                    <Text style={[styles.todayPill, { color: theme.colors.primary }]}>{copy.today}</Text>
                  ) : null}
                </Pressable>
              </View>
            );
          })}
        </View>
      </Card>

      <Card>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>{copy.selectedDay}</Text>
        {fallbackSelectedCell ? (
          <>
            <View style={styles.selectedMetaRow}>
              <Text style={[styles.selectedGregorian, { color: theme.colors.text }]}>
                {fallbackSelectedCell.date.toLocaleDateString(locale, {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </Text>
              <Text style={[styles.selectedHijri, { color: theme.colors.textMuted }]}>
                {(isRTL ? toArabicDigits(String(fallbackSelectedCell.hijri.day)) : String(fallbackSelectedCell.hijri.day))}{" "}
                {formatHijriMonthLabel(fallbackSelectedCell.hijri.monthKey, isRTL)}
              </Text>
            </View>

            {fallbackSelectedCell.events.length ? (
              <View style={styles.eventsStack}>
                {fallbackSelectedCell.events.map((event) => (
                  <View
                    key={event.id}
                    style={[
                      styles.eventRow,
                      {
                        borderColor: theme.colors.border,
                        backgroundColor: theme.colors.backgroundAlt,
                      },
                    ]}
                  >
                    <View style={[styles.eventStripe, { backgroundColor: CATEGORY_COLORS[event.category] ?? theme.colors.primary }]} />
                    <View style={styles.eventContent}>
                      <Text style={[styles.eventTitle, { color: theme.colors.text }]}>{eventTitle(event, isRTL)}</Text>
                      {eventSubtitle(event, isRTL) ? (
                        <Text style={[styles.eventSubtitle, { color: theme.colors.textMuted }]}>{eventSubtitle(event, isRTL)}</Text>
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={[styles.emptyText, { color: theme.colors.textMuted }]}>{copy.noEvents}</Text>
            )}
          </>
        ) : null}
      </Card>

      <Card>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>{copy.monthEvents}</Text>
        {monthEvents.length ? (
          <ScrollView nestedScrollEnabled style={styles.monthEventsList}>
            <View style={styles.eventsStack}>
              {monthEvents.map(({ cell, event }) => (
                <View
                  key={`${cell.date.toISOString()}-${event.id}`}
                  style={[
                    styles.eventRow,
                    {
                      borderColor: theme.colors.border,
                      backgroundColor: theme.colors.card,
                    },
                  ]}
                >
                  <View style={[styles.eventStripe, { backgroundColor: CATEGORY_COLORS[event.category] ?? theme.colors.primary }]} />
                  <View style={styles.eventContent}>
                    <Text style={[styles.eventDateLine, { color: theme.colors.textMuted }]}>
                      {cell.date.toLocaleDateString(locale, { day: "numeric", month: "short" })} •{" "}
                      {formatNumber(cell.hijri.day, locale, isRTL)} {formatHijriMonthLabel(cell.hijri.monthKey, isRTL)}
                    </Text>
                    <Text style={[styles.eventTitle, { color: theme.colors.text }]}>{eventTitle(event, isRTL)}</Text>
                    {eventSubtitle(event, isRTL) ? (
                      <Text style={[styles.eventSubtitle, { color: theme.colors.textMuted }]}>{eventSubtitle(event, isRTL)}</Text>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>
        ) : (
          <Text style={[styles.emptyText, { color: theme.colors.textMuted }]}>{copy.noMonthEvents}</Text>
        )}
      </Card>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  headerWrap: { gap: 6 },
  title: { fontSize: 28, fontWeight: "800" },
  subtitle: { fontSize: 13, lineHeight: 18 },
  monthHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 12,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  monthCenter: { flex: 1, alignItems: "center" },
  monthLabel: { fontSize: 18, fontWeight: "700" },
  weekRow: {
    flexDirection: "row",
    marginBottom: 8,
  },
  weekLabel: {
    flex: 1,
    textAlign: "center",
    fontSize: 11,
    fontWeight: "700",
  },
  gridWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  dayCellSlot: {
    width: "14.2857%",
    padding: 3,
  },
  dayCellPlaceholder: {
    width: "100%",
    aspectRatio: 0.95,
  },
  dayCell: {
    width: "100%",
    aspectRatio: 0.95,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
    position: "relative",
    overflow: "hidden",
  },
  gregorianDay: {
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 18,
  },
  hijriDay: {
    marginTop: 1,
    fontSize: 10,
    fontWeight: "600",
  },
  eventDotsRow: {
    position: "absolute",
    bottom: 5,
    flexDirection: "row",
    gap: 2,
  },
  eventDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  todayPill: {
    position: "absolute",
    top: 3,
    right: 3,
    fontSize: 7,
    fontWeight: "700",
  },
  sectionTitle: { fontSize: 16, fontWeight: "700", marginBottom: 10 },
  selectedMetaRow: { gap: 2, marginBottom: 10 },
  selectedGregorian: { fontSize: 15, fontWeight: "700" },
  selectedHijri: { fontSize: 12, fontWeight: "600" },
  emptyText: { fontSize: 13, lineHeight: 18 },
  eventsStack: { gap: 8 },
  eventRow: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 10,
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  eventStripe: {
    width: 4,
    borderRadius: 999,
    alignSelf: "stretch",
  },
  eventContent: { flex: 1 },
  eventDateLine: { fontSize: 11, fontWeight: "600", marginBottom: 3 },
  eventTitle: { fontSize: 14, fontWeight: "700" },
  eventSubtitle: { marginTop: 4, fontSize: 12, lineHeight: 17 },
  monthEventsList: { maxHeight: 260 },
});

