import { Channel, invoke, isTauri } from "@tauri-apps/api/core";
import { EXERCISE_SEEDS, FOOD_SEEDS } from "./catalog-seeds";
import { toDateKey } from "./date";

export interface Goal {
  target_weight: number;
  start_weight: number | null;
  start_date: string | null;
  target_date: string | null;
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

export interface Profile {
  height_cm: number | null;
  age: number | null;
  sex: "male" | "female" | null;
  activity_level: number | null;
}

export interface FoodCatalogItem {
  id: number;
  name: string;
  category: string;
  kcal_per_100g: number;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  unit_name: string;
  unit_grams: number;
}

export interface ExerciseCatalogItem {
  id: number;
  name: string;
  category: string;
  met: number;
}

export interface FoodLogItem {
  id: number;
  date: string;
  food_id: number;
  name: string;
  category: string;
  grams: number;
  kcal: number;
}

export interface ExerciseLogItem {
  id: number;
  date: string;
  exercise_id: number;
  name: string;
  category: string;
  minutes: number;
  kcal: number;
}

export interface WaterLog {
  date: string;
  water_ml: number;
  updated_at: string;
}

export interface DayLogs {
  date: string;
  foods: FoodLogItem[];
  exercises: ExerciseLogItem[];
  water_ml: number | null;
  food_kcal: number;
  exercise_kcal: number;
}

export type Unit = "kg" | "lb" | "jin";

export const UNIT_LABELS: Record<Unit, string> = {
  kg: "kg",
  lb: "lb",
  jin: "斤",
};

export const UNIT_OPTIONS: Unit[] = ["kg", "jin", "lb"];

const ENTRIES_KEY = "ceres.entries";
const GOAL_KEY = "ceres.goal";
const UNIT_KEY = "ceres.unit";
const PROFILE_KEY = "ceres.profile";
const FOOD_CATALOG_KEY = "ceres.food_catalog";
const EXERCISE_CATALOG_KEY = "ceres.exercise_catalog";
const FOOD_LOG_KEY = "ceres.food_log";
const EXERCISE_LOG_KEY = "ceres.exercise_log";
const WATER_LOG_KEY = "ceres.water_log";

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

function seedCatalogs() {
  if (localStorage.getItem(FOOD_CATALOG_KEY) === null) {
    writeLocal(FOOD_CATALOG_KEY, FOOD_SEEDS);
  }
  if (localStorage.getItem(EXERCISE_CATALOG_KEY) === null) {
    writeLocal(EXERCISE_CATALOG_KEY, EXERCISE_SEEDS);
  }
}

function nextId(items: { id: number }[]): number {
  return items.reduce((max, item) => Math.max(max, item.id), 0) + 1;
}

function requireDate(value: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("日期格式无效");
  }
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
    target_date: toDateKey(new Date(today.getTime() + 90 * 86400000)),
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
      bodyFat: input.body_fat,
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
  const stored = localStorage.getItem(UNIT_KEY);
  return stored === "lb" || stored === "jin" ? stored : "kg";
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

export async function getProfile(): Promise<Profile | null> {
  if (isTauri()) return invoke<Profile | null>("get_profile");
  await smallDelay();
  return readLocal<Profile | null>(PROFILE_KEY, null);
}

export async function saveProfile(profile: Profile): Promise<Profile> {
  if (isTauri()) return invoke<Profile>("save_profile", { profile });
  writeLocal(PROFILE_KEY, profile);
  return profile;
}

export async function listFoodCatalog(): Promise<FoodCatalogItem[]> {
  if (isTauri()) return invoke<FoodCatalogItem[]>("list_food_catalog");
  seedCatalogs();
  await smallDelay();
  return readLocal<FoodCatalogItem[]>(FOOD_CATALOG_KEY, []);
}

export async function createFoodCatalogItem(
  input: Omit<FoodCatalogItem, "id">,
): Promise<FoodCatalogItem> {
  if (isTauri()) {
    return invoke<FoodCatalogItem>("create_food_catalog_item", {
      name: input.name,
      category: input.category,
      kcalPer100g: input.kcal_per_100g,
      protein: input.protein,
      carbs: input.carbs,
      fat: input.fat,
      unitName: input.unit_name,
      unitGrams: input.unit_grams,
    });
  }
  seedCatalogs();
  const items = readLocal<FoodCatalogItem[]>(FOOD_CATALOG_KEY, []);
  if (items.some((item) => item.name === input.name.trim())) {
    throw new Error("食物名称已存在");
  }
  const item: FoodCatalogItem = { ...input, id: nextId(items) };
  writeLocal(FOOD_CATALOG_KEY, [...items, item]);
  return item;
}

export async function listExerciseCatalog(): Promise<ExerciseCatalogItem[]> {
  if (isTauri()) return invoke<ExerciseCatalogItem[]>("list_exercise_catalog");
  seedCatalogs();
  await smallDelay();
  return readLocal<ExerciseCatalogItem[]>(EXERCISE_CATALOG_KEY, []);
}

export async function createExerciseCatalogItem(
  input: Omit<ExerciseCatalogItem, "id">,
): Promise<ExerciseCatalogItem> {
  if (isTauri()) {
    return invoke<ExerciseCatalogItem>("create_exercise_catalog_item", {
      name: input.name,
      category: input.category,
      met: input.met,
    });
  }
  seedCatalogs();
  const items = readLocal<ExerciseCatalogItem[]>(EXERCISE_CATALOG_KEY, []);
  if (items.some((item) => item.name === input.name.trim())) {
    throw new Error("运动名称已存在");
  }
  const item: ExerciseCatalogItem = { ...input, id: nextId(items) };
  writeLocal(EXERCISE_CATALOG_KEY, [...items, item]);
  return item;
}

export async function logFood(
  date: string,
  foodId: number,
  grams: number,
): Promise<FoodLogItem> {
  requireDate(date);
  if (isTauri()) {
    return invoke<FoodLogItem>("log_food", {
      date,
      foodId,
      grams,
    });
  }
  seedCatalogs();
  const catalog = readLocal<FoodCatalogItem[]>(FOOD_CATALOG_KEY, []);
  const food = catalog.find((item) => item.id === foodId);
  if (!food) throw new Error("食物不存在");
  const logs = readLocal<FoodLogItem[]>(FOOD_LOG_KEY, []);
  const item: FoodLogItem = {
    id: nextId(logs),
    date,
    food_id: food.id,
    name: food.name,
    category: food.category,
    grams,
    kcal: Number((food.kcal_per_100g * grams / 100).toFixed(1)),
  };
  writeLocal(FOOD_LOG_KEY, [...logs, item]);
  return item;
}

export async function logExercise(
  date: string,
  exerciseId: number,
  minutes: number,
  weightKg: number,
): Promise<ExerciseLogItem> {
  requireDate(date);
  if (isTauri()) {
    return invoke<ExerciseLogItem>("log_exercise", {
      date,
      exerciseId,
      minutes,
      weightKg,
    });
  }
  seedCatalogs();
  const catalog = readLocal<ExerciseCatalogItem[]>(EXERCISE_CATALOG_KEY, []);
  const exercise = catalog.find((item) => item.id === exerciseId);
  if (!exercise) throw new Error("运动不存在");
  const logs = readLocal<ExerciseLogItem[]>(EXERCISE_LOG_KEY, []);
  const item: ExerciseLogItem = {
    id: nextId(logs),
    date,
    exercise_id: exercise.id,
    name: exercise.name,
    category: exercise.category,
    minutes,
    kcal: Number((exercise.met * weightKg * minutes / 60).toFixed(1)),
  };
  writeLocal(EXERCISE_LOG_KEY, [...logs, item]);
  return item;
}

export async function deleteFoodLog(id: number): Promise<boolean> {
  if (isTauri()) return invoke<boolean>("delete_food_log", { id });
  const logs = readLocal<FoodLogItem[]>(FOOD_LOG_KEY, []);
  const next = logs.filter((item) => item.id !== id);
  writeLocal(FOOD_LOG_KEY, next);
  return next.length !== logs.length;
}

export async function deleteExerciseLog(id: number): Promise<boolean> {
  if (isTauri()) return invoke<boolean>("delete_exercise_log", { id });
  const logs = readLocal<ExerciseLogItem[]>(EXERCISE_LOG_KEY, []);
  const next = logs.filter((item) => item.id !== id);
  writeLocal(EXERCISE_LOG_KEY, next);
  return next.length !== logs.length;
}

export async function upsertWater(date: string, waterMl: number): Promise<WaterLog> {
  requireDate(date);
  if (isTauri()) {
    return invoke<WaterLog>("upsert_water", {
      date,
      waterMl,
    });
  }
  const logs = readLocal<WaterLog[]>(WATER_LOG_KEY, []);
  const now = new Date().toISOString();
  const existing = logs.find((item) => item.date === date);
  const record: WaterLog = {
    date,
    water_ml: waterMl,
    updated_at: existing?.updated_at ?? now,
  };
  writeLocal(
    WATER_LOG_KEY,
    existing
      ? logs.map((item) => (item.date === date ? record : item))
      : [...logs, record],
  );
  return record;
}

export async function getDayLogs(date: string): Promise<DayLogs> {
  requireDate(date);
  if (isTauri()) return invoke<DayLogs>("get_day_logs", { date });
  const foods = readLocal<FoodLogItem[]>(FOOD_LOG_KEY, []).filter(
    (item) => item.date === date,
  );
  const exercises = readLocal<ExerciseLogItem[]>(EXERCISE_LOG_KEY, []).filter(
    (item) => item.date === date,
  );
  const water = readLocal<WaterLog[]>(WATER_LOG_KEY, []).find(
    (item) => item.date === date,
  );
  return {
    date,
    foods,
    exercises,
    water_ml: water?.water_ml ?? null,
    food_kcal: foods.reduce((sum, item) => sum + item.kcal, 0),
    exercise_kcal: exercises.reduce((sum, item) => sum + item.kcal, 0),
  };
}

export interface AiConfig {
  provider: string;
  base_url: string;
  model: string;
  api_key: string;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export type AiAction =
  | {
      type: "weight";
      date: string;
      weightKg: number;
      bodyFat?: number | null;
      note?: string | null;
    }
  | {
      type: "food";
      date: string;
      name: string;
      category: string;
      grams: number;
      kcalPer100g: number;
      protein?: number | null;
      carbs?: number | null;
      fat?: number | null;
      unitName?: string;
      unitGrams?: number;
    }
  | {
      type: "exercise";
      date: string;
      name: string;
      category: string;
      minutes: number;
      met: number;
    }
  | { type: "water"; date: string; ml: number };

export interface FoodEstimate {
  name: string;
  category: string;
  kcal_per_100g: number;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  unit_name: string | null;
  unit_grams: number | null;
}

export interface ExerciseEstimate {
  name: string;
  category: string;
  met: number;
}

export interface AiApplyResult {
  applied: number;
  createdFoods: string[];
  createdExercises: string[];
  message: string;
}

export interface AiChatResponse {
  text: string;
  actions: AiAction[];
}

export interface StoredChatMessage {
  role: "user" | "assistant";
  content: string;
  actions: AiAction[];
  appliedSummary?: string | null;
}

export interface AiSessionMeta {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface AiSession {
  id: number;
  title: string;
  messages: StoredChatMessage[];
  created_at: string;
  updated_at: string;
}

export type AiStreamEvent =
  | { type: "delta"; text: string }
  | { type: "done"; actions: AiAction[] };

export const AI_PROVIDERS: {
  id: string;
  label: string;
  baseUrl: string;
  defaultModel: string;
}[] = [
  {
    id: "siliconflow",
    label: "硅基流动",
    baseUrl: "https://api.siliconflow.cn/v1",
    defaultModel: "deepseek-ai/DeepSeek-V3",
  },
  {
    id: "openai",
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4o-mini",
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    defaultModel: "deepseek-chat",
  },
  {
    id: "custom",
    label: "自定义",
    baseUrl: "",
    defaultModel: "",
  },
];

const AI_CONFIG_KEY = "ceres.ai_config";

export async function getAiConfig(): Promise<AiConfig | null> {
  if (isTauri()) return invoke<AiConfig | null>("get_ai_config");
  return readLocal<AiConfig | null>(AI_CONFIG_KEY, null);
}

export async function saveAiConfig(config: AiConfig): Promise<AiConfig> {
  if (isTauri()) return invoke<AiConfig>("save_ai_config", { config });
  writeLocal(AI_CONFIG_KEY, config);
  return config;
}

export async function testAiConnection(): Promise<string> {
  if (isTauri()) return invoke<string>("test_ai_connection");
  throw new Error("浏览器演示模式暂不支持 AI 连接测试");
}

const AI_SESSIONS_KEY = "ceres.ai_sessions";

function readLocalSessions(): AiSession[] {
  return readLocal<AiSession[]>(AI_SESSIONS_KEY, []);
}

function writeLocalSessions(sessions: AiSession[]) {
  writeLocal(AI_SESSIONS_KEY, sessions);
}

export async function listAiSessions(): Promise<AiSessionMeta[]> {
  if (isTauri()) return invoke<AiSessionMeta[]>("list_ai_sessions");
  return readLocalSessions()
    .map(({ id, title, created_at, updated_at }) => ({
      id,
      title,
      created_at,
      updated_at,
    }))
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

export async function getAiSession(id: number): Promise<AiSession | null> {
  if (isTauri()) return invoke<AiSession | null>("get_ai_session", { id });
  return readLocalSessions().find((session) => session.id === id) ?? null;
}

export async function saveAiSession(input: {
  id?: number;
  title: string;
  messages: StoredChatMessage[];
}): Promise<AiSession> {
  if (isTauri()) {
    return invoke<AiSession>("save_ai_session", {
      id: input.id ?? null,
      title: input.title,
      messages: input.messages,
    });
  }
  const sessions = readLocalSessions();
  const now = new Date().toISOString();
  let saved: AiSession;
  if (input.id != null) {
    const existing = sessions.find((session) => session.id === input.id);
    if (!existing) throw new Error("会话不存在");
    saved = {
      ...existing,
      title: input.title,
      messages: input.messages,
      updated_at: now,
    };
    const index = sessions.findIndex((session) => session.id === input.id);
    sessions[index] = saved;
  } else {
    saved = {
      id: nextId(sessions),
      title: input.title,
      messages: input.messages,
      created_at: now,
      updated_at: now,
    };
    sessions.push(saved);
  }
  writeLocalSessions(sessions);
  return saved;
}

export async function deleteAiSession(id: number): Promise<boolean> {
  if (isTauri()) return invoke<boolean>("delete_ai_session", { id });
  const sessions = readLocalSessions();
  const next = sessions.filter((session) => session.id !== id);
  if (next.length === sessions.length) return false;
  writeLocalSessions(next);
  return true;
}

export async function aiChat(
  prompt: string,
  history: ChatMessage[],
): Promise<AiChatResponse> {
  if (isTauri()) return invoke<AiChatResponse>("ai_chat", { prompt, history });
  throw new Error("浏览器演示模式暂不支持 AI 对话，请在桌面应用中连接 AI");
}

export async function aiChatStream(
  prompt: string,
  history: ChatMessage[],
  onDelta: (text: string) => void,
  onDone: (actions: AiAction[]) => void,
): Promise<AiChatResponse> {
  if (!isTauri()) {
    throw new Error("浏览器演示模式暂不支持 AI 对话，请在桌面应用中连接 AI");
  }
  const channel = new Channel<AiStreamEvent>();
  channel.onmessage = (event) => {
    if (event.type === "delta") onDelta(event.text);
    else if (event.type === "done") onDone(event.actions);
  };
  return invoke<AiChatResponse>("ai_chat_stream", {
    prompt,
    history,
    channel,
  });
}

export async function aiEstimateFood(
  name: string,
  amountText?: string | null,
): Promise<FoodEstimate> {
  if (isTauri()) {
    return invoke<FoodEstimate>("ai_estimate_food", {
      name,
      amountText: amountText || null,
    });
  }
  throw new Error("浏览器演示模式暂不支持 AI 估算，请在桌面应用中连接 AI");
}

export async function aiEstimateExercise(
  name: string,
  durationText?: string | null,
): Promise<ExerciseEstimate> {
  if (isTauri()) {
    return invoke<ExerciseEstimate>("ai_estimate_exercise", {
      name,
      durationText: durationText || null,
    });
  }
  throw new Error("浏览器演示模式暂不支持 AI 估算，请在桌面应用中连接 AI");
}

export async function aiApplyActions(
  actions: AiAction[],
): Promise<AiApplyResult> {
  if (isTauri()) return invoke<AiApplyResult>("ai_apply_actions", { actions });

  const createdFoods: string[] = [];
  const createdExercises: string[] = [];
  for (const action of actions) {
    if (action.type === "weight") {
      await upsertEntry({
        date: action.date,
        weight: action.weightKg,
        body_fat: action.bodyFat ?? null,
        note: action.note ?? null,
      });
    } else if (action.type === "food") {
      const catalog = readLocal<FoodCatalogItem[]>(FOOD_CATALOG_KEY, []);
      let food = catalog.find(
        (item) => item.name === action.name.trim(),
      );
      if (!food) {
        food = await createFoodCatalogItem({
          name: action.name.trim(),
          category: action.category || "其他",
          kcal_per_100g: action.kcalPer100g,
          protein: action.protein ?? null,
          carbs: action.carbs ?? null,
          fat: action.fat ?? null,
          unit_name: action.unitName || "克",
          unit_grams: action.unitGrams ?? 100,
        });
        createdFoods.push(food.name);
      }
      await logFood(action.date, food.id, action.grams);
    } else if (action.type === "exercise") {
      const catalog = readLocal<ExerciseCatalogItem[]>(EXERCISE_CATALOG_KEY, []);
      let exercise = catalog.find(
        (item) => item.name === action.name.trim(),
      );
      if (!exercise) {
        exercise = await createExerciseCatalogItem({
          name: action.name.trim(),
          category: action.category || "其他",
          met: action.met,
        });
        createdExercises.push(exercise.name);
      }
      const entries = readLocal<Entry[]>(ENTRIES_KEY, []);
      const latestWeight =
        entries[0]?.weight ??
        readLocal<Goal | null>(GOAL_KEY, null)?.start_weight ??
        60;
      await logExercise(action.date, exercise.id, action.minutes, latestWeight);
    } else if (action.type === "water") {
      await upsertWater(action.date, action.ml);
    }
  }
  return {
    applied: actions.length,
    createdFoods,
    createdExercises,
    message: `已录入 ${actions.length} 条记录`,
  };
}
