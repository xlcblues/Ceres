import { describe, expect, it } from "vitest";
import type { Entry, Goal } from "./api";
import { addDays, todayKey } from "./date";
import {
  computeEntryStats,
  formatSignedChange,
  formatWeight,
  fromDisplayWeight,
  toDisplayWeight,
  weightChange,
} from "./stats";

function entry(date: string, weight: number): Entry {
  return {
    id: 1,
    date,
    weight,
    body_fat: null,
    note: null,
    created_at: "",
    updated_at: "",
  };
}

describe("unit conversion", () => {
  it("converts kg to display weight", () => {
    expect(toDisplayWeight(72.4, "kg")).toBe(72.4);
    expect(toDisplayWeight(72.4, "lb")).toBeCloseTo(159.6, 1);
    expect(fromDisplayWeight(159.6, "lb")).toBeCloseTo(72.4, 1);
    expect(formatWeight(72.4, "kg")).toBe("72.4");
    expect(formatWeight(72.4, "lb")).toBe("159.6");
  });

  it("formats signed changes", () => {
    expect(formatSignedChange(-0.6, "kg")).toBe("-0.6");
    expect(formatSignedChange(0.2, "kg")).toBe("+0.2");
    expect(formatSignedChange(0, "kg")).toBe("0.0");
  });
});

describe("entry statistics", () => {
  const goal: Goal = {
    target_weight: 68,
    start_weight: 75.6,
    start_date: null,
  };

  it("computes current, average, range, and progress", () => {
    const entries = [
      entry(addDays(todayKey(), -2), 73.1),
      entry(addDays(todayKey(), -1), 72.8),
      entry(todayKey(), 72.4),
    ];
    const stats = computeEntryStats(entries, goal);
    expect(stats.count).toBe(3);
    expect(stats.currentWeight).toBe(72.4);
    expect(stats.average).toBeCloseTo(72.77, 1);
    expect(stats.lowest).toBe(72.4);
    expect(stats.highest).toBe(73.1);
    expect(stats.range).toBeCloseTo(0.7, 1);
    expect(stats.progressPercent).toBeCloseTo(42.1, 0);
    expect(stats.streakDays).toBe(3);
  });

  it("breaks streaks when a day is missing", () => {
    const entries = [
      entry(todayKey(), 72.4),
      entry(addDays(todayKey(), -2), 73.0),
    ];
    expect(computeEntryStats(entries, goal).streakDays).toBe(1);
  });

  it("reports week change and total change", () => {
    const entries = Array.from({ length: 14 }, (_, index) =>
      entry(addDays(todayKey(), -(13 - index)), 74.2 - index * 0.14),
    );
    const stats = computeEntryStats(entries, goal);
    expect(stats.weekChange).toBeCloseTo(-0.8, 1);
    expect(weightChange(entries)).toBeCloseTo(-1.8, 1);
    expect(stats.totalChange).toBeCloseTo(-3.2, 1);
  });
});
