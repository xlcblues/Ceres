import { describe, expect, it } from "vitest";
import type { DayLogs, Profile } from "./api";
import { predictTomorrowWeight } from "./prediction";

const profile: Profile = {
  height_cm: 175,
  age: 30,
  sex: "male",
  activity_level: 1.375,
};

function dayLogs(overrides: Partial<DayLogs> = {}): DayLogs {
  return {
    date: "2026-10-24",
    foods: [],
    exercises: [],
    water_ml: null,
    food_kcal: 0,
    exercise_kcal: 0,
    ...overrides,
  };
}

describe("predictTomorrowWeight", () => {
  it("predicts a lower weight when intake and exercise create a deficit", () => {
    const result = predictTomorrowWeight({
      currentWeightKg: 72,
      profile,
      dayLogs: dayLogs({ food_kcal: 1400, exercise_kcal: 300 }),
    });

    expect(result.tomorrowWeightKg).toBeLessThan(72);
    expect(result.changeKg).toBeLessThan(0);
    expect(result.bmr).toBeCloseTo(1668.8, 0);
    expect(result.tdee).toBeCloseTo(2294.5, 0);
    expect(result.energyBalance).toBeLessThan(0);
    expect(result.estimated).toBe(false);
  });

  it("predicts a higher weight on a calorie surplus", () => {
    const result = predictTomorrowWeight({
      currentWeightKg: 70,
      profile,
      dayLogs: dayLogs({ food_kcal: 3500 }),
    });

    expect(result.tomorrowWeightKg).toBeGreaterThan(70);
    expect(result.changeKg).toBeGreaterThan(0);
  });

  it("falls back to estimates when the profile is incomplete", () => {
    const result = predictTomorrowWeight({
      currentWeightKg: 70,
      profile: null,
      dayLogs: dayLogs({ food_kcal: 1600 }),
    });

    expect(result.estimated).toBe(true);
    expect(result.tomorrowWeightKg).not.toBeNull();
    expect(result.bmr).toBeGreaterThan(0);
  });

  it("returns null prediction without a current weight", () => {
    const result = predictTomorrowWeight({
      currentWeightKg: null,
      profile,
      dayLogs: dayLogs(),
    });

    expect(result.tomorrowWeightKg).toBeNull();
    expect(result.changeKg).toBeNull();
  });
});
