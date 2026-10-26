import { isValidDateKey, todayKey } from "./date";
import type { CeresMessages } from "../locales/zh-CN";

export const MAX_DISPLAY_WEIGHT = 500;

type ValidationMessages = CeresMessages["validation"];

const defaultMessages: ValidationMessages = {
  weightRequired: "请输入体重",
  weightPositive: "请输入大于 0 的体重",
  weightMax: "体重不应超过 {max}",
  weightDecimals: "体重最多支持两位小数",
  goalRequired: "请输入{label}",
  goalPositive: "{label}应大于 0",
  goalMax: "{label}不应超过 {max}",
  goalDecimals: "{label}最多支持两位小数",
  bodyFatRange: "体脂率应在 0-100 之间",
  validDate: "请选择有效日期",
  futureDate: "日期不能晚于今天",
};

export function validateWeightInput(
  raw: string,
  messages: ValidationMessages = defaultMessages,
): string | null {
  if (raw.trim() === "") return messages.weightRequired;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    return messages.weightPositive;
  }
  if (value > MAX_DISPLAY_WEIGHT) {
    return messages.weightMax.replace("{max}", String(MAX_DISPLAY_WEIGHT));
  }
  if (!/^\d+(\.\d{1,2})?$/.test(raw.trim())) {
    return messages.weightDecimals;
  }
  return null;
}

export function validateGoalWeightInput(
  raw: string,
  label: string,
  messages: ValidationMessages = defaultMessages,
): string | null {
  if (raw.trim() === "") {
    return messages.goalRequired.replace("{label}", label);
  }
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    return messages.goalPositive.replace("{label}", label);
  }
  if (value > MAX_DISPLAY_WEIGHT) {
    return messages.goalMax
      .replace("{label}", label)
      .replace("{max}", String(MAX_DISPLAY_WEIGHT));
  }
  if (!/^\d+(\.\d{1,2})?$/.test(raw.trim())) {
    return messages.goalDecimals.replace("{label}", label);
  }
  return null;
}

export function validateBodyFatInput(
  raw: string,
  messages: ValidationMessages = defaultMessages,
): string | null {
  if (raw.trim() === "") return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    return messages.bodyFatRange;
  }
  return null;
}

export function validateNotFutureDate(
  key: string,
  messages: ValidationMessages = defaultMessages,
): string | null {
  if (!isValidDateKey(key)) return messages.validDate;
  if (key > todayKey()) return messages.futureDate;
  return null;
}
