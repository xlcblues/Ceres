export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function todayKey(): string {
  return toDateKey(new Date());
}

export function parseDateKey(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function isValidDateKey(key: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  return toDateKey(parseDateKey(key)) === key;
}

export function addDays(key: string, amount: number): string {
  const date = parseDateKey(key);
  date.setDate(date.getDate() + amount);
  return toDateKey(date);
}

export function formatChineseDate(key: string): string {
  const date = parseDateKey(key);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

export function formatShortDate(key: string, locale = "zh-CN"): string {
  if (locale === "zh-CN") return formatChineseDate(key);
  const date = parseDateKey(key);
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
  }).format(date);
}

export function formatFullDate(key: string, locale = "zh-CN"): string {
  if (locale === "zh-CN") {
    const date = parseDateKey(key);
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
  }
  const date = parseDateKey(key);
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

export function formatMonthKey(key: string, locale = "zh-CN"): string {
  const [year, month] = key.split("-").map(Number);
  if (!year || !month) return key;
  if (locale === "zh-CN") return `${year}年${month}月`;
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "long",
  }).format(new Date(year, month - 1, 1));
}

export function formatToday(date: Date, locale = "zh-CN"): string {
  if (locale === "zh-CN") {
    const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 · ${
      weekdays[date.getDay()]
    }`;
  }
  const dateText = new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
  const weekday = new Intl.DateTimeFormat(locale, {
    weekday: "long",
  }).format(date);
  return `${dateText} · ${weekday}`;
}

/*
 * Kept for backward compatibility; the app UI should use the locale-aware
 * formatShortDate/formatFullDate/formatToday variants.
 */
export function formatFullDateLegacy(key: string): string {
  const date = parseDateKey(key);
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

