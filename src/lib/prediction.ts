import type { DayLogs, Profile } from "./api";

export interface PredictionInput {
  currentWeightKg: number | null;
  profile: Profile | null;
  dayLogs: DayLogs | null;
}

export interface PredictionResult {
  tomorrowWeightKg: number | null;
  changeKg: number | null;
  bmr: number;
  tdee: number;
  intakeKcal: number;
  exerciseKcal: number;
  netKcal: number;
  energyBalance: number;
  estimated: boolean;
}

export const KCAL_PER_KG = 7700;

export function predictTomorrowWeight(input: PredictionInput): PredictionResult {
  const currentWeight = input.currentWeightKg;
  const intakeKcal = input.dayLogs?.food_kcal ?? 0;
  const exerciseKcal = input.dayLogs?.exercise_kcal ?? 0;
  const empty: PredictionResult = {
    tomorrowWeightKg: null,
    changeKg: null,
    bmr: 0,
    tdee: 0,
    intakeKcal,
    exerciseKcal,
    netKcal: Number((intakeKcal - exerciseKcal).toFixed(1)),
    energyBalance: intakeKcal - exerciseKcal,
    estimated: false,
  };

  if (
    currentWeight == null ||
    !Number.isFinite(currentWeight) ||
    currentWeight <= 0
  ) {
    return empty;
  }

  const profile = input.profile;
  const height = profile?.height_cm ?? null;
  const age = profile?.age ?? null;
  const sex = profile?.sex ?? null;
  const activity = profile?.activity_level ?? null;
  const estimated =
    height == null || age == null || sex == null || activity == null;

  const heightCm = height ?? 170;
  const ageYears = age ?? 30;
  const sexConstant =
    sex === "male" ? 5 : sex === "female" ? -161 : -78;
  const bmr =
    10 * currentWeight + 6.25 * heightCm - 5 * ageYears + sexConstant;
  const activityFactor = activity ?? 1.2;
  const tdee = bmr * activityFactor;
  const energyBalance = intakeKcal - tdee - exerciseKcal;
  const changeKg = Number((energyBalance / KCAL_PER_KG).toFixed(2));

  return {
    tomorrowWeightKg: Number((currentWeight + changeKg).toFixed(2)),
    changeKg,
    bmr: Number(bmr.toFixed(1)),
    tdee: Number(tdee.toFixed(1)),
    intakeKcal: Number(intakeKcal.toFixed(1)),
    exerciseKcal: Number(exerciseKcal.toFixed(1)),
    netKcal: Number((intakeKcal - exerciseKcal).toFixed(1)),
    energyBalance: Number(energyBalance.toFixed(1)),
    estimated,
  };
}
