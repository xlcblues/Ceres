import { describe, expect, it } from "vitest";
import {
  MAX_DISPLAY_WEIGHT,
  validateBodyFatInput,
  validateGoalWeightInput,
  validateNotFutureDate,
  validateWeightInput,
} from "./validation";

describe("weight input validation", () => {
  it("rejects empty and non-numeric input", () => {
    expect(validateWeightInput("")).toBe("请输入体重");
    expect(validateWeightInput("   ")).toBe("请输入体重");
    expect(validateWeightInput("abc")).toBe("请输入大于 0 的体重");
  });

  it("rejects zero, negative, and huge weights", () => {
    expect(validateWeightInput("0")).toBe("请输入大于 0 的体重");
    expect(validateWeightInput("-2")).toBe("请输入大于 0 的体重");
    expect(validateWeightInput(String(MAX_DISPLAY_WEIGHT + 1))).toBe(
      `体重不应超过 ${MAX_DISPLAY_WEIGHT}`,
    );
  });

  it("accepts reasonable weights", () => {
    expect(validateWeightInput("70.5")).toBeNull();
    expect(validateWeightInput("70.25")).toBeNull();
    expect(validateWeightInput(String(MAX_DISPLAY_WEIGHT))).toBeNull();
  });

  it("rejects more than two decimal places", () => {
    expect(validateWeightInput("70.123")).toBe("体重最多支持两位小数");
  });
});

describe("goal weight input validation", () => {
  it("uses the provided label in messages", () => {
    expect(validateGoalWeightInput("", "目标体重")).toBe("请输入目标体重");
    expect(validateGoalWeightInput("0", "目标体重")).toBe("目标体重应大于 0");
    expect(validateGoalWeightInput("999", "目标体重")).toBe(
      "目标体重不应超过 500",
    );
    expect(validateGoalWeightInput("68", "目标体重")).toBeNull();
    expect(validateGoalWeightInput("68.123", "目标体重")).toBe(
      "目标体重最多支持两位小数",
    );
  });
});

describe("body fat input validation", () => {
  it("allows empty optional input", () => {
    expect(validateBodyFatInput("")).toBeNull();
  });

  it("rejects values outside 0-100", () => {
    expect(validateBodyFatInput("-1")).toBe("体脂率应在 0-100 之间");
    expect(validateBodyFatInput("100.1")).toBe("体脂率应在 0-100 之间");
    expect(validateBodyFatInput("25.5")).toBeNull();
    expect(validateBodyFatInput("100")).toBeNull();
  });
});

describe("date boundary validation", () => {
  function keyFor(offsetDays: number): string {
    const date = new Date();
    date.setDate(date.getDate() + offsetDays);
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
    ].join("-");
  }

  it("rejects malformed dates", () => {
    expect(validateNotFutureDate("")).toBe("请选择有效日期");
    expect(validateNotFutureDate("2026-02-29")).toBe("请选择有效日期");
  });

  it("rejects future dates and accepts today/past dates", () => {
    expect(validateNotFutureDate(keyFor(1))).toBe("日期不能晚于今天");
    expect(validateNotFutureDate(keyFor(0))).toBeNull();
    expect(validateNotFutureDate("2020-01-01")).toBeNull();
  });
});
