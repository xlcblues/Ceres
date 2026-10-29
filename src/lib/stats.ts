import type { Entry, Goal, Unit } from "./api";
import { addDays, todayKey } from "./date";

export const KG_TO_LB = 2.2046226218;
export const KG_TO_JIN = 2;

export function toDisplayWeight(value: number, unit: Unit): number {
  if (unit === "lb") return value * KG_TO_LB;
  if (unit === "jin") return value * KG_TO_JIN;
  return value;
}

export function fromDisplayWeight(value: number, unit: Unit): number {
  if (unit === "lb") return value / KG_TO_LB;
  if (unit === "jin") return value / KG_TO_JIN;
  return value;
}

export function formatWeight(value: number, unit: Unit, digits = 2): string {
  return toDisplayWeight(value, unit).toFixed(digits);
}

export function formatSignedChange(value: number, unit: Unit, digits = 2): string {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${toDisplayWeight(Math.abs(value), unit).toFixed(digits)}`;
}

export function weightChange(entries: Entry[]): number | null {
  if (entries.length < 2) return null;
  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));
  return Number(
    (sorted[0].weight - sorted[sorted.length - 1].weight).toFixed(2),
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
      ? Number((highest - lowest).toFixed(2))
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
        ).toFixed(2),
      );
    } else {
      weekChange = Number(
        (weights[0] - weights[weights.length - 1]).toFixed(2),
      );
    }
  }

  let totalChange: number | null = null;
  if (goal?.start_weight != null && currentWeight != null) {
    totalChange = Number((currentWeight - goal.start_weight).toFixed(2));
  } else if (count >= 2) {
    totalChange = Number((weights[0] - weights[weights.length - 1]).toFixed(2));
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

export type RangeKey = "7" | "30" | "90" | "all";

export const RANGE_DAYS: Record<RangeKey, number | null> = {
  "7": 7,
  "30": 30,
  "90": 90,
  all: null,
};

export const RANGE_LABELS: { key: RangeKey; label: string }[] = [
  { key: "7", label: "7 天" },
  { key: "30", label: "30 天" },
  { key: "90", label: "90 天" },
  { key: "all", label: "全部" },
];

export function sliceByRange(
  entries: Entry[],
  range: RangeKey,
  today = todayKey(),
): Entry[] {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const days = RANGE_DAYS[range];
  if (days == null) return sorted;
  const cutoff = addDays(today, -(days - 1));
  return sorted.filter((entry) => entry.date >= cutoff);
}

export function movingAverage(values: number[], window: number): number[] {
  return values.map((_, index) => {
    const start = Math.max(0, index - window + 1);
    const slice = values.slice(start, index + 1);
    return slice.reduce((sum, value) => sum + value, 0) / slice.length;
  });
}

export interface TrendStats {
  count: number;
  average: number | null;
  lowest: number | null;
  highest: number | null;
  range: number | null;
  first: number | null;
  last: number | null;
  change: number | null;
  trailingAverage: number | null;
  previousAverage: number | null;
  weekOverWeek: number | null;
}

export function computeTrendStats(entries: Entry[]): TrendStats {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const weights = sorted.map((entry) => entry.weight);
  const count = sorted.length;
  const average = count
    ? weights.reduce((sum, value) => sum + value, 0) / count
    : null;
  const lowest = count ? Math.min(...weights) : null;
  const highest = count ? Math.max(...weights) : null;
  const range =
    lowest !== null && highest !== null
      ? Number((highest - lowest).toFixed(2))
      : null;
  const first = count ? weights[0] : null;
  const last = count ? weights[weights.length - 1] : null;
  const change =
    first !== null && last !== null
      ? Number((last - first).toFixed(2))
      : null;

  let trailingAverage: number | null = null;
  let previousAverage: number | null = null;
  if (count) {
    const latestDate = sorted[count - 1].date;
    const trailing = sorted.filter((entry) => entry.date >= addDays(latestDate, -6));
    if (trailing.length) {
      trailingAverage =
        trailing.reduce((sum, entry) => sum + entry.weight, 0) / trailing.length;
      const prevStart = addDays(trailing[0].date, -1);
      const prevCutoff = addDays(trailing[0].date, -7);
      const previous = sorted.filter(
        (entry) => entry.date >= prevCutoff && entry.date <= prevStart,
      );
      if (previous.length) {
        previousAverage =
          previous.reduce((sum, entry) => sum + entry.weight, 0) /
          previous.length;
      }
    }
  }
  const weekOverWeek =
    trailingAverage !== null && previousAverage !== null
      ? Number((trailingAverage - previousAverage).toFixed(2))
      : null;

  return {
    count,
    average,
    lowest,
    highest,
    range,
    first,
    last,
    change,
    trailingAverage,
    previousAverage,
    weekOverWeek,
  };
}

export const LOSS_MILESTONES = [1, 2.5, 5, 7.5, 10];
export const GOAL_MILESTONE_PERCENTS = [10, 25, 50, 75, 100];

export interface LossMilestone {
  threshold: number;
  percent: number | null;
  targetWeight: number | null;
  reached: boolean;
  date: string | null;
  remaining: number | null;
}

export interface MilestoneInsights {
  streakDays: number;
  longestStreak: number;
  totalChange: number | null;
  daysTracked: number;
  milestones: LossMilestone[];
}

function currentStreak(dates: string[]): number {
  if (!dates.length) return 0;
  const set = new Set(dates);
  const today = todayKey();
  const latest = dates[dates.length - 1];
  if (latest !== today && latest !== addDays(today, -1)) return 0;
  let cursor = latest;
  let streak = 0;
  while (set.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

function longestStreak(dates: string[]): number {
  if (!dates.length) return 0;
  let best = 1;
  let run = 1;
  for (let index = 1; index < dates.length; index += 1) {
    if (addDays(dates[index - 1], 1) === dates[index]) {
      run += 1;
    } else {
      best = Math.max(best, run);
      run = 1;
    }
  }
  return Math.max(best, run);
}

export function computeMilestones(
  entries: Entry[],
  goal: Goal | null,
): MilestoneInsights {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const dates = sorted.map((entry) => entry.date);
  const baseline =
    goal?.start_weight != null
      ? goal.start_weight
      : sorted.length
        ? sorted[0].weight
        : null;
  const currentWeight = sorted.length ? sorted[sorted.length - 1].weight : null;
  const totalChange =
    baseline !== null && currentWeight !== null
      ? Number((currentWeight - baseline).toFixed(2))
      : null;

  const goalStartWeight = goal?.start_weight ?? null;
  const goalRange =
    goalStartWeight != null && goal != null
      ? Number((goalStartWeight - goal.target_weight).toFixed(2))
      : null;
  const milestoneDefs =
    goalRange !== null && goalRange > 0.001
      ? GOAL_MILESTONE_PERCENTS.map((percent) => {
          const loss = Number(((goalRange * percent) / 100).toFixed(2));
          return {
            threshold: loss,
            percent,
            targetWeight:
              goalStartWeight != null
                ? Number((goalStartWeight - loss).toFixed(2))
                : null,
          };
        })
      : LOSS_MILESTONES.map((threshold) => ({
          threshold,
          percent: null,
          targetWeight: null,
        }));

  const milestones: LossMilestone[] = milestoneDefs.map(
    ({ threshold, percent, targetWeight }) => {
      let reached = false;
      let date: string | null = null;
      if (baseline !== null) {
        for (const entry of sorted) {
          if (baseline - entry.weight >= threshold - 1e-9) {
            reached = true;
            date = entry.date;
            break;
          }
        }
      }
      const remaining =
        baseline !== null && currentWeight !== null
          ? Number((threshold - (baseline - currentWeight)).toFixed(2))
          : null;
      return { threshold, percent, targetWeight, reached, date, remaining };
    },
  );

  return {
    streakDays: currentStreak(dates),
    longestStreak: longestStreak(dates),
    totalChange,
    daysTracked: sorted.length,
    milestones,
  };
}
