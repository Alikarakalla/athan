import type { CalendarDayCell, HijriDateParts, ShiaEventDefinition } from "../types/calendar";

const MONTH_ALIASES: Record<string, string> = {
  muharram: "Muharram",
  safar: "Safar",
  rabiialawwal: "Rabi al-Awwal",
  rabialawwal: "Rabi al-Awwal",
  rabii: "Rabi al-Awwal",
  rabiii: "Rabi al-Thani",
  rabiialthani: "Rabi al-Thani",
  rabialthani: "Rabi al-Thani",
  jumadaalawwal: "Jumada al-Awwal",
  jumadai: "Jumada al-Awwal",
  jumadaalula: "Jumada al-Awwal",
  jumadaalthani: "Jumada al-Thani",
  jumadaii: "Jumada al-Thani",
  jumadaalakhirah: "Jumada al-Thani",
  rajab: "Rajab",
  shaban: "Shaban",
  shabanh: "Shaban",
  ramadan: "Ramadan",
  shawwal: "Shawwal",
  dhualqidah: "Dhu al-Qadah",
  dhulqidah: "Dhu al-Qadah",
  zulqadah: "Dhu al-Qadah",
  dhualhijjah: "Dhu al-Hijjah",
  dhulhijjah: "Dhu al-Hijjah",
  zulhijjah: "Dhu al-Hijjah",
};

const normalizeMonth = (value: string): string =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[?'’`-]/g, "")
    .replace(/[^a-z]/g, "");

export const SHIA_EVENT_DEFINITIONS: ShiaEventDefinition[] = [
  {
    id: "muh-1",
    hijriMonth: "Muharram",
    hijriDay: 1,
    category: "commemoration",
    titleEn: "Beginning of Muharram",
    titleAr: "????? ??? ????",
    subtitleEn: "Start of the sacred month and mourning season.",
    subtitleAr: "????? ????? ?????? ????? ??????.",
  },
  {
    id: "muh-9",
    hijriMonth: "Muharram",
    hijriDay: 9,
    category: "commemoration",
    titleEn: "Tasu'a",
    titleAr: "???????",
    subtitleEn: "Eve of Ashura; remembrance of Karbala.",
    subtitleAr: "???? ??????? ????? ??????.",
  },
  {
    id: "muh-10",
    hijriMonth: "Muharram",
    hijriDay: 10,
    category: "shahadah",
    titleEn: "Ashura (Martyrdom of Imam Husayn)",
    titleAr: "??????? (??????? ?????? ??????)",
    subtitleEn: "Major day of mourning in Karbala remembrance.",
    subtitleAr: "???? ???? ?????? ?? ???? ??????.",
  },
  {
    id: "muh-11",
    hijriMonth: "Muharram",
    hijriDay: 11,
    category: "commemoration",
    titleEn: "Captivity of Ahl al-Bayt",
    titleAr: "??? ??? ?????",
  },
  {
    id: "safar-1",
    hijriMonth: "Safar",
    hijriDay: 1,
    category: "commemoration",
    titleEn: "Beginning of Safar",
    titleAr: "????? ???",
  },
  {
    id: "safar-20",
    hijriMonth: "Safar",
    hijriDay: 20,
    category: "commemoration",
    titleEn: "Arbaeen",
    titleAr: "????????",
    subtitleEn: "40th day after Ashura (Ziyarat Arbaeen).",
    subtitleAr: "????? ???????? ??? ??????? (????? ????????).",
  },
  {
    id: "safar-28",
    hijriMonth: "Safar",
    hijriDay: 28,
    category: "shahadah",
    titleEn: "Demise of Prophet Muhammad & Martyrdom of Imam Hasan",
    titleAr: "???? ????? ???? ???????? ?????? ?????",
  },
  {
    id: "safar-30",
    hijriMonth: "Safar",
    hijriDay: 30,
    category: "shahadah",
    titleEn: "Martyrdom of Imam al-Rida",
    titleAr: "??????? ?????? ?????",
  },
  {
    id: "rabi1-8",
    hijriMonth: "Rabi al-Awwal",
    hijriDay: 8,
    category: "shahadah",
    titleEn: "Martyrdom of Imam Hasan al-Askari",
    titleAr: "??????? ?????? ????? ???????",
  },
  {
    id: "rabi1-9",
    hijriMonth: "Rabi al-Awwal",
    hijriDay: 9,
    category: "commemoration",
    titleEn: "Start of Imamate of Imam al-Mahdi",
    titleAr: "??? ????? ?????? ??????",
  },
  {
    id: "rabi1-17",
    hijriMonth: "Rabi al-Awwal",
    hijriDay: 17,
    category: "wiladah",
    titleEn: "Birth of Prophet Muhammad & Imam Ja'far al-Sadiq",
    titleAr: "???? ????? ???? ??????? ???? ??????",
  },
  {
    id: "rabi2-8",
    hijriMonth: "Rabi al-Thani",
    hijriDay: 8,
    category: "wiladah",
    titleEn: "Birth of Imam Hasan al-Askari",
    titleAr: "???? ?????? ????? ???????",
  },
  {
    id: "jum1-15",
    hijriMonth: "Jumada al-Awwal",
    hijriDay: 15,
    category: "wiladah",
    titleEn: "Birth of Lady Zaynab",
    titleAr: "???? ?????? ????",
  },
  {
    id: "jum2-3",
    hijriMonth: "Jumada al-Thani",
    hijriDay: 3,
    category: "shahadah",
    titleEn: "Martyrdom of Lady Fatimah al-Zahra (Fatimiyyah II)",
    titleAr: "??????? ?????? ????? ??????? (???????? ???????)",
  },
  {
    id: "jum2-20",
    hijriMonth: "Jumada al-Thani",
    hijriDay: 20,
    category: "wiladah",
    titleEn: "Birth of Lady Fatimah al-Zahra",
    titleAr: "???? ?????? ????? ???????",
  },
  {
    id: "rajab-1",
    hijriMonth: "Rajab",
    hijriDay: 1,
    category: "wiladah",
    titleEn: "Birth of Imam Muhammad al-Baqir",
    titleAr: "???? ?????? ???? ??????",
  },
  {
    id: "rajab-3",
    hijriMonth: "Rajab",
    hijriDay: 3,
    category: "shahadah",
    titleEn: "Martyrdom of Imam Ali al-Hadi",
    titleAr: "??????? ?????? ??? ??????",
  },
  {
    id: "rajab-10",
    hijriMonth: "Rajab",
    hijriDay: 10,
    category: "wiladah",
    titleEn: "Birth of Imam Muhammad al-Taqi (al-Jawad)",
    titleAr: "???? ?????? ???? ????? (??????)",
  },
  {
    id: "rajab-13",
    hijriMonth: "Rajab",
    hijriDay: 13,
    category: "wiladah",
    titleEn: "Birth of Imam Ali ibn Abi Talib",
    titleAr: "???? ?????? ??? ?? ??? ????",
  },
  {
    id: "rajab-15",
    hijriMonth: "Rajab",
    hijriDay: 15,
    category: "shahadah",
    titleEn: "Martyrdom of Lady Zaynab (commonly observed)",
    titleAr: "??????? ?????? ???? (????)",
  },
  {
    id: "rajab-25",
    hijriMonth: "Rajab",
    hijriDay: 25,
    category: "shahadah",
    titleEn: "Martyrdom of Imam Musa al-Kazim",
    titleAr: "??????? ?????? ???? ??????",
  },
  {
    id: "rajab-27",
    hijriMonth: "Rajab",
    hijriDay: 27,
    category: "eid",
    titleEn: "Mab'ath (First Revelation)",
    titleAr: "?????? ??????",
  },
  {
    id: "shaban-3",
    hijriMonth: "Shaban",
    hijriDay: 3,
    category: "wiladah",
    titleEn: "Birth of Imam Husayn",
    titleAr: "???? ?????? ??????",
  },
  {
    id: "shaban-4",
    hijriMonth: "Shaban",
    hijriDay: 4,
    category: "wiladah",
    titleEn: "Birth of Al-Abbas ibn Ali",
    titleAr: "???? ?????? ?? ???",
  },
  {
    id: "shaban-5",
    hijriMonth: "Shaban",
    hijriDay: 5,
    category: "wiladah",
    titleEn: "Birth of Imam Zayn al-Abidin",
    titleAr: "???? ?????? ??? ????????",
  },
  {
    id: "shaban-11",
    hijriMonth: "Shaban",
    hijriDay: 11,
    category: "wiladah",
    titleEn: "Birth of Ali al-Akbar",
    titleAr: "???? ??? ??????",
  },
  {
    id: "shaban-15",
    hijriMonth: "Shaban",
    hijriDay: 15,
    category: "wiladah",
    titleEn: "Birth of Imam al-Mahdi (Nisf Sha'ban)",
    titleAr: "???? ?????? ?????? (????? ?? ?????)",
  },
  {
    id: "ramadan-15",
    hijriMonth: "Ramadan",
    hijriDay: 15,
    category: "wiladah",
    titleEn: "Birth of Imam Hasan al-Mujtaba",
    titleAr: "???? ?????? ????? ???????",
  },
  {
    id: "ramadan-19",
    hijriMonth: "Ramadan",
    hijriDay: 19,
    category: "commemoration",
    titleEn: "Strike of Imam Ali",
    titleAr: "???? ?????? ???",
  },
  {
    id: "ramadan-21",
    hijriMonth: "Ramadan",
    hijriDay: 21,
    category: "shahadah",
    titleEn: "Martyrdom of Imam Ali",
    titleAr: "??????? ?????? ???",
  },
  {
    id: "shawwal-1",
    hijriMonth: "Shawwal",
    hijriDay: 1,
    category: "eid",
    titleEn: "Eid al-Fitr",
    titleAr: "??? ?????",
  },
  {
    id: "shawwal-25",
    hijriMonth: "Shawwal",
    hijriDay: 25,
    category: "shahadah",
    titleEn: "Martyrdom of Imam Ja'far al-Sadiq",
    titleAr: "??????? ?????? ???? ??????",
  },
  {
    id: "dhq-11",
    hijriMonth: "Dhu al-Qadah",
    hijriDay: 11,
    category: "wiladah",
    titleEn: "Birth of Imam al-Rida",
    titleAr: "???? ?????? ?????",
  },
  {
    id: "dhh-1",
    hijriMonth: "Dhu al-Hijjah",
    hijriDay: 1,
    category: "wiladah",
    titleEn: "Marriage of Imam Ali and Lady Fatimah",
    titleAr: "???? ?????? ??? ??????? ?????",
  },
  {
    id: "dhh-7",
    hijriMonth: "Dhu al-Hijjah",
    hijriDay: 7,
    category: "shahadah",
    titleEn: "Martyrdom of Imam Muhammad al-Baqir",
    titleAr: "??????? ?????? ???? ??????",
  },
  {
    id: "dhh-9",
    hijriMonth: "Dhu al-Hijjah",
    hijriDay: 9,
    category: "eid",
    titleEn: "Day of Arafah",
    titleAr: "??? ????",
  },
  {
    id: "dhh-10",
    hijriMonth: "Dhu al-Hijjah",
    hijriDay: 10,
    category: "eid",
    titleEn: "Eid al-Adha",
    titleAr: "??? ??????",
  },
  {
    id: "dhh-15",
    hijriMonth: "Dhu al-Hijjah",
    hijriDay: 15,
    category: "wiladah",
    titleEn: "Birth of Imam Ali al-Hadi",
    titleAr: "???? ?????? ??? ??????",
  },
  {
    id: "dhh-18",
    hijriMonth: "Dhu al-Hijjah",
    hijriDay: 18,
    category: "eid",
    titleEn: "Eid al-Ghadir",
    titleAr: "??? ??????",
  },
  {
    id: "dhh-24",
    hijriMonth: "Dhu al-Hijjah",
    hijriDay: 24,
    category: "commemoration",
    titleEn: "Mubahala",
    titleAr: "??? ????????",
  },
  {
    id: "dhh-25",
    hijriMonth: "Dhu al-Hijjah",
    hijriDay: 25,
    category: "commemoration",
    titleEn: "Surah al-Insan / Hal Ata remembrance",
    titleAr: "???? ???? ??????? (?? ???)",
  },
];

const EVENT_INDEX = new Map<string, ShiaEventDefinition[]>();
for (const event of SHIA_EVENT_DEFINITIONS) {
  const key = `${event.hijriMonth}:${event.hijriDay}`;
  const arr = EVENT_INDEX.get(key) ?? [];
  arr.push(event);
  EVENT_INDEX.set(key, arr);
}

export const parseHijriDateParts = (date: Date, timeZone?: string): HijriDateParts => {
  const formatter = new Intl.DateTimeFormat("en-u-ca-islamic", {
    timeZone,
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const parts = formatter.formatToParts(date);
  const day = Number.parseInt(parts.find((p) => p.type === "day")?.value ?? "1", 10);
  const monthLabelEn = parts.find((p) => p.type === "month")?.value ?? "Muharram";
  const year = Number.parseInt(parts.find((p) => p.type === "year")?.value ?? "1446", 10);
  const normalized = normalizeMonth(monthLabelEn);
  const monthKey = MONTH_ALIASES[normalized] ?? monthLabelEn;

  return {
    day: Number.isFinite(day) ? day : 1,
    monthKey,
    monthLabelEn,
    year: Number.isFinite(year) ? year : 1446,
  };
};

export const getShiaEventsForHijriDate = (hijri: HijriDateParts): ShiaEventDefinition[] => {
  return EVENT_INDEX.get(`${hijri.monthKey}:${hijri.day}`) ?? [];
};

export const buildCalendarDayCell = (date: Date, timeZone?: string): CalendarDayCell => {
  const hijri = parseHijriDateParts(date, timeZone);
  return {
    date,
    gregorianDay: date.getDate(),
    hijri,
    events: getShiaEventsForHijriDate(hijri),
  };
};
