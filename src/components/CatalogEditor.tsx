import { useEffect, useState } from "react";
import { Loader2, Sparkles, X } from "lucide-react";
import {
  aiEstimateExercise,
  aiEstimateFood,
  type ExerciseCatalogItem,
  type FoodCatalogItem,
} from "../lib/api";
import { useI18n } from "../lib/i18n";

export type CatalogEditTarget =
  | { kind: "food"; item: FoodCatalogItem }
  | { kind: "exercise"; item: ExerciseCatalogItem };

export function CatalogEditor({
  target,
  busy,
  onSave,
  onClose,
}: {
  target: CatalogEditTarget | null;
  busy: boolean;
  onSave: (
    input: Omit<FoodCatalogItem, "id"> | Omit<ExerciseCatalogItem, "id">,
  ) => void | Promise<void>;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [kcal, setKcal] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [unitName, setUnitName] = useState(t("life.unitGramDefault"));
  const [unitGrams, setUnitGrams] = useState("100");
  const [met, setMet] = useState("");
  const [estimating, setEstimating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!target) return;
    if (target.kind === "food") {
      const item = target.item;
      setName(item.name);
      setCategory(item.category);
      setKcal(String(item.kcal_per_100g));
      setProtein(item.protein != null ? String(item.protein) : "");
      setCarbs(item.carbs != null ? String(item.carbs) : "");
      setFat(item.fat != null ? String(item.fat) : "");
      setUnitName(item.unit_name);
      setUnitGrams(String(item.unit_grams));
      setMet("");
    } else {
      const item = target.item;
      setName(item.name);
      setCategory(item.category);
      setMet(String(item.met));
      setKcal("");
      setProtein("");
      setCarbs("");
      setFat("");
      setUnitName(t("life.unitGramDefault"));
      setUnitGrams("100");
    }
    setError(null);
  }, [target]);

  useEffect(() => {
    if (!target) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [target, onClose]);

  if (!target) return null;

  const foodTarget = target.kind === "food" ? target.item : null;

  const handleEstimate = async () => {
    if (!name.trim()) {
      setError(
        target.kind === "food"
          ? t("life.foodEstimateNameRequired")
          : t("life.exerciseEstimateNameRequired"),
      );
      return;
    }
    setEstimating(true);
    setError(null);
    try {
      if (target.kind === "food") {
        const estimate = await aiEstimateFood(name.trim());
        setKcal(String(Math.round(estimate.kcal_per_100g)));
        setCategory(estimate.category || category);
        setUnitName(estimate.unit_name || t("life.unitGramDefault"));
        setUnitGrams(
          estimate.unit_grams != null
            ? String(Math.round(estimate.unit_grams))
            : "100",
        );
      } else {
        const estimate = await aiEstimateExercise(name.trim());
        setMet(String(estimate.met));
        setCategory(estimate.category || category);
      }
    } catch (caught) {
      setError(String(caught));
    } finally {
      setEstimating(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError(
        target.kind === "food"
          ? t("life.foodNameRequired")
          : t("life.exerciseNameRequired"),
      );
      return;
    }
    if (target.kind === "food") {
      const kcalNumber = Number(kcal);
      const unitGramsNumber = Number(unitGrams);
      if (!Number.isFinite(kcalNumber) || kcalNumber <= 0) {
        setError(t("life.kcalPositive"));
        return;
      }
      if (!Number.isFinite(unitGramsNumber) || unitGramsNumber <= 0) {
        setError(t("life.unitGramsPositive"));
        return;
      }
      for (const value of [protein, carbs, fat]) {
        if (value.trim() && (Number(value) < 0 || !Number.isFinite(Number(value)))) {
          setError(t("life.macroNonNegative"));
          return;
        }
      }
      setError(null);
      try {
        await onSave({
          name: name.trim(),
          category: category.trim() || t("life.other"),
          kcal_per_100g: kcalNumber,
          protein: protein.trim() ? Number(protein) : null,
          carbs: carbs.trim() ? Number(carbs) : null,
          fat: fat.trim() ? Number(fat) : null,
          unit_name: unitName.trim() || t("life.unitGramDefault"),
          unit_grams: unitGramsNumber,
        });
        onClose();
      } catch (caught) {
        setError(String(caught));
      }
    } else {
      const metNumber = Number(met);
      if (!Number.isFinite(metNumber) || metNumber <= 0 || metNumber > 20) {
        setError(t("life.metRange"));
        return;
      }
      setError(null);
      try {
        await onSave({
          name: name.trim(),
          category: category.trim() || t("life.other"),
          met: metNumber,
        });
        onClose();
      } catch (caught) {
        setError(String(caught));
      }
    }
  };

  return (
    <div
      className="picker-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="picker-dialog catalog-editor"
        role="dialog"
        aria-modal="true"
        aria-label={
          target.kind === "food"
            ? t("life.editFoodLibrary")
            : t("life.editExerciseLibrary")
        }
      >
        <div className="picker-head">
          <div>
            <p className="panel-kicker">
              {target.kind === "food"
                ? t("life.foodKicker")
                : t("life.exerciseKicker")}
            </p>
            <h2>
              {target.kind === "food"
                ? t("life.editFoodLibrary")
                : t("life.editExerciseLibrary")}
            </h2>
          </div>
          <button
            className="icon-button"
            type="button"
            title={t("picker.close")}
            aria-label={t("picker.close")}
            onClick={onClose}
          >
            <X size={15} />
          </button>
        </div>
        <div className="life-form-grid">
          <div className="field field-wide">
            <label htmlFor="catalog-edit-name">{t("life.name")}</label>
            <input
              id="catalog-edit-name"
              type="text"
              value={name}
              autoFocus
              placeholder={
                target.kind === "food"
                  ? t("life.foodNamePlaceholder")
                  : t("life.exerciseNamePlaceholder")
              }
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="catalog-edit-category">{t("life.category")}</label>
            <input
              id="catalog-edit-category"
              type="text"
              value={category}
              placeholder={t("common.optional")}
              onChange={(event) => setCategory(event.target.value)}
            />
          </div>
          {target.kind === "food" && foodTarget ? (
            <>
              <div className="field">
                <label htmlFor="catalog-edit-kcal">{t("life.kcalPer100g")}</label>
                <input
                  id="catalog-edit-kcal"
                  type="number"
                  min="1"
                  step="0.1"
                  value={kcal}
                  placeholder="120"
                  onChange={(event) => setKcal(event.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="catalog-edit-protein">{t("life.protein")}</label>
                <input
                  id="catalog-edit-protein"
                  type="number"
                  min="0"
                  step="0.1"
                  value={protein}
                  placeholder={t("common.optional")}
                  onChange={(event) => setProtein(event.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="catalog-edit-carbs">{t("life.carbs")}</label>
                <input
                  id="catalog-edit-carbs"
                  type="number"
                  min="0"
                  step="0.1"
                  value={carbs}
                  placeholder={t("common.optional")}
                  onChange={(event) => setCarbs(event.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="catalog-edit-fat">{t("life.fat")}</label>
                <input
                  id="catalog-edit-fat"
                  type="number"
                  min="0"
                  step="0.1"
                  value={fat}
                  placeholder={t("common.optional")}
                  onChange={(event) => setFat(event.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="catalog-edit-unit">{t("life.unitName")}</label>
                <input
                  id="catalog-edit-unit"
                  type="text"
                  value={unitName}
                  onChange={(event) => setUnitName(event.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="catalog-edit-unit-grams">
                  {t("life.unitGrams")}
                </label>
                <input
                  id="catalog-edit-unit-grams"
                  type="number"
                  min="1"
                  step="1"
                  value={unitGrams}
                  onChange={(event) => setUnitGrams(event.target.value)}
                />
              </div>
            </>
          ) : (
            <div className="field">
              <label htmlFor="catalog-edit-met">{t("life.met")}</label>
              <input
                id="catalog-edit-met"
                type="number"
                min="0.1"
                max="20"
                step="0.1"
                value={met}
                placeholder="6.0"
                onChange={(event) => setMet(event.target.value)}
              />
            </div>
          )}
        </div>
        <div className="form-actions">
          <button
            className="secondary-button"
            type="button"
            disabled={busy || estimating}
            onClick={onClose}
          >
            <X size={14} /> {t("common.cancel")}
          </button>
          <button
            className="secondary-button"
            type="button"
            disabled={busy || estimating}
            onClick={() => void handleEstimate()}
          >
            <Sparkles size={14} />{" "}
            {estimating ? t("life.estimating") : t("life.aiEstimate")}
          </button>
          <button
            className="primary-button"
            type="button"
            disabled={busy || estimating}
            onClick={() => void handleSave()}
          >
            {busy ? <Loader2 className="spin" size={14} /> : null}
            {busy ? t("common.saving") : t("common.save")}
          </button>
        </div>
        {error ? <p className="life-status failed">{error}</p> : null}
      </div>
    </div>
  );
}
