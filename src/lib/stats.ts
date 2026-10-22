import type { Entry, Goal, Unit } from "./api";
import { addDays, todayKey } from "./date";

export const KG_TO_LB = 2.2046226218;

export function toDisplayWeight(value: number, unit: Unit): number {
  return unit === "lb" ? value * KG_TO_LB : value;
}

export function fromDisplayWeight(value: number, unit: Unit): number {
  return unit === "lb" ? value / KG_TO_LB : value;
}

export function formatWeight(value: number, unit: Unit, digits = 1): string {
  return toDisplayWeight(value, unit).toFixed(digits);
}

export function formatSignedChange(value: number, unit: Unit, digits = 1): string {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${toDisplayWeight(Math.abs(value), unit).toFixed(digits)}`;
}

export function weightChange(entries: Entry[]): number | null {
  if (entries.length < 2) return null;
  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));
  return Number(
    (sorted[0].weight - sorted[sorted.length - 1].weight).toFixed(1),
  );
}

export interface EntryStats {
  currentWeight: number | null;
  streakDays: number;
  weekChange: number | null;
  totalChange: number | null;
  progressPercent: number | null;
  average: number | null;
  lowest: number | null;
  highest: number | null;
  range: number | null;
  count: number;
}

export function computeEntryStats(
  entries: Entry[],
  goal: Goal | null,
): EntryStats {
  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));
  const weights = sorted.map((entry) => entry.weight);
  const count = sorted.length;
  const currentWeight = count ? weights[0] : null;
  const average = count
    ? weights.reduce((sum, value) => sum + value, 0) / count
    : null;
  const lowest = count ? Math.min(...weights) : null;
  const highest = count ? Math.max(...weights) : null;
  const range =
    lowest !== null && highest !== null
      ? Number((highest - lowest).toFixed(1))
      : null;

  let weekChange: number | null = null;
  if (count >= 2) {
    const cutoff = addDays(sorted[0].date, -6);
    const windowEntries = sorted.filter((entry) => entry.date >= cutoff);
    if (windowEntries.length >= 2) {
      weekChange = Number(
        (
          windowEntries[0].weight -
          windowEntries[windowEntries.length - 1].weight
        ).toFixed(1),
      );
    } else {
      weekChange = Number(
        (weights[0] - weights[weights.length - 1]).toFixed(1),
      );
    }
  }

  let totalChange: number | null = null;
  if (goal?.start_weight != null && currentWeight != null) {
    totalChange = Number((currentWeight - goal.start_weight).toFixed(1));
  } else if (count >= 2) {
    totalChange = Number((weights[0] - weights[weights.length - 1]).toFixed(1));
  }

  let progressPercent: number | null = null;
  if (goal && goal.start_weight != null && currentWeight != null) {
    const distance = goal.start_weight - goal.target_weight;
    if (Math.abs(distance) < 0.001) {
      progressPercent = 100;
    } else {
      progressPercent = Math.min(
        100,
        Math.max(
          0,
          ((goal.start_weight - currentWeight) / distance) * 100,
        ),
      );
    }
  }

  let streakDays = 0;
  if (count) {
    const dates = new Set(sorted.map((entry) => entry.date));
    const today = todayKey();
    const latest = sorted[0].date;
    if (latest === today || latest === addDays(today, -1)) {
      let cursor = latest;
      while (dates.has(cursor)) {
        streakDays += 1;
        cursor = addDays(cursor, -1);
      }
    }
  }

  return {
    currentWeight,
    streakDays,
    weekChange,
    totalChange,
    progressPercent,
    average,
    lowest,
    highest,
    range,
    count,
  };
}
