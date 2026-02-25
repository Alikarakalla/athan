export interface ShiaEventDefinition {
  id: string;
  hijriMonth: string;
  hijriDay: number;
  category: 'eid' | 'wiladah' | 'shahadah' | 'commemoration';
  titleEn: string;
  titleAr: string;
  subtitleEn?: string;
  subtitleAr?: string;
}

export interface HijriDateParts {
  day: number;
  monthKey: string;
  monthLabelEn: string;
  year: number;
}

export interface CalendarDayCell {
  date: Date;
  gregorianDay: number;
  hijri: HijriDateParts;
  events: ShiaEventDefinition[];
}
