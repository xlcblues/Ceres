import { invoke, isTauri } from "@tauri-apps/api/core";
import { toDateKey } from "./date";

export interface Goal {
  target_weight: number;
  start_weight: number | null;
  start_date: string | null;
}

export interface Entry {
  id: number;
  date: string;
  weight: number;
  body_fat: number | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface EntryInput {
  date: string;
  weight: number;
  body_fat: number | null;
  note: string | null;
}

export type Unit = "kg" | "lb";

const ENTRIES_KEY = "ceres.entries";
const GOAL_KEY = "ceres.goal";
const UNIT_KEY = "ceres.unit";

function readLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeLocal(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

const smallDelay = () => new Promise((resolve) => setTimeout(resolve, 60));

function ensureDemoSeed() {
  const demoRequested =
    new URLSearchParams(window.location.search).get("demo") === "1" ||
    localStorage.getItem("ceres.demo") === "1";
  if (!demoRequested) return;
  if (
    localStorage.getItem(ENTRIES_KEY) !== null ||
    localStorage.getItem(GOAL_KEY) !== null
  ) {
    return;
  }

  const now = new Date().toISOString();
  const weights = [
    74.2, 74.0, 73.7, 73.9, 73.2, 73.4, 73.0, 72.7, 73.1, 72.8, 72.6, 72.2,
    72.5, 72.4,
  ];
  const today = new Date();
  const entries: Entry[] = weights.map((weight, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (weights.length - 1 - index));
    return {
      id: index + 1,
      date: toDateKey(date),
      weight,
      body_fat: index % 3 === 0 ? null : Number((25.9 - index * 0.09).toFixed(1)),
      note: index === 0 ? "晨起空腹" : index % 4 === 2 ? "晚餐后" : null,
      created_at: now,
      updated_at: now,
    };
  });
  writeLocal(ENTRIES_KEY, entries);

  const startDate = new Date(today);
  startDate.setDate(today.getDate() - 21);
  writeLocal(GOAL_KEY, {
    target_weight: 68,
    start_weight: 75.6,
    start_date: toDateKey(startDate),
  });
}

export async function getGoal(): Promise<Goal | null> {
  if (isTauri()) return invoke<Goal | null>("get_goal");
  ensureDemoSeed();
  await smallDelay();
  return readLocal<Goal | null>(GOAL_KEY, null);
}

export async function saveGoal(goal: Goal): Promise<Goal> {
  if (isTauri()) return invoke<Goal>("save_goal", { goal });
  ensureDemoSeed();
  writeLocal(GOAL_KEY, goal);
  return goal;
}

export async function listEntries(limit = 500): Promise<Entry[]> {
  if (isTauri()) return invoke<Entry[]>("list_entries", { limit });
  ensureDemoSeed();
  await smallDelay();
  return readLocal<Entry[]>(ENTRIES_KEY, []).slice(0, limit);
}

export async function upsertEntry(input: EntryInput): Promise<Entry> {
  if (isTauri()) {
    return invoke<Entry>("upsert_entry", {
      date: input.date,
      weight: input.weight,
      body_fat: input.body_fat,
      note: input.note,
    });
  }

  ensureDemoSeed();
  const entries = readLocal<Entry[]>(ENTRIES_KEY, []);
  const now = new Date().toISOString();
  const existing = entries.find((entry) => entry.date === input.date);
  const entry: Entry = existing
    ? {
        ...existing,
        weight: input.weight,
        body_fat: input.body_fat,
        note: input.note?.trim() || null,
        updated_at: now,
      }
    : {
        id: entries.reduce((max, item) => Math.max(max, item.id), 0) + 1,
        date: input.date,
        weight: input.weight,
        body_fat: input.body_fat,
        note: input.note?.trim() || null,
        created_at: now,
        updated_at: now,
      };
  const next = existing
    ? entries.map((item) => (item.date === input.date ? entry : item))
    : [...entries, entry];
  writeLocal(
    ENTRIES_KEY,
    [...next].sort((a, b) => b.date.localeCompare(a.date)),
  );
  return entry;
}

export async function deleteEntry(date: string): Promise<boolean> {
  if (isTauri()) return invoke<boolean>("delete_entry", { date });
  ensureDemoSeed();
  const entries = readLocal<Entry[]>(ENTRIES_KEY, []);
  const next = entries.filter((entry) => entry.date !== date);
  writeLocal(ENTRIES_KEY, next);
  return next.length !== entries.length;
}

export function readUnit(): Unit {
  return localStorage.getItem(UNIT_KEY) === "lb" ? "lb" : "kg";
}

export function saveUnit(unit: Unit) {
  localStorage.setItem(UNIT_KEY, unit);
}

export type ExportFormat = "csv" | "json";

function renderLocalCsv(entries: Entry[]): string {
  const lines = [
    "date,weight_kg,body_fat,note,created_at,updated_at",
    ...entries.map((entry) => {
      const fields = [
        entry.date,
        String(entry.weight),
        entry.body_fat != null ? String(entry.body_fat) : "",
        entry.note ?? "",
        entry.created_at,
        entry.updated_at,
      ];
      return fields
        .map((field) => {
          if (/[",\r\n]/.test(field)) {
            return `"${field.replace(/"/g, '""')}"`;
          }
          return field;
        })
        .join(",");
    }),
  ];
  return lines.join("\n");
}

function downloadBlob(content: string, name: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export async function exportEntries(format: ExportFormat): Promise<string> {
  if (isTauri()) return invoke<string>("export_entries", { format });
  ensureDemoSeed();
  const sorted = [...readLocal<Entry[]>(ENTRIES_KEY, [])].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
  const from = sorted[0]?.date ?? "empty";
  const to = sorted.length ? sorted[sorted.length - 1].date : "empty";
  const name = `ceres-${from}-${to}.${format}`;
  if (format === "csv") {
    downloadBlob(renderLocalCsv(sorted), name, "text/csv;charset=utf-8");
  } else {
    downloadBlob(
      JSON.stringify(sorted, null, 2),
      name,
      "application/json;charset=utf-8",
    );
  }
  return name;
}
