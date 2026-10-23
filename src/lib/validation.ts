import { isValidDateKey, todayKey } from "./date";

export const MAX_DISPLAY_WEIGHT = 500;

export function validateWeightInput(raw: string): string | null {
  if (raw.trim() === "") return "请输入体重";
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    return "请输入大于 0 的体重";
  }
  if (value > MAX_DISPLAY_WEIGHT) {
    return `体重不应超过 ${MAX_DISPLAY_WEIGHT}`;
  }
  return null;
}

export function validateGoalWeightInput(raw: string, label: string): string | null {
  if (raw.trim() === "") return `请输入${label}`;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    return `${label}应大于 0`;
  }
  if (value > MAX_DISPLAY_WEIGHT) {
    return `${label}不应超过 ${MAX_DISPLAY_WEIGHT}`;
  }
  return null;
}

export function validateBodyFatInput(raw: string): string | null {
  if (raw.trim() === "") return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    return "体脂率应在 0-100 之间";
  }
  return null;
}

export function validateNotFutureDate(key: string): string | null {
  if (!isValidDateKey(key)) return "请选择有效日期";
  if (key > todayKey()) return "日期不能晚于今天";
  return null;
}
