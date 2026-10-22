import { describe, expect, it } from "vitest";
import {
  addDays,
  formatChineseDate,
  formatFullDate,
  isValidDateKey,
  parseDateKey,
  toDateKey,
  todayKey,
} from "./date";

describe("date utilities", () => {
  it("formats a date key from a Date", () => {
    expect(toDateKey(new Date(2026, 9, 5))).toBe("2026-10-05");
    expect(toDateKey(new Date(2026, 11, 31))).toBe("2026-12-31");
  });

  it("round-trips through parseDateKey", () => {
    expect(parseDateKey("2026-10-05").getFullYear()).toBe(2026);
    expect(parseDateKey("2026-10-05").getMonth()).toBe(9);
    expect(toDateKey(parseDateKey("2026-10-05"))).toBe("2026-10-05");
  });

  it("validates real calendar dates", () => {
    expect(isValidDateKey("2026-10-05")).toBe(true);
    expect(isValidDateKey("2024-02-29")).toBe(true);
    expect(isValidDateKey("2023-02-29")).toBe(false);
    expect(isValidDateKey("2026-13-01")).toBe(false);
    expect(isValidDateKey("2026-10-32")).toBe(false);
    expect(isValidDateKey("26-10-05")).toBe(false);
    expect(isValidDateKey("2026/10/05")).toBe(false);
  });

  it("adds and subtracts calendar days", () => {
    expect(addDays("2026-10-05", 1)).toBe("2026-10-06");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
  });

  it("formats Chinese display strings", () => {
    expect(formatChineseDate("2026-10-05")).toBe("10月5日");
    expect(formatFullDate("2026-10-05")).toBe("2026年10月5日");
  });

  it("todayKey matches the local date", () => {
    expect(todayKey()).toBe(toDateKey(new Date()));
  });
});
