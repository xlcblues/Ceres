import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import {
  Activity,
  Apple,
  Award,
  Bell,
  Bot,
  CalendarDays,
  Check,
  ChevronDown,
  Download,
  Dumbbell,
  FileJson,
  FileSpreadsheet,
  Flame,
  GlassWater,
  LayoutDashboard,
  Languages,
  Monitor,
  Moon,
  NotebookPen,
  Pencil,
  Plus,
  Scale,
  Search,
  Send,
  Settings,
  Sparkles,
  Sun,
  Target,
  Trash2,
  TrendingUp,
  Wand2,
  X,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "./App.css";
import { TrendChart, canDrawGoal } from "./components/TrendChart";
import { useTheme, type ThemePreference } from "./theme";
import {
  createExerciseCatalogItem,
  createFoodCatalogItem,
  deleteEntry,
  deleteExerciseLog,
  deleteFoodLog,
  exportEntries,
  getDayLogs,
  getGoal,
  getProfile,
  getAiConfig,
  listEntries,
  listExerciseCatalog,
  listFoodCatalog,
  logExercise,
  logFood,
  readUnit,
  saveGoal,
  saveAiConfig,
  saveProfile,
  saveUnit,
  aiApplyActions,
  deleteAiSession,
  getAiSession,
  listAiSessions,
  saveAiSession,
  testAiConnection,
  aiChatStream,
  aiEstimateExercise,
  aiEstimateFood,
  upsertEntry,
  upsertWater,
  AI_PROVIDERS,
  UNIT_LABELS,
  UNIT_OPTIONS,
  type AiAction,
  type AiConfig,
  type AiSessionMeta,
  type ChatMessage,
  type DayLogs,
  type Entry,
  type ExerciseCatalogItem,
  type ExportFormat,
  type FoodCatalogItem,
  type Goal,
  type Profile,
  type StoredChatMessage,
  type Unit,
} from "./lib/api";
import {
  addDays,
  formatFullDate,
  formatMonthKey,
  formatShortDate,
  formatToday,
  todayKey,
} from "./lib/date";
import { useI18n, type Language } from "./lib/i18n";
import { sendDailyReminder } from "./lib/reminder";
import { predictTomorrowWeight } from "./lib/prediction";
import {
  computeEntryStats,
  computeMilestones,
  computeTrendStats,
  formatSignedChange,
  formatWeight,
  fromDisplayWeight,
  toDisplayWeight,
  RANGE_LABELS,
  sliceByRange,
  type RangeKey,
} from "./lib/stats";
import {
  validateBodyFatInput,
  validateGoalWeightInput,
  validateNotFutureDate,
  validateWeightInput,
} from "./lib/validation";

type View = "today" | "trend" | "records" | "ai" | "settings";
type Icon = ComponentType<{ size?: number; className?: string }>;

const NAV_ITEMS: { view: View; icon: Icon }[] = [
  { view: "today", icon: LayoutDashboard },
  { view: "trend", icon: TrendingUp },
  { view: "records", icon: NotebookPen },
  { view: "ai", icon: Bot },
  { view: "settings", icon: Settings },
];

const THEME_OPTIONS: { value: ThemePreference; icon: Icon }[] = [
  { value: "system", icon: Monitor },
  { value: "light", icon: Sun },
  { value: "dark", icon: Moon },
];

function ThemeSwitch() {
  const { preference, setPreference } = useTheme();
  const { t } = useI18n();
  return (
    <div className="theme-switch" role="group" aria-label={t("theme.aria")}>
      {THEME_OPTIONS.map((option) => (
        <button
          key={option.value}
          className={preference === option.value ? "active" : ""}
          title={t("theme." + option.value)}
          aria-label={t("theme." + option.value)}
          aria-pressed={preference === option.value}
          onClick={() => setPreference(option.value)}
        >
          <option.icon size={15} />
        </button>
      ))}
    </div>
  );
}

function changeClass(value: number | null): string {
  if (value == null || value === 0) return "";
  return value < 0 ? "change-down" : "change-up";
}

const unitLabel = (unit: Unit) => UNIT_LABELS[unit];

function LogoMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 512 512" aria-hidden="true">
      <path
        d="M371.7 118.1 A180 180 0 1 0 371.7 393.9"
        fill="none"
        stroke="var(--logo-arc)"
        strokeWidth="56"
        strokeLinecap="round"
      />
      <circle cx="256" cy="256" r="42" fill="var(--harvest-gold)" />
    </svg>
  );
}

function StatCard({
  label,
  value,
  unit,
  hint,
  icon,
  accent = false,
}: {
  label: string;
  value: string;
  unit?: string;
  hint?: string;
  icon: ReactNode;
  accent?: boolean;
}) {
  return (
    <div className={`stat-card${accent ? " accent" : ""}`}>
      <div className="stat-card-top">
        <span>{label}</span>
        <span className="stat-icon">{icon}</span>
      </div>
      <div className="stat-card-value">
        <span>{value}</span>
        {unit ? <small>{unit}</small> : null}
      </div>
      {hint ? <div className="stat-card-foot">{hint}</div> : null}
    </div>
  );
}

function Sparkline({ entries }: { entries: Entry[] }) {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length === 0) return null;
  const values = sorted.map((entry) => entry.weight);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  const points = sorted.map((entry, index) => {
    const x = sorted.length === 1 ? 50 : 5 + (index * 90) / (sorted.length - 1);
    const y = range < 0.001 ? 50 : 90 - ((entry.weight - min) / range) * 78;
    return { x, y };
  });
  const line = points.map((point) => `${point.x},${point.y}`).join(" ");
  const area = `M ${points[0].x},92 L ${line} L ${points[points.length - 1].x},92 Z`;
  return (
    <svg className="sparkline" viewBox="0 0 100 100" preserveAspectRatio="none">
      <path className="spark-area" d={area} />
      <path className="spark-line" d={`M ${line}`} vectorEffect="non-scaling-stroke" />
      {points.map((point, index) => (
        <circle
          key={sorted[index].date}
          className="spark-dot"
          cx={point.x}
          cy={point.y}
          r="2.4"
        />
      ))}
    </svg>
  );
}

function GoalRing({ percent }: { percent: number }) {
  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(100, Math.max(0, percent));
  const dash = `${(clamped / 100) * circumference} ${circumference}`;
  return (
    <svg viewBox="0 0 150 150">
      <circle
        cx="75"
        cy="75"
        r={radius}
        fill="none"
        stroke="var(--ring-track)"
        strokeWidth="10"
      />
      <circle
        cx="75"
        cy="75"
        r={radius}
        fill="none"
        stroke="var(--primary)"
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={dash}
        transform="rotate(-90 75 75)"
      />
    </svg>
  );
}

function EntryForm({
  entries,
  unit,
  externalDate,
  onChanged,
}: {
  entries: Entry[];
  unit: Unit;
  externalDate?: string;
  onChanged: () => void;
}) {
  const { t, messages } = useI18n();
  const today = todayKey();
  const [date, setDate] = useState(externalDate ?? today);
  const [weight, setWeight] = useState("");
  const [bodyFat, setBodyFat] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [deleteArmed, setDeleteArmed] = useState(false);

  useEffect(() => {
    if (externalDate) setDate(externalDate);
  }, [externalDate]);

  const existing = useMemo(
    () => entries.find((entry) => entry.date === date) ?? null,
    [entries, date],
  );

  useEffect(() => {
    setWeight(
      existing
        ? toDisplayWeight(existing.weight, unit).toFixed(2)
        : "",
    );
    setBodyFat(existing?.body_fat != null ? String(existing.body_fat) : "");
    setNote(existing?.note ?? "");
    setError(null);
    setDeleteArmed(false);
  }, [existing, unit]);

  const clearStatus = () => {
    setError(null);
    setSuccess(null);
    setDeleteArmed(false);
  };

  const handleDateChange = (value: string) => {
    setDate(value);
    setDeleteArmed(false);
    setError(null);
    setSuccess(null);
  };

  const handleSave = async () => {
    const weightValue = Number(weight);
    const fatValue = bodyFat.trim() ? Number(bodyFat) : null;
    const dateError = validateNotFutureDate(date, messages.validation);
    if (dateError) {
      setError(dateError);
      return;
    }
    const weightError = validateWeightInput(weight, messages.validation);
    if (weightError) {
      setError(weightError);
      return;
    }
    const fatError = validateBodyFatInput(bodyFat, messages.validation);
    if (fatError) {
      setError(fatError);
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await upsertEntry({
        date,
        weight: Number(fromDisplayWeight(weightValue, unit).toFixed(2)),
        body_fat: fatValue != null ? Number(fatValue.toFixed(1)) : null,
        note: note.trim() || null,
      });
      setSuccess(existing ? t("entry.updated") : t("entry.saved"));
      onChanged();
    } catch (caught) {
      setError(String(caught));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteArmed) {
      setDeleteArmed(true);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await deleteEntry(date);
      setDate(today);
      setWeight("");
      setBodyFat("");
      setNote("");
      setSuccess(t("entry.deleted"));
      setDeleteArmed(false);
      onChanged();
    } catch (caught) {
      setError(String(caught));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <form
        className="entry-form"
        onSubmit={(event) => {
          event.preventDefault();
          void handleSave();
        }}
      >
        <div className="field field-date">
          <label htmlFor="entry-date">{t("entry.date")}</label>
          <input
            id="entry-date"
            type="date"
            value={date}
            max={today}
            onChange={(event) => handleDateChange(event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="entry-weight">
            {t("entry.weight", { unit: unitLabel(unit) })}
          </label>
          <input
            id="entry-weight"
            type="number"
            min="0.1"
            step="0.01"
            value={weight}
            placeholder="0.00"
            onChange={(event) => {
              setWeight(event.target.value);
              clearStatus();
            }}
          />
        </div>
        <div className="field">
          <label htmlFor="entry-fat">{t("entry.bodyFat")}</label>
          <input
            id="entry-fat"
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={bodyFat}
            placeholder={t("common.optional")}
            onChange={(event) => {
              setBodyFat(event.target.value);
              clearStatus();
            }}
          />
        </div>
        <div className="field note-field">
          <label htmlFor="entry-note">{t("entry.note")}</label>
          <textarea
            id="entry-note"
            rows={1}
            maxLength={120}
            value={note}
            placeholder={t("entry.notePlaceholder")}
            onChange={(event) => {
              setNote(event.target.value);
              clearStatus();
            }}
          />
        </div>
        <div className="form-actions">
          {existing ? (
            <button
              className={`danger-button${deleteArmed ? " armed" : ""}`}
              type="button"
              disabled={saving}
              onClick={() => void handleDelete()}
            >
              <Trash2 size={15} />
              {deleteArmed ? t("common.confirmDelete") : t("common.delete")}
            </button>
          ) : null}
          <button
            className="primary-button"
            type="submit"
            disabled={saving}
          >
            {saving
              ? t("common.saving")
              : existing
                ? t("entry.updateRecord")
                : t("entry.saveRecord")}
          </button>
        </div>
      </form>
      <div className="form-foot">
        <div>
          {error ? <p className="form-error">{error}</p> : null}
          {success && !error ? (
            <p className="form-hint form-success">{success}</p>
          ) : null}
        </div>
        <span className="form-hint">
          {existing ? t("entry.existsHint") : t("entry.newHint")}
        </span>
      </div>
    </>
  );
}

function GoalForm({
  goal,
  unit,
  onSaved,
}: {
  goal: Goal | null;
  unit: Unit;
  onSaved: () => void;
}) {
  const { t, messages } = useI18n();
  const [target, setTarget] = useState("");
  const [start, setStart] = useState("");
  const [startDate, setStartDate] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setTarget(
      goal
        ? toDisplayWeight(goal.target_weight, unit).toFixed(2)
        : "",
    );
    setStart(
      goal?.start_weight != null
        ? toDisplayWeight(goal.start_weight, unit).toFixed(2)
        : "",
    );
    setStartDate(goal?.start_date ?? "");
    setTargetDate(goal?.target_date ?? "");
    setError(null);
    setSuccess(null);
  }, [goal, unit]);

  const handleSave = async () => {
    const targetValue = Number(target);
    const startValue = start.trim() ? Number(start) : null;
    const targetError = validateGoalWeightInput(
      target,
      t("goal.targetWeight"),
      messages.validation,
    );
    if (targetError) {
      setError(targetError);
      return;
    }
    if (start.trim() !== "") {
      const startError = validateGoalWeightInput(
        start,
        t("goal.startWeight"),
        messages.validation,
      );
      if (startError) {
        setError(startError);
        return;
      }
    }
    if (startDate) {
      const dateError = validateNotFutureDate(startDate, messages.validation);
      if (dateError) {
        setError(dateError);
        return;
      }
    } else if (start.trim() !== "") {
      setError(t("goal.needStartDate"));
      return;
    }
    if (targetDate) {
      if (targetDate < todayKey()) {
        setError(t("goal.targetDateNotBeforeToday"));
        return;
      }
      if (startDate && targetDate < startDate) {
        setError(t("goal.targetDateNotBeforeStart"));
        return;
      }
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await saveGoal({
        target_weight: Number(fromDisplayWeight(targetValue, unit).toFixed(2)),
        start_weight:
          startValue != null
            ? Number(fromDisplayWeight(startValue, unit).toFixed(2))
            : null,
        start_date: startDate || null,
        target_date: targetDate || null,
      });
      setSuccess(t("goal.saved"));
      onSaved();
    } catch (caught) {
      setError(String(caught));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      className="goal-form"
      onSubmit={(event) => {
        event.preventDefault();
        void handleSave();
      }}
    >
      <div className="field">
        <label htmlFor="goal-target">
          {t("goal.targetWeight")}（{unitLabel(unit)}）
        </label>
        <input
          id="goal-target"
          type="number"
          min="0.1"
          step="0.01"
          value={target}
          placeholder="0.00"
          onChange={(event) => {
            setTarget(event.target.value);
            setError(null);
            setSuccess(null);
          }}
        />
      </div>
      <div className="field">
        <label htmlFor="goal-start">
          {t("goal.startWeight")}（{unitLabel(unit)}）
        </label>
        <input
          id="goal-start"
          type="number"
          min="0.1"
          step="0.01"
          value={start}
          placeholder={t("common.optional")}
          onChange={(event) => {
            setStart(event.target.value);
            setError(null);
            setSuccess(null);
          }}
        />
      </div>
      <div className="field">
        <label htmlFor="goal-start-date">{t("goal.startDate")}</label>
        <input
          id="goal-start-date"
          type="date"
          value={startDate}
          max={todayKey()}
          onChange={(event) => {
            setStartDate(event.target.value);
            setError(null);
            setSuccess(null);
          }}
        />
      </div>
      <div className="field">
        <label htmlFor="goal-target-date">{t("goal.targetDate")}</label>
        <input
          id="goal-target-date"
          type="date"
          value={targetDate}
          min={todayKey()}
          onChange={(event) => {
            setTargetDate(event.target.value);
            setError(null);
            setSuccess(null);
          }}
        />
      </div>
      <div className="form-actions">
        <button
          className="primary-button"
          type="submit"
          disabled={saving}
        >
          {saving
            ? t("common.saving")
            : goal
              ? t("goal.updateGoal")
              : t("goal.saveGoal")}
        </button>
      </div>
      <div className="form-foot">
        {error ? <p className="form-error">{error}</p> : null}
        {success && !error ? (
          <p className="form-success">{success}</p>
        ) : null}
      </div>
    </form>
  );
}

const ACTIVITY_OPTIONS: { value: number }[] = [
  { value: 1.2 },
  { value: 1.375 },
  { value: 1.55 },
  { value: 1.725 },
  { value: 1.9 },
];

function ProfileForm({
  profile,
  onSaved,
}: {
  profile: Profile | null;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const [height, setHeight] = useState("");
  const [age, setAge] = useState("");
  const [sex, setSex] = useState<"male" | "female" | "">("");
  const [activity, setActivity] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setHeight(profile?.height_cm != null ? String(profile.height_cm) : "");
    setAge(profile?.age != null ? String(profile.age) : "");
    setSex(profile?.sex ?? "");
    setActivity(
      profile?.activity_level != null ? String(profile.activity_level) : "",
    );
    setError(null);
    setSuccess(null);
  }, [profile]);

  const handleSave = async () => {
    const heightValue = height.trim() ? Number(height) : null;
    const ageValue = age.trim() ? Math.round(Number(age)) : null;
    const activityValue = activity.trim() ? Number(activity) : null;
    if (
      heightValue != null &&
      (!Number.isFinite(heightValue) || heightValue < 80 || heightValue > 250)
    ) {
      setError(t("profile.heightRange"));
      return;
    }
    if (ageValue != null && (ageValue < 10 || ageValue > 100)) {
      setError(t("profile.ageRange"));
      return;
    }
    if (
      activityValue != null &&
      (!Number.isFinite(activityValue) || activityValue < 1 || activityValue > 2.5)
    ) {
      setError(t("profile.activityRange"));
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await saveProfile({
        height_cm: heightValue != null ? Number(heightValue.toFixed(1)) : null,
        age: ageValue,
        sex: sex || null,
        activity_level: activityValue,
      });
      setSuccess(t("profile.saved"));
      onSaved();
    } catch (caught) {
      setError(String(caught));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      className="profile-form"
      onSubmit={(event) => {
        event.preventDefault();
        void handleSave();
      }}
    >
      <div className="field">
        <label htmlFor="profile-height">{t("profile.height")}</label>
        <input
          id="profile-height"
          type="number"
          min="80"
          max="250"
          step="0.1"
          value={height}
          placeholder="170"
          onChange={(event) => {
            setHeight(event.target.value);
            setError(null);
            setSuccess(null);
          }}
        />
      </div>
      <div className="field">
        <label htmlFor="profile-age">{t("profile.age")}</label>
        <input
          id="profile-age"
          type="number"
          min="10"
          max="100"
          step="1"
          value={age}
          placeholder="30"
          onChange={(event) => {
            setAge(event.target.value);
            setError(null);
            setSuccess(null);
          }}
        />
      </div>
      <div className="field field-wide">
        <label>{t("profile.sex")}</label>
        <div className="segmented wide">
          <button
            type="button"
            className={sex === "male" ? "active" : ""}
            onClick={() => {
              setSex("male");
              setError(null);
              setSuccess(null);
            }}
          >
            {t("profile.male")}
          </button>
          <button
            type="button"
            className={sex === "female" ? "active" : ""}
            onClick={() => {
              setSex("female");
              setError(null);
              setSuccess(null);
            }}
          >
            {t("profile.female")}
          </button>
        </div>
      </div>
      <div className="field field-wide">
        <label htmlFor="profile-activity">{t("profile.activity")}</label>
        <select
          id="profile-activity"
          value={activity}
          onChange={(event) => {
            setActivity(event.target.value);
            setError(null);
            setSuccess(null);
          }}
        >
          <option value="">{t("profile.activityPlaceholder")}</option>
          {ACTIVITY_OPTIONS.map((option) => (
            <option key={option.value} value={String(option.value)}>
              {t("activity." + String(option.value))}
            </option>
          ))}
        </select>
      </div>
      <div className="form-actions">
        <button className="primary-button" type="submit" disabled={saving}>
          {saving
            ? t("common.saving")
            : profile
              ? t("profile.updateProfile")
              : t("profile.saveProfile")}
        </button>
      </div>
      <div className="form-foot">
        {error ? <p className="form-error">{error}</p> : null}
        {success && !error ? (
          <p className="form-success">{success}</p>
        ) : null}
      </div>
    </form>
  );
}

type PickerItem = { id: number; name: string; category: string };

function CatalogPicker<T extends PickerItem>({
  open,
  title,
  query,
  onQueryChange,
  groups,
  selectedId,
  meta,
  onSelect,
  onClose,
}: {
  open: boolean;
  title: string;
  query: string;
  onQueryChange: (value: string) => void;
  groups: { category: string; items: T[] }[];
  selectedId: number | null;
  meta: (item: T) => string;
  onSelect: (id: number) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="picker-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="picker-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="picker-head">
          <div>
            <p className="panel-kicker">{t("picker.choose")}</p>
            <h2>{title}</h2>
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
        <div className="catalog-search">
          <Search size={14} />
          <input
            type="search"
            value={query}
            placeholder={t("picker.search", { title })}
            autoFocus
            onChange={(event) => onQueryChange(event.target.value)}
          />
        </div>
        <div className="picker-list">
          {groups.length ? (
            groups.map((group) => (
              <div className="picker-group" key={group.category}>
                <div className="picker-group-label">{group.category}</div>
                {group.items.map((item) => (
                  <button
                    key={item.id}
                    className={`picker-row${
                      selectedId === item.id ? " active" : ""
                    }`}
                    type="button"
                    onClick={() => onSelect(item.id)}
                  >
                    <span className="picker-row-main">
                      <strong>{item.name}</strong>
                      <span>{item.category}</span>
                    </span>
                    <em>{meta(item)}</em>
                  </button>
                ))}
              </div>
            ))
          ) : (
            <EmptyState
              icon={Search}
              title={t("picker.empty")}
              description={t("picker.emptyDesc")}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function TodayView({
  entries,
  goal,
  unit,
  profile,
  onChanged,
  onGoRecords,
}: {
  entries: Entry[];
  goal: Goal | null;
  unit: Unit;
  profile: Profile | null;
  onChanged: () => void;
  onGoRecords: () => void;
}) {
  const { language, t } = useI18n();
  const today = todayKey();
  const stats = useMemo(
    () => computeEntryStats(entries, goal),
    [entries, goal],
  );
  const weekEntries = useMemo(() => {
    const cutoff = addDays(todayKey(), -6);
    return [...entries]
      .filter((entry) => entry.date >= cutoff)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-7);
  }, [entries]);
  const targetDelta =
    stats.currentWeight != null && goal
      ? Number((stats.currentWeight - goal.target_weight).toFixed(2))
      : null;
  const todayEntry = useMemo(
    () => entries.find((entry) => entry.date === todayKey()) ?? null,
    [entries],
  );
  const [logs, setLogs] = useState<DayLogs | null>(null);

  const loadLogs = useCallback(async () => {
    try {
      setLogs(await getDayLogs(today));
    } catch {
      setLogs(null);
    }
  }, [today]);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  const prediction = useMemo(
    () =>
      predictTomorrowWeight({
        currentWeightKg: stats.currentWeight,
        profile,
        dayLogs: logs,
      }),
    [stats.currentWeight, profile, logs],
  );

  const waterMl = logs?.water_ml ?? null;

  return (
    <>
      <div className="stat-grid">
        <StatCard
          label={t("stat.currentWeight")}
          value={
            stats.currentWeight != null
              ? formatWeight(stats.currentWeight, unit)
              : "—"
          }
          unit={unitLabel(unit)}
          hint={t("stat.latestRecord")}
          icon={<Scale size={16} />}
        />
        <StatCard
          label={t("stat.last7Days")}
          value={
            stats.weekChange != null
              ? formatSignedChange(stats.weekChange, unit)
              : "—"
          }
          unit={unitLabel(unit)}
          hint={t("stat.weightChange")}
          accent
          icon={<TrendingUp size={16} />}
        />
        <StatCard
          label={t("stat.streak")}
          value={String(stats.streakDays)}
          unit={t("common.day")}
          hint={t("stat.streakHint")}
          icon={<Activity size={16} />}
        />
        <StatCard
          label={t("stat.toGoal")}
          value={targetDelta != null ? formatSignedChange(targetDelta, unit) : "—"}
          unit={unitLabel(unit)}
          hint={
            goal
              ? t("stat.goalValue", {
                  value: `${formatWeight(goal.target_weight, unit)} ${unitLabel(unit)}`,
                })
              : t("stat.noGoal")
          }
          icon={<Target size={16} />}
        />
      </div>
      <div className="dashboard-grid">
        <section className="panel entry-panel">
          <div className="panel-head">
            <div>
              <p className="panel-kicker">{t("today.kicker")}</p>
              <h2>{t("today.recordWeight")}</h2>
            </div>
            {todayEntry ? (
              <span className="status-chip recorded">
                <Check size={13} />
                {t("today.recordedToday", {
                  value: `${formatWeight(todayEntry.weight, unit)} ${unitLabel(unit)}`,
                })}
              </span>
            ) : (
              <span className="status-chip">
                <CalendarDays size={13} />
                {t("today.notRecorded")}
              </span>
            )}
          </div>
          <EntryForm entries={entries} unit={unit} onChanged={onChanged} />
        </section>
        <section className="panel goal-panel">
          <div className="panel-head">
            <div>
              <p className="panel-kicker">{t("today.goalKicker")}</p>
              <h2>{t("today.progressRing")}</h2>
            </div>
            <span className="panel-icon-tile">
              <Target size={16} />
            </span>
          </div>
          <div className="goal-body">
            <div className="goal-ring">
              <GoalRing percent={stats.progressPercent ?? 0} />
              <div className="goal-ring-label">
                <strong>{Math.round(stats.progressPercent ?? 0)}%</strong>
                <span>{goal ? t("today.done") : t("today.notSet")}</span>
              </div>
            </div>
            <div className="goal-meta">
              <div>
                <span>{t("today.goalWeight")}</span>
                <strong>
                  {goal
                    ? `${formatWeight(goal.target_weight, unit)} ${unitLabel(unit)}`
                    : "—"}
                </strong>
              </div>
              <div>
                <span>{t("today.startWeight")}</span>
                <strong>
                  {goal?.start_weight != null
                    ? `${formatWeight(goal.start_weight, unit)} ${unitLabel(unit)}`
                    : "—"}
                </strong>
              </div>
              <div>
                <span>{t("today.startDate")}</span>
                <strong>
                  {goal?.start_date
                    ? formatFullDate(goal.start_date, language)
                    : "—"}
                </strong>
              </div>
              <div>
                <span>{t("today.targetDate")}</span>
                <strong>
                  {goal?.target_date
                    ? formatFullDate(goal.target_date, language)
                    : "—"}
                </strong>
              </div>
            </div>
          </div>
        </section>
        <section className="panel energy-panel">
          <div className="entry-side-head">
            <span className="entry-side-title">
              <Flame size={14} />
              {t("today.energy")}
            </span>
            <button className="text-button" type="button" onClick={onGoRecords}>
              {t("today.goRecord")}
            </button>
          </div>
          <div className="entry-energy-grid">
            <div className="energy-cell">
              <span>{t("today.intake")}</span>
              <strong>{prediction.intakeKcal.toFixed(0)}</strong>
              <small>{t("common.kcal")}</small>
            </div>
            <div className="energy-cell">
              <span>{t("today.burn")}</span>
              <strong>{prediction.exerciseKcal.toFixed(0)}</strong>
              <small>{t("common.kcal")}</small>
            </div>
            <div className="energy-cell">
              <span>{t("today.net")}</span>
              <strong className={changeClass(prediction.energyBalance)}>
                {prediction.energyBalance > 0 ? "+" : ""}
                {prediction.energyBalance.toFixed(0)}
              </strong>
              <small>{t("common.kcal")}</small>
            </div>
            <div className="energy-cell">
              <span>{t("today.water")}</span>
              <strong>{waterMl != null ? Math.round(waterMl) : 0}</strong>
              <small>ml</small>
            </div>
          </div>
          <div className="entry-prediction">
            <span>
              {t("today.tomorrowPrediction", {
                date: formatShortDate(addDays(today, 1), language),
              })}
            </span>
            <strong>
              {prediction.tomorrowWeightKg != null
                ? `${toDisplayWeight(prediction.tomorrowWeightKg, unit).toFixed(2)} ${unitLabel(unit)}`
                : "—"}
            </strong>
            <em className={changeClass(prediction.changeKg)}>
              {prediction.changeKg != null
                ? formatSignedChange(prediction.changeKg, unit)
                : t("today.waitingWeight")}
            </em>
          </div>
        </section>
        <section className="panel week-panel">
          <div className="panel-head">
            <div>
              <p className="panel-kicker">{t("today.weekKicker")}</p>
              <h2>{t("today.weightCurve")}</h2>
            </div>
            <span className="panel-icon-tile">
              <TrendingUp size={16} />
            </span>
          </div>
          {weekEntries.length ? (
            <div className="trend-body">
              <Sparkline entries={weekEntries} />
              <div className="week-labels">
                <span>{formatShortDate(weekEntries[0].date, language)}</span>
                <span>
                  {formatShortDate(
                    weekEntries[weekEntries.length - 1].date,
                    language,
                  )}
                </span>
              </div>
            </div>
          ) : (
            <EmptyState
              icon={Activity}
              title={t("today.weekEmpty")}
              description={t("today.weekEmptyDesc")}
            />
          )}
        </section>
      </div>
    </>
  );
}

function TrendView({
  entries,
  goal,
  unit,
  onGoToday,
  onRetry,
}: {
  entries: Entry[];
  goal: Goal | null;
  unit: Unit;
  onGoToday: () => void;
  onRetry: () => void;
}) {
  const { language, t } = useI18n();
  const [range, setRange] = useState<RangeKey>("30");
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const [exportStatus, setExportStatus] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);

  const rangeEntries = useMemo(
    () => sliceByRange(entries, range),
    [entries, range],
  );
  const stats = useMemo(
    () => computeTrendStats(rangeEntries),
    [rangeEntries],
  );
  const insights = useMemo(
    () => computeMilestones(entries, goal),
    [entries, goal],
  );

  const today = todayKey();
  const recordedToday = entries.some((entry) => entry.date === today);
  const latestEntry = [...entries].sort((a, b) =>
    b.date.localeCompare(a.date),
  )[0];
  const lost =
    insights.totalChange != null ? Math.max(0, -insights.totalChange) : 0;

  const handleExport = async (format: ExportFormat) => {
    setExporting(format);
    setExportStatus(null);
    try {
      const result = await exportEntries(format);
      setExportStatus({ ok: true, text: t("trend.exportOk", { path: result }) });
    } catch (caught) {
      setExportStatus({
        ok: false,
        text: t("trend.exportFail", { error: String(caught) }),
      });
    } finally {
      setExporting(null);
    }
  };

  if (!entries.length) {
    return (
      <div className="empty-state">
        <TrendingUp size={22} />
        <strong>{t("trend.empty")}</strong>
        <span>{t("trend.emptyDesc")}</span>
        <button className="secondary-button" type="button" onClick={onRetry}>
          {t("app.retry")}
        </button>
      </div>
    );
  }

  return (
    <>
      {!recordedToday ? (
        <div className="reminder-banner">
          <Bell size={16} />
          <div>
            <strong>{t("trend.notRecordedToday")}</strong>
            <span>
              {t("trend.latestRecord", {
                date: formatShortDate(latestEntry.date, language),
              })}
            </span>
          </div>
          <button className="primary-button" onClick={onGoToday}>
            {t("trend.goRecord")}
          </button>
        </div>
      ) : null}

      <div className="stat-grid">
        <StatCard
          label={t("stat.averageWeight")}
          value={stats.average != null ? formatWeight(stats.average, unit) : "—"}
          unit={unitLabel(unit)}
          hint={t("stat.countRecords", { count: stats.count })}
          icon={<TrendingUp size={16} />}
        />
        <StatCard
          label={t("stat.rangeFluctuation")}
          value={stats.range != null ? formatWeight(stats.range, unit) : "—"}
          unit={unitLabel(unit)}
          hint={t("stat.rangeHint")}
          accent
          icon={<Activity size={16} />}
        />
        <StatCard
          label={t("stat.lowestWeight")}
          value={stats.lowest != null ? formatWeight(stats.lowest, unit) : "—"}
          unit={unitLabel(unit)}
          hint={t("stat.lowestHint")}
          icon={<Target size={16} />}
        />
        <StatCard
          label={t("stat.rangeChange")}
          value={stats.change != null ? formatSignedChange(stats.change, unit) : "—"}
          unit={unitLabel(unit)}
          hint={t("stat.changeHint")}
          icon={<Award size={16} />}
        />
      </div>

      <section className="panel chart-panel">
        <div className="panel-head">
          <div>
            <p className="panel-kicker">{t("trend.rangeCurve")}</p>
            <h2>{t("trend.weightTrend")}</h2>
          </div>
          <div className="segmented">
            {RANGE_LABELS.map((option) => (
              <button
                key={option.key}
                className={range === option.key ? "active" : ""}
                onClick={() => setRange(option.key)}
              >
                {t("range." + option.key)}
              </button>
            ))}
          </div>
        </div>
        {rangeEntries.length >= 2 ? (
          <>
            <TrendChart entries={rangeEntries} goal={goal} unit={unit} />
            <div className="chart-foot">
              <div className="chart-legend">
                <span>
                  <i className="legend-line actual" />
                  {t("trend.actual")}
                </span>
                <span>
                  <i className="legend-line smooth" />
                  {t("trend.ma7")}
                </span>
                {canDrawGoal(goal) ? (
                  <span>
                    <i className="legend-line goal" />
                    {t("trend.dailyGoal")}
                  </span>
                ) : null}
              </div>
              {stats.weekOverWeek != null ? (
                <span
                  className={`change-pill ${changeClass(stats.weekOverWeek)}`}
                >
                  {t("stat.weekPill", {
                    value: `${formatSignedChange(stats.weekOverWeek, unit)} ${unitLabel(unit)}`,
                  })}
                </span>
              ) : null}
            </div>
          </>
        ) : (
          <EmptyState
            icon={Activity}
            title={t("trend.rangeNotEnough")}
            description={t("trend.rangeNotEnoughDesc")}
          />
        )}
      </section>

      <div className="insight-grid">
        <section className="panel streak-panel">
          <div className="panel-head">
            <div>
              <p className="panel-kicker">{t("trend.habitKicker")}</p>
              <h2>{t("trend.streakTitle")}</h2>
            </div>
            <span className="panel-icon-tile">
              <Activity size={16} />
            </span>
          </div>
          <div className="streak-body">
            <div className="streak-number">
              <strong>{insights.streakDays}</strong>
              <span>{t("trend.days")}</span>
            </div>
            <div className="streak-meta">
              <div>
                <span>{t("trend.longest")}</span>
                <strong>
                  {t("trend.longestValue", { value: insights.longestStreak })}
                </strong>
              </div>
              <div>
                <span>{t("trend.totalRecords")}</span>
                <strong>
                  {t("trend.totalValue", { value: insights.daysTracked })}
                </strong>
              </div>
              <div>
                <span>{t("trend.totalChange")}</span>
                <strong>
                  {insights.totalChange != null
                    ? `${formatSignedChange(insights.totalChange, unit)} ${unitLabel(unit)}`
                    : "—"}
                </strong>
              </div>
            </div>
          </div>
        </section>
        <section className="panel milestone-panel">
          <div className="panel-head">
            <div>
              <p className="panel-kicker">{t("trend.milestoneKicker")}</p>
              <h2>{t("trend.milestoneTitle")}</h2>
            </div>
            <span className="panel-icon-tile">
              <Award size={16} />
            </span>
          </div>
          <div className="milestone-list">
            {insights.milestones.map((milestone) => {
              const progress = Math.min(
                1,
                lost / milestone.threshold,
              );
              return (
                <div
                  key={milestone.threshold}
                  className={
                    milestone.reached ? "milestone-row reached" : "milestone-row"
                  }
                >
                  <div className="milestone-head">
                    <span>
                      {t("trend.lostWeight", {
                        value: `${formatWeight(milestone.threshold, unit)} ${unitLabel(unit)}`,
                      })}
                    </span>
                    {milestone.reached ? (
                      <em>
                        <Check size={12} />
                        {milestone.date
                          ? formatShortDate(milestone.date, language)
                          : t("trend.reached")}
                      </em>
                    ) : milestone.remaining != null ? (
                      <em>
                        {t("trend.remaining", {
                          value: `${formatWeight(milestone.remaining, unit)} ${unitLabel(unit)}`,
                        })}
                      </em>
                    ) : null}
                  </div>
                  <div className="milestone-track">
                    <div
                      className="milestone-fill"
                      style={{ width: `${progress * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <section className="panel export-panel">
        <div className="panel-head">
          <div>
            <p className="panel-kicker">{t("trend.dataKicker")}</p>
            <h2>{t("trend.exportTitle")}</h2>
          </div>
          <span className="panel-icon-tile">
            <Download size={16} />
          </span>
        </div>
        <div className="export-actions">
          <button
            className="secondary-button"
            disabled={exporting !== null}
            onClick={() => void handleExport("csv")}
          >
            <FileSpreadsheet size={15} />
            CSV
          </button>
          <button
            className="secondary-button"
            disabled={exporting !== null}
            onClick={() => void handleExport("json")}
          >
            <FileJson size={15} />
            JSON
          </button>
        </div>
        {exportStatus ? (
          <p className={`export-status ${exportStatus.ok ? "" : "failed"}`}>
            {exportStatus.text}
          </p>
        ) : (
          <p className="form-hint">{t("trend.exportHint")}</p>
        )}
      </section>
    </>
  );
}

function RecordRow({
  entry,
  previousWeight,
  unit,
  onChanged,
}: {
  entry: Entry;
  previousWeight: number | null;
  unit: Unit;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [weight, setWeight] = useState("");
  const [fat, setFat] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteArmed, setDeleteArmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { language, t } = useI18n();

  const startEdit = () => {
    setWeight(toDisplayWeight(entry.weight, unit).toFixed(2));
    setFat(entry.body_fat != null ? String(entry.body_fat) : "");
    setNote(entry.note ?? "");
    setEditing(true);
    setError(null);
    setDeleteArmed(false);
  };

  const handleSave = async () => {
    const weightValue = Number(weight);
    const fatValue = fat.trim() ? Number(fat) : null;
    const weightError = validateWeightInput(weight);
    if (weightError) {
      setError(weightError);
      return;
    }
    const fatError = validateBodyFatInput(fat);
    if (fatError) {
      setError(fatError);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await upsertEntry({
        date: entry.date,
        weight: Number(fromDisplayWeight(weightValue, unit).toFixed(2)),
        body_fat: fatValue != null ? Number(fatValue.toFixed(1)) : null,
        note: note.trim() || null,
      });
      setEditing(false);
      onChanged();
    } catch (caught) {
      setError(String(caught));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteArmed) {
      setDeleteArmed(true);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await deleteEntry(entry.date);
      onChanged();
    } catch (caught) {
      setError(String(caught));
      setDeleteArmed(false);
    } finally {
      setSaving(false);
    }
  };

  const delta =
    previousWeight != null
      ? Number((entry.weight - previousWeight).toFixed(2))
      : null;

  return (
    <div className={`record-row${editing ? " editing" : ""}`}>
      <span className="record-date">{formatFullDate(entry.date, language)}</span>
      {editing ? (
        <input
          className="inline-input"
          type="number"
          min="0.1"
          step="0.01"
          value={weight}
          aria-label={t("entry.weight", { unit: unitLabel(unit) })}
          onChange={(event) => {
            setWeight(event.target.value);
            setError(null);
          }}
        />
      ) : (
        <span className="record-weight">
          {formatWeight(entry.weight, unit)}
          <small>{unitLabel(unit)}</small>
          {delta != null ? (
            <em className={`record-delta ${changeClass(delta)}`}>
              {formatSignedChange(delta, unit)}
            </em>
          ) : null}
        </span>
      )}
      {editing ? (
        <input
          className="inline-input"
          type="number"
          min="0"
          max="100"
          step="0.1"
          value={fat}
          aria-label={t("entry.bodyFat")}
          onChange={(event) => {
            setFat(event.target.value);
            setError(null);
          }}
        />
      ) : (
        <span>{entry.body_fat != null ? `${entry.body_fat.toFixed(1)}%` : "—"}</span>
      )}
      {editing ? (
        <input
          className="inline-input wide"
          type="text"
          maxLength={120}
          value={note}
          aria-label={t("entry.note")}
          onChange={(event) => {
            setNote(event.target.value);
            setError(null);
          }}
        />
      ) : (
        <span className="record-note">{entry.note ?? "—"}</span>
      )}
      <div className="record-actions">
        {editing ? (
          <>
            <button
              className="icon-button"
              title={t("common.save")}
              aria-label={t("common.save")}
              disabled={saving}
              onClick={() => void handleSave()}
            >
              <Check size={15} />
            </button>
            <button
              className="icon-button"
              title={t("common.cancel")}
              aria-label={t("common.cancel")}
              disabled={saving}
              onClick={() => {
                setEditing(false);
                setError(null);
              }}
            >
              <X size={15} />
            </button>
          </>
        ) : (
          <>
            <button
              className="icon-button"
              title={t("common.edit")}
              aria-label={t("common.edit")}
              onClick={startEdit}
            >
              <Pencil size={15} />
            </button>
            <button
              className={`icon-button danger${deleteArmed ? " armed" : ""}`}
              title={t(deleteArmed ? "common.deletePrompt" : "common.delete")}
              aria-label={t(deleteArmed ? "common.confirmDelete" : "common.delete")}
              disabled={saving}
              onClick={() => void handleDelete()}
            >
              <Trash2 size={15} />
            </button>
          </>
        )}
      </div>
      {error ? <p className="record-error">{error}</p> : null}
    </div>
  );
}

function LifeRecorder({
  entries,
  onChanged,
}: {
  entries: Entry[];
  onChanged: () => void;
}) {
  const { t } = useI18n();
  const today = todayKey();
  const [logs, setLogs] = useState<DayLogs | null>(null);
  const [foodCatalog, setFoodCatalog] = useState<FoodCatalogItem[]>([]);
  const [exerciseCatalog, setExerciseCatalog] = useState<ExerciseCatalogItem[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{
    kind: "error" | "success";
    text: string;
  } | null>(null);

  useEffect(() => {
    if (!status) return;
    const timer = window.setTimeout(() => setStatus(null), 3600);
    return () => window.clearTimeout(timer);
  }, [status]);

  const [foodId, setFoodId] = useState("");
  const [grams, setGrams] = useState("");
  const [foodQuery, setFoodQuery] = useState("");

  const [exerciseId, setExerciseId] = useState("");
  const [minutes, setMinutes] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [exerciseQuery, setExerciseQuery] = useState("");

  const [foodPickerOpen, setFoodPickerOpen] = useState(false);
  const [exercisePickerOpen, setExercisePickerOpen] = useState(false);

  const [waterInput, setWaterInput] = useState("");

  const [customFoodOpen, setCustomFoodOpen] = useState(false);
  const [customExerciseOpen, setCustomExerciseOpen] = useState(false);
  const [newFoodName, setNewFoodName] = useState("");
  const [newFoodCategory, setNewFoodCategory] = useState("");
  const [newFoodKcal, setNewFoodKcal] = useState("");
  const [newFoodUnit, setNewFoodUnit] = useState(t("life.unitGramDefault"));
  const [newFoodUnitGrams, setNewFoodUnitGrams] = useState("100");
  const [newExerciseName, setNewExerciseName] = useState("");
  const [newExerciseCategory, setNewExerciseCategory] = useState("");
  const [newExerciseMet, setNewExerciseMet] = useState("");
  const [foodEstimating, setFoodEstimating] = useState(false);
  const [exerciseEstimating, setExerciseEstimating] = useState(false);
  const [foodEstimateError, setFoodEstimateError] = useState<string | null>(null);
  const [exerciseEstimateError, setExerciseEstimateError] = useState<string | null>(null);

  const latestEntry = useMemo(() => {
    const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));
    return sorted[0] ?? null;
  }, [entries]);

  const load = useCallback(async () => {
    try {
      const [nextLogs, foods, exercises] = await Promise.all([
        getDayLogs(today),
        listFoodCatalog(),
        listExerciseCatalog(),
      ]);
      setLogs(nextLogs);
      setFoodCatalog(foods);
      setExerciseCatalog(exercises);
    } catch (caught) {
      setStatus({ kind: "error", text: String(caught) });
    } finally {
      setLoading(false);
    }
  }, [today]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (weightKg === "" && latestEntry) {
      setWeightKg(String(latestEntry.weight));
    }
  }, [latestEntry, weightKg]);

  const filteredFoods = useMemo(() => {
    const query = foodQuery.trim().toLowerCase();
    const items = query
      ? foodCatalog.filter((item) =>
          `${item.name}${item.category}`.toLowerCase().includes(query),
        )
      : foodCatalog;
    return [...items].sort(
      (a, b) =>
        a.category.localeCompare(b.category) || a.name.localeCompare(b.name),
    );
  }, [foodCatalog, foodQuery]);

  const filteredExercises = useMemo(() => {
    const query = exerciseQuery.trim().toLowerCase();
    const items = query
      ? exerciseCatalog.filter((item) =>
          `${item.name}${item.category}`.toLowerCase().includes(query),
        )
      : exerciseCatalog;
    return [...items].sort(
      (a, b) =>
        a.category.localeCompare(b.category) || a.name.localeCompare(b.name),
    );
  }, [exerciseCatalog, exerciseQuery]);

  const foodGroups = useMemo(() => {
    const groups: { category: string; items: FoodCatalogItem[] }[] = [];
    for (const item of filteredFoods) {
      const last = groups[groups.length - 1];
      if (!last || last.category !== item.category) {
        groups.push({ category: item.category, items: [item] });
      } else {
        last.items.push(item);
      }
    }
    return groups;
  }, [filteredFoods]);

  const exerciseGroups = useMemo(() => {
    const groups: { category: string; items: ExerciseCatalogItem[] }[] = [];
    for (const item of filteredExercises) {
      const last = groups[groups.length - 1];
      if (!last || last.category !== item.category) {
        groups.push({ category: item.category, items: [item] });
      } else {
        last.items.push(item);
      }
    }
    return groups;
  }, [filteredExercises]);

  const selectedFood =
    foodCatalog.find((item) => String(item.id) === foodId) ?? null;
  const selectedExercise =
    exerciseCatalog.find((item) => String(item.id) === exerciseId) ?? null;

  const handleAddFood = async () => {
    const id = Number(foodId);
    const gramValue = Number(grams);
    if (!Number.isFinite(id) || id <= 0) {
      setStatus({ kind: "error", text: t("life.foodRequired") });
      return;
    }
    if (!Number.isFinite(gramValue) || gramValue <= 0 || gramValue > 5000) {
      setStatus({ kind: "error", text: t("life.gramsRange") });
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      await logFood(today, id, gramValue);
      setGrams("");
      setStatus({ kind: "success", text: t("life.foodLogged") });
      await load();
      onChanged();
    } catch (caught) {
      setStatus({ kind: "error", text: String(caught) });
    } finally {
      setBusy(false);
    }
  };

  const handleAddExercise = async () => {
    const id = Number(exerciseId);
    const minuteValue = Number(minutes);
    const kgValue = Number(weightKg);
    if (!Number.isFinite(id) || id <= 0) {
      setStatus({ kind: "error", text: t("life.exerciseRequired") });
      return;
    }
    if (!Number.isFinite(minuteValue) || minuteValue <= 0 || minuteValue > 600) {
      setStatus({ kind: "error", text: t("life.minutesRange") });
      return;
    }
    if (!Number.isFinite(kgValue) || kgValue <= 0) {
      setStatus({ kind: "error", text: t("life.validWeight") });
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      await logExercise(today, id, minuteValue, kgValue);
      setMinutes("");
      setStatus({ kind: "success", text: t("life.exerciseLogged") });
      await load();
      onChanged();
    } catch (caught) {
      setStatus({ kind: "error", text: String(caught) });
    } finally {
      setBusy(false);
    }
  };

  const handleWater = async (amount: number) => {
    const next = Math.round(Math.max(0, (logs?.water_ml ?? 0) + amount));
    setBusy(true);
    setStatus(null);
    try {
      await upsertWater(today, next);
      setStatus({ kind: "success", text: t("life.waterUpdated", { value: next }) });
      await load();
    } catch (caught) {
      setStatus({ kind: "error", text: String(caught) });
    } finally {
      setBusy(false);
    }
  };

  const handleWaterCustom = async () => {
    const ml = Number(waterInput);
    if (!Number.isFinite(ml) || ml < 0 || ml > 10000) {
      setStatus({ kind: "error", text: t("life.waterRange") });
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      await upsertWater(today, ml);
      setWaterInput("");
      setStatus({ kind: "success", text: t("life.waterSaved") });
      await load();
    } catch (caught) {
      setStatus({ kind: "error", text: String(caught) });
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteFood = async (id: number) => {
    setBusy(true);
    setStatus(null);
    try {
      await deleteFoodLog(id);
      setStatus({ kind: "success", text: t("life.foodDeleted") });
      await load();
    } catch (caught) {
      setStatus({ kind: "error", text: String(caught) });
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteExercise = async (id: number) => {
    setBusy(true);
    setStatus(null);
    try {
      await deleteExerciseLog(id);
      setStatus({ kind: "success", text: t("life.exerciseDeleted") });
      await load();
    } catch (caught) {
      setStatus({ kind: "error", text: String(caught) });
    } finally {
      setBusy(false);
    }
  };

  const handleAddCustomFood = async () => {
    const kcal = Number(newFoodKcal);
    const unitGrams = Number(newFoodUnitGrams);
    if (!newFoodName.trim()) {
      setStatus({ kind: "error", text: t("life.foodNameRequired") });
      return;
    }
    if (!Number.isFinite(kcal) || kcal <= 0) {
      setStatus({ kind: "error", text: t("life.kcalPositive") });
      return;
    }
    if (!Number.isFinite(unitGrams) || unitGrams <= 0) {
      setStatus({ kind: "error", text: t("life.unitGramsPositive") });
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      await createFoodCatalogItem({
        name: newFoodName.trim(),
        category: newFoodCategory.trim() || t("life.other"),
        kcal_per_100g: kcal,
        protein: null,
        carbs: null,
        fat: null,
        unit_name: newFoodUnit.trim() || t("life.unitGramDefault"),
        unit_grams: unitGrams,
      });
      setNewFoodName("");
      setNewFoodCategory("");
      setNewFoodKcal("");
      setNewFoodUnit(t("life.unitGramDefault"));
      setNewFoodUnitGrams("100");
      setCustomFoodOpen(false);
      setStatus({ kind: "success", text: t("life.foodAdded") });
      await load();
    } catch (caught) {
      setStatus({ kind: "error", text: String(caught) });
    } finally {
      setBusy(false);
    }
  };

  const handleAddCustomExercise = async () => {
    const met = Number(newExerciseMet);
    if (!newExerciseName.trim()) {
      setStatus({ kind: "error", text: t("life.exerciseNameRequired") });
      return;
    }
    if (!Number.isFinite(met) || met <= 0 || met > 20) {
      setStatus({ kind: "error", text: t("life.metRange") });
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      await createExerciseCatalogItem({
        name: newExerciseName.trim(),
        category: newExerciseCategory.trim() || t("life.other"),
        met,
      });
      setNewExerciseName("");
      setNewExerciseCategory("");
      setNewExerciseMet("");
      setCustomExerciseOpen(false);
      setStatus({ kind: "success", text: t("life.exerciseAdded") });
      await load();
    } catch (caught) {
      setStatus({ kind: "error", text: String(caught) });
    } finally {
      setBusy(false);
    }
  };

  const handleAiEstimateFood = async () => {
    if (!newFoodName.trim()) {
      setFoodEstimateError(t("life.foodEstimateNameRequired"));
      return;
    }
    setFoodEstimating(true);
    setFoodEstimateError(null);
    try {
      const estimate = await aiEstimateFood(newFoodName.trim());
      setNewFoodKcal(String(Math.round(estimate.kcal_per_100g)));
      setNewFoodCategory(estimate.category || "");
      setNewFoodUnit(estimate.unit_name || t("life.unitGramDefault"));
      setNewFoodUnitGrams(
        estimate.unit_grams != null ? String(Math.round(estimate.unit_grams)) : "100",
      );
      setStatus({
        kind: "success",
        text: t("life.foodEstimated", {
          value: Math.round(estimate.kcal_per_100g),
        }),
      });
    } catch (caught) {
      setFoodEstimateError(String(caught));
    } finally {
      setFoodEstimating(false);
    }
  };

  const handleAiEstimateExercise = async () => {
    if (!newExerciseName.trim()) {
      setExerciseEstimateError(t("life.exerciseEstimateNameRequired"));
      return;
    }
    setExerciseEstimating(true);
    setExerciseEstimateError(null);
    try {
      const estimate = await aiEstimateExercise(newExerciseName.trim());
      setNewExerciseMet(String(estimate.met));
      setNewExerciseCategory(estimate.category || "");
      setStatus({
        kind: "success",
        text: t("life.exerciseEstimated", { value: estimate.met }),
      });
    } catch (caught) {
      setExerciseEstimateError(String(caught));
    } finally {
      setExerciseEstimating(false);
    }
  };

  if (loading) {
    return (
      <EmptyState
        icon={Activity}
        title={t("life.loadingTitle")}
        description={t("life.loadingDesc")}
      />
    );
  }

  const waterMl = logs?.water_ml ?? null;

  return (
    <>
      <div className="life-grid">
        <div className="life-column">
          <section className="panel">
            <div className="panel-head">
              <div>
                <p className="panel-kicker">{t("life.foodKicker")}</p>
                <h2>{t("life.foodTitle")}</h2>
              </div>
              <span className="panel-icon-tile">
                <Apple size={16} />
              </span>
            </div>
            <div className="life-form-grid">
              <div className="field">
                <label>{t("life.foodLabel")}</label>
                <button
                  className={`catalog-picker-button${selectedFood ? "" : " empty"}`}
                  type="button"
                  onClick={() => {
                    setFoodPickerOpen(true);
                    setExercisePickerOpen(false);
                  }}
                >
                  <span className="catalog-picker-value">
                    <strong>
                      {selectedFood ? selectedFood.name : t("life.chooseFood")}
                    </strong>
                    <small>
                      {selectedFood
                        ? `${selectedFood.category} · ${selectedFood.kcal_per_100g} ${t("common.kcal")}/100g`
                        : t("life.fromFoodLibrary")}
                    </small>
                  </span>
                  <ChevronDown size={16} />
                </button>
              </div>
              <div className="field">
                <label htmlFor="food-grams">{t("life.grams")}</label>
                <input
                  id="food-grams"
                  type="number"
                  min="1"
                  max="5000"
                  step="1"
                  value={grams}
                  placeholder="0"
                  onChange={(event) => setGrams(event.target.value)}
                />
              </div>
            </div>
            <div className="form-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => setCustomFoodOpen((open) => !open)}
              >
                <Plus size={14} /> {t("life.customFood")}
              </button>
              <button
                className="primary-button"
                type="button"
                disabled={busy}
                onClick={() => void handleAddFood()}
              >
                {t("life.add")}
              </button>
            </div>
            {customFoodOpen ? (
              <div className="custom-form">
                <div className="life-form-grid">
                  <div className="field field-wide">
                    <label htmlFor="custom-food-name">{t("life.name")}</label>
                    <input
                      id="custom-food-name"
                      type="text"
                      value={newFoodName}
                      placeholder={t("life.foodNamePlaceholder")}
                      onChange={(event) => setNewFoodName(event.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="custom-food-kcal">{t("life.kcalPer100g")}</label>
                    <input
                      id="custom-food-kcal"
                      type="number"
                      min="1"
                      step="1"
                      value={newFoodKcal}
                      placeholder="120"
                      onChange={(event) => setNewFoodKcal(event.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="custom-food-category">{t("life.category")}</label>
                    <input
                      id="custom-food-category"
                      type="text"
                      value={newFoodCategory}
                      placeholder={t("common.optional")}
                      onChange={(event) => setNewFoodCategory(event.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="custom-food-unit">{t("life.unitName")}</label>
                    <input
                      id="custom-food-unit"
                      type="text"
                      value={newFoodUnit}
                      onChange={(event) => setNewFoodUnit(event.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="custom-food-unit-grams">
                      {t("life.unitGrams")}
                    </label>
                    <input
                      id="custom-food-unit-grams"
                      type="number"
                      min="1"
                      step="1"
                      value={newFoodUnitGrams}
                      onChange={(event) => setNewFoodUnitGrams(event.target.value)}
                    />
                  </div>
                </div>
                <div className="form-actions">
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={busy || foodEstimating}
                    onClick={() => void handleAiEstimateFood()}
                  >
                    <Sparkles size={14} />{" "}
                    {foodEstimating ? t("life.estimating") : t("life.aiEstimateKcal")}
                  </button>
                  <button
                    className="primary-button"
                    type="button"
                    disabled={busy}
                    onClick={() => void handleAddCustomFood()}
                  >
                    {t("life.addToLibrary")}
                  </button>
                </div>
                {foodEstimateError ? (
                  <p className="life-status failed">{foodEstimateError}</p>
                ) : null}
              </div>
            ) : null}
            <div className="log-list">
              {logs?.foods.length ? (
                logs.foods.map((item) => (
                  <div className="log-row" key={item.id}>
                    <span className="log-tag">{item.category}</span>
                    <div className="log-main">
                      <strong>{item.name}</strong>
                      <span>{t("life.gramsSuffix", { value: item.grams })}</span>
                    </div>
                    <em>
                      {item.kcal.toFixed(0)} {t("common.kcal")}
                    </em>
                    <button
                      className="icon-button"
                      title={t("common.delete")}
                      aria-label={t("life.deleteFood")}
                      disabled={busy}
                      onClick={() => void handleDeleteFood(item.id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              ) : (
                <EmptyState
                  icon={Apple}
                  title={t("life.noFoodLogs")}
                  description={t("life.noFoodLogsDesc")}
                />
              )}
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <div>
                <p className="panel-kicker">{t("life.waterKicker")}</p>
                <h2>{t("life.waterTitle")}</h2>
              </div>
              <span className="panel-icon-tile">
                <GlassWater size={16} />
              </span>
            </div>
            <div className="water-summary">
              <strong>{waterMl != null ? Math.round(waterMl) : 0}</strong>
              <span>ml</span>
            </div>
            <div className="water-quick">
              {[250, 500, 750].map((amount) => (
                <button
                  key={amount}
                  className="secondary-button"
                  type="button"
                  disabled={busy}
                  onClick={() => void handleWater(amount)}
                >
                  +{amount}
                </button>
              ))}
            </div>
            <form
              className="water-input"
              onSubmit={(event) => {
                event.preventDefault();
                void handleWaterCustom();
              }}
            >
              <input
                type="number"
                min="0"
                max="10000"
                step="50"
                value={waterInput}
                placeholder={t("life.waterPlaceholder")}
                onChange={(event) => setWaterInput(event.target.value)}
              />
              <button className="primary-button" type="submit" disabled={busy}>
                {t("common.save")}
              </button>
            </form>
          </section>
        </div>

        <div className="life-column">
          <section className="panel">
            <div className="panel-head">
              <div>
                <p className="panel-kicker">{t("life.exerciseKicker")}</p>
                <h2>{t("life.exerciseTitle")}</h2>
              </div>
              <span className="panel-icon-tile">
                <Dumbbell size={16} />
              </span>
            </div>
            <div className="life-form-grid">
              <div className="field field-wide">
                <label>{t("life.exerciseLabel")}</label>
                <button
                  className={`catalog-picker-button${selectedExercise ? "" : " empty"}`}
                  type="button"
                  onClick={() => {
                    setExercisePickerOpen(true);
                    setFoodPickerOpen(false);
                  }}
                >
                  <span className="catalog-picker-value">
                    <strong>
                      {selectedExercise
                        ? selectedExercise.name
                        : t("life.chooseExercise")}
                    </strong>
                    <small>
                      {selectedExercise
                        ? `${selectedExercise.category} · MET ${selectedExercise.met}`
                        : t("life.fromExerciseLibrary")}
                    </small>
                  </span>
                  <ChevronDown size={16} />
                </button>
              </div>
              <div className="field">
                <label htmlFor="exercise-minutes">{t("life.duration")}</label>
                <input
                  id="exercise-minutes"
                  type="number"
                  min="1"
                  max="600"
                  step="1"
                  value={minutes}
                  placeholder="30"
                  onChange={(event) => setMinutes(event.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="exercise-weight">{t("life.exerciseWeight")}</label>
                <input
                  id="exercise-weight"
                  type="number"
                  min="1"
                  step="0.1"
                  value={weightKg}
                  placeholder="60"
                  onChange={(event) => setWeightKg(event.target.value)}
                />
              </div>
            </div>
            <div className="form-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => setCustomExerciseOpen((open) => !open)}
              >
                <Plus size={14} /> {t("life.customExercise")}
              </button>
              <button
                className="primary-button"
                type="button"
                disabled={busy}
                onClick={() => void handleAddExercise()}
              >
                {t("life.add")}
              </button>
            </div>
            {customExerciseOpen ? (
              <div className="custom-form">
                <div className="life-form-grid">
                  <div className="field field-wide">
                    <label htmlFor="custom-exercise-name">{t("life.name")}</label>
                    <input
                      id="custom-exercise-name"
                      type="text"
                      value={newExerciseName}
                      placeholder={t("life.exerciseNamePlaceholder")}
                      onChange={(event) => setNewExerciseName(event.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="custom-exercise-met">{t("life.met")}</label>
                    <input
                      id="custom-exercise-met"
                      type="number"
                      min="0.1"
                      max="20"
                      step="0.1"
                      value={newExerciseMet}
                      placeholder="6.0"
                      onChange={(event) => setNewExerciseMet(event.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="custom-exercise-category">
                      {t("life.category")}
                    </label>
                    <input
                      id="custom-exercise-category"
                      type="text"
                      value={newExerciseCategory}
                      placeholder={t("common.optional")}
                      onChange={(event) => setNewExerciseCategory(event.target.value)}
                    />
                  </div>
                </div>
                <div className="form-actions">
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={busy || exerciseEstimating}
                    onClick={() => void handleAiEstimateExercise()}
                  >
                    <Sparkles size={14} />{" "}
                    {exerciseEstimating
                      ? t("life.estimating")
                      : t("life.aiEstimateMet")}
                  </button>
                  <button
                    className="primary-button"
                    type="button"
                    disabled={busy}
                    onClick={() => void handleAddCustomExercise()}
                  >
                    {t("life.addToExerciseLibrary")}
                  </button>
                </div>
                {exerciseEstimateError ? (
                  <p className="life-status failed">{exerciseEstimateError}</p>
                ) : null}
              </div>
            ) : null}
            <div className="log-list">
              {logs?.exercises.length ? (
                logs.exercises.map((item) => (
                  <div className="log-row" key={item.id}>
                    <span className="log-tag">{item.category}</span>
                    <div className="log-main">
                      <strong>{item.name}</strong>
                      <span>
                        {t("life.minutesSuffix", { value: item.minutes })}
                      </span>
                    </div>
                    <em>
                      {item.kcal.toFixed(0)} {t("common.kcal")}
                    </em>
                    <button
                      className="icon-button"
                      title={t("common.delete")}
                      aria-label={t("life.deleteExercise")}
                      disabled={busy}
                      onClick={() => void handleDeleteExercise(item.id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              ) : (
                <EmptyState
                  icon={Dumbbell}
                  title={t("life.noExerciseLogs")}
                  description={t("life.noExerciseLogsDesc")}
                />
              )}
            </div>
          </section>
        </div>
      </div>

      <CatalogPicker
        open={foodPickerOpen}
        title={t("life.foodLabel")}
        query={foodQuery}
        onQueryChange={setFoodQuery}
        groups={foodGroups}
        selectedId={foodId ? Number(foodId) : null}
        meta={(item) => `${item.kcal_per_100g} ${t("common.kcal")}/100g`}
        onSelect={(id) => {
          setFoodId(String(id));
          setFoodPickerOpen(false);
        }}
        onClose={() => setFoodPickerOpen(false)}
      />
      <CatalogPicker
        open={exercisePickerOpen}
        title={t("life.exerciseLabel")}
        query={exerciseQuery}
        onQueryChange={setExerciseQuery}
        groups={exerciseGroups}
        selectedId={exerciseId ? Number(exerciseId) : null}
        meta={(item) => `MET ${item.met}`}
        onSelect={(id) => {
          setExerciseId(String(id));
          setExercisePickerOpen(false);
        }}
        onClose={() => setExercisePickerOpen(false)}
      />

      {status ? (
        <p
          className={`life-status life-toast${status.kind === "error" ? " failed" : ""}`}
          role={status.kind === "error" ? "alert" : "status"}
        >
          {status.text}
        </p>
      ) : null}
    </>
  );
}

function RecordsView({
  entries,
  unit,
  onChanged,
}: {
  entries: Entry[];
  unit: Unit;
  onChanged: () => void;
}) {
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const { language, t } = useI18n();
  const sorted = useMemo(
    () => [...entries].sort((a, b) => b.date.localeCompare(a.date)),
    [entries],
  );
  const groups = useMemo(() => {
    const result: {
      key: string;
      label: string;
      rows: { entry: Entry; previousWeight: number | null }[];
    }[] = [];
    for (let index = 0; index < sorted.length; index += 1) {
      const entry = sorted[index];
      const key = entry.date.slice(0, 7);
      const last = result[result.length - 1];
      const previousWeight = sorted[index + 1]?.weight ?? null;
      if (!last || last.key !== key) {
        result.push({
          key,
          label: formatMonthKey(key, language),
          rows: [{ entry, previousWeight }],
        });
      } else {
        last.rows.push({ entry, previousWeight });
      }
    }
    return result;
  }, [sorted, language]);
  const oldest = sorted.length ? sorted[sorted.length - 1].date : null;
  const newest = sorted.length ? sorted[0].date : null;

  return (
    <>
      <LifeRecorder entries={entries} onChanged={onChanged} />
      <section className="panel table-panel">
        <div className="panel-head">
          <div>
            <p className="panel-kicker">{t("records.weightRecords")}</p>
            <h2>{t("records.allRecords")}</h2>
          </div>
          <div className="record-head-actions">
            <span className="record-summary">
              {sorted.length && oldest && newest
                ? t("records.countRange", {
                    count: sorted.length,
                    from: formatFullDate(oldest, language),
                    to: formatFullDate(newest, language),
                  })
                : t("records.empty")}
            </span>
            <button
              className="text-button"
              type="button"
              onClick={() => setQuickAddOpen((open) => !open)}
            >
              <Plus size={13} />
              {quickAddOpen ? t("records.collapse") : t("records.quickAdd")}
            </button>
          </div>
        </div>
        {quickAddOpen ? (
          <div className="quick-add-inline">
            <EntryForm entries={entries} unit={unit} onChanged={onChanged} />
          </div>
        ) : null}
        {sorted.length ? (
          <div className="record-table">
            <div className="record-row record-head">
              <span>{t("records.dateHeader")}</span>
              <span>
                {t("records.weightHeader", { unit: unitLabel(unit) })}
              </span>
              <span>{t("records.bodyFatHeader")}</span>
              <span>{t("records.noteHeader")}</span>
              <span />
            </div>
            {groups.map((group) => (
              <div key={group.key} className="record-month">
                <div className="record-month-label">
                  <span>{group.label}</span>
                  <em>{t("records.countSuffix", { count: group.rows.length })}</em>
                </div>
                {group.rows.map(({ entry, previousWeight }) => (
                  <RecordRow
                    key={entry.id}
                    entry={entry}
                    previousWeight={previousWeight}
                    unit={unit}
                    onChanged={onChanged}
                  />
                ))}
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={NotebookPen}
            title={t("records.empty")}
            description={t("records.emptyDesc")}
          />
        )}
      </section>
    </>
  );
}

function SettingsView({
  goal,
  unit,
  profile,
  onUnitChange,
  onGoalSaved,
  onProfileSaved,
}: {
  goal: Goal | null;
  unit: Unit;
  profile: Profile | null;
  onUnitChange: (unit: Unit) => void;
  onGoalSaved: () => void;
  onProfileSaved: () => void;
}) {
  const { preference, setPreference } = useTheme();
  const { language, setLanguage, t } = useI18n();
  const LANGUAGES: { value: Language; labelKey: string }[] = [
    { value: "zh-CN", labelKey: "language.zh" },
    { value: "en-US", labelKey: "language.en" },
  ];
  const [aiDraft, setAiDraft] = useState<AiConfig>({
    provider: AI_PROVIDERS[0].id,
    base_url: AI_PROVIDERS[0].baseUrl,
    model: AI_PROVIDERS[0].defaultModel,
    api_key: "",
  });
  const [aiLoaded, setAiLoaded] = useState(false);
  const [aiSaving, setAiSaving] = useState(false);
  const [aiSaved, setAiSaved] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiTesting, setAiTesting] = useState(false);
  const [aiTestResult, setAiTestResult] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    let active = true;
    getAiConfig()
      .then((config) => {
        if (!active) return;
        if (config) {
          setAiDraft(config);
        }
      })
      .catch((caught) => {
        if (active) setAiError(String(caught));
      })
      .finally(() => {
        if (active) setAiLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleProviderChange = (provider: string) => {
    const preset = AI_PROVIDERS.find((item) => item.id === provider);
    setAiDraft((draft) => ({
      ...draft,
      provider,
      base_url: preset?.baseUrl ?? draft.base_url,
      model: preset?.defaultModel ?? draft.model,
    }));
  };

  const handleSaveAiConfig = async () => {
    if (
      !aiDraft.provider.trim() ||
      !aiDraft.base_url.trim() ||
      !aiDraft.model.trim() ||
      !aiDraft.api_key.trim()
    ) {
      setAiError(t("settings.needAllFields"));
      setAiSaved(false);
      return;
    }
    setAiSaving(true);
    setAiSaved(false);
    setAiError(null);
    try {
      await saveAiConfig(aiDraft);
      setAiSaved(true);
    } catch (caught) {
      setAiError(String(caught));
    } finally {
      setAiSaving(false);
    }
  };

  const handleTestAiConnection = async () => {
    if (
      !aiDraft.base_url.trim() ||
      !aiDraft.model.trim() ||
      !aiDraft.api_key.trim()
    ) {
      setAiTestResult({
        kind: "error",
        text: t("settings.needFieldsTest"),
      });
      return;
    }
    setAiTesting(true);
    setAiTestResult(null);
    setAiError(null);
    try {
      const message = await testAiConnection();
      setAiTestResult({ kind: "success", text: message });
    } catch (caught) {
      setAiTestResult({ kind: "error", text: String(caught) });
    } finally {
      setAiTesting(false);
    }
  };

  return (
    <div className="settings-grid">
      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="panel-kicker">{t("settings.uiKicker")}</p>
            <h2>{t("settings.appearanceTitle")}</h2>
          </div>
          <span className="panel-icon-tile">
            <Monitor size={16} />
          </span>
        </div>
        <div className="segmented wide">
          {THEME_OPTIONS.map((option) => (
            <button
              key={option.value}
              className={preference === option.value ? "active" : ""}
              onClick={() => setPreference(option.value)}
            >
              <option.icon size={15} />
              {t("theme." + option.value)}
            </button>
          ))}
        </div>
      </section>
      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="panel-kicker">{t("language.title")}</p>
            <h2>{t("language.subtitle")}</h2>
          </div>
          <span className="panel-icon-tile">
            <Languages size={16} />
          </span>
        </div>
        <div className="segmented wide">
          {LANGUAGES.map((option) => (
            <button
              key={option.value}
              className={language === option.value ? "active" : ""}
              onClick={() => setLanguage(option.value)}
            >
              {t(option.labelKey)}
            </button>
          ))}
        </div>
        <p className="form-hint">{t("language.hint")}</p>
      </section>
      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="panel-kicker">{t("settings.dataKicker")}</p>
            <h2>{t("settings.unitTitle")}</h2>
          </div>
          <span className="panel-icon-tile">
            <Scale size={16} />
          </span>
        </div>
        <div className="segmented wide">
          {UNIT_OPTIONS.map((value) => (
            <button
              key={value}
              className={unit === value ? "active" : ""}
              onClick={() => onUnitChange(value)}
            >
              {UNIT_LABELS[value]}
            </button>
          ))}
        </div>
      </section>
      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="panel-kicker">{t("settings.goalKicker")}</p>
            <h2>{t("settings.goalTitle")}</h2>
          </div>
          <span className="panel-icon-tile">
            <Target size={16} />
          </span>
        </div>
        <GoalForm goal={goal} unit={unit} onSaved={onGoalSaved} />
      </section>
      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="panel-kicker">{t("settings.bodyKicker")}</p>
            <h2>{t("settings.bodyTitle")}</h2>
          </div>
          <span className="panel-icon-tile">
            <Activity size={16} />
          </span>
        </div>
        <ProfileForm profile={profile} onSaved={onProfileSaved} />
      </section>
      <section className="panel ai-config-panel">
        <div className="panel-head">
          <div>
            <p className="panel-kicker">{t("settings.aiKicker")}</p>
            <h2>{t("settings.aiTitle")}</h2>
          </div>
          <span className="panel-icon-tile">
            <Bot size={16} />
          </span>
        </div>
        <div className="ai-config-form">
          <div className="field">
            <label htmlFor="ai-provider">{t("settings.provider")}</label>
            <select
              id="ai-provider"
              value={aiDraft.provider}
              onChange={(event) => handleProviderChange(event.target.value)}
            >
              {AI_PROVIDERS.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {t("provider." + provider.id)}
                </option>
              ))}
            </select>
          </div>
          <div className="field field-wide">
            <label htmlFor="ai-base-url">{t("settings.baseUrl")}</label>
            <input
              id="ai-base-url"
              type="url"
              value={aiDraft.base_url}
              placeholder="https://api.siliconflow.cn/v1"
              onChange={(event) =>
                setAiDraft((draft) => ({ ...draft, base_url: event.target.value }))
              }
            />
          </div>
          <div className="field">
            <label htmlFor="ai-model">{t("settings.model")}</label>
            <input
              id="ai-model"
              type="text"
              value={aiDraft.model}
              placeholder="deepseek-ai/DeepSeek-V3"
              onChange={(event) =>
                setAiDraft((draft) => ({ ...draft, model: event.target.value }))
              }
            />
          </div>
          <div className="field">
            <label htmlFor="ai-api-key">{t("settings.apiKey")}</label>
            <input
              id="ai-api-key"
              type="password"
              value={aiDraft.api_key}
              placeholder="sk-…"
              autoComplete="off"
              onChange={(event) =>
                setAiDraft((draft) => ({ ...draft, api_key: event.target.value }))
              }
            />
          </div>
        </div>
        <div className="form-actions">
          <button
            className="primary-button"
            type="button"
            disabled={aiSaving || !aiLoaded}
            onClick={() => void handleSaveAiConfig()}
          >
            {aiSaving ? t("common.saving") : t("settings.saveConfig")}
          </button>
          <button
            className="secondary-button"
            type="button"
            disabled={aiTesting || !aiLoaded}
            onClick={() => void handleTestAiConnection()}
          >
            <Sparkles size={14} />{" "}
            {aiTesting ? t("settings.testing") : t("settings.testConnection")}
          </button>
        </div>
        {aiError ? <p className="life-status failed">{aiError}</p> : null}
        {aiSaved ? <p className="life-status">{t("settings.saved")}</p> : null}
        {aiTestResult ? (
          <p
            className={`life-status${
              aiTestResult.kind === "error" ? " failed" : ""
            }`}
          >
            {aiTestResult.text}
          </p>
        ) : null}
      </section>
      <section className="panel about-panel">
        <div className="panel-head">
          <div>
            <p className="panel-kicker">{t("settings.aboutKicker")}</p>
            <h2>Ceres v0.1.0</h2>
          </div>
          <LogoMark className="about-logo" />
        </div>
        <div className="about-list">
          <div>
            <span>{t("settings.storageLabel")}</span>
            <strong>{t("settings.storageValue")}</strong>
          </div>
          <div>
            <span>{t("settings.versionLabel")}</span>
            <strong>v0.1.0</strong>
          </div>
          <div>
            <span>{t("settings.positionLabel")}</span>
            <strong>{t("settings.positionValue")}</strong>
          </div>
        </div>
      </section>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: Icon;
  title: string;
  description: string;
}) {
  return (
    <div className="empty-state">
      <Icon size={22} />
      <strong>{title}</strong>
      <span>{description}</span>
    </div>
  );
}

interface AiUiMessage {
  role: "user" | "assistant";
  content: string;
  actions?: AiAction[];
  appliedSummary?: string | null;
}

function cleanStreamingAssistantText(text: string): string {
  const trimmed = text.trimEnd();
  const lastBrace = trimmed.lastIndexOf("}");
  if (lastBrace >= 0) {
    let depth = 0;
    let jsonStart = -1;
    for (let i = lastBrace; i >= 0; i -= 1) {
      const char = trimmed[i];
      if (char === "}") depth += 1;
      else if (char === "{") {
        depth -= 1;
        if (depth === 0) {
          jsonStart = i;
          break;
        }
      }
    }
    if (
      jsonStart >= 0 &&
      /^\{\s*"(reply|actions)"/.test(trimmed.slice(jsonStart))
    ) {
      const prefix = trimmed.slice(0, jsonStart).trimEnd();
      const candidate = trimmed.slice(jsonStart, lastBrace + 1);
      try {
        const value = JSON.parse(candidate) as Record<string, unknown>;
        const reply = typeof value.reply === "string" ? value.reply : null;
        if (reply != null) return prefix || reply;
        return prefix || trimmed;
      } catch {
        return prefix || trimmed;
      }
    }
  }
  const jsonStart = trimmed.search(/\{\s*"(reply|actions)"/);
  if (jsonStart >= 0 && !trimmed.slice(jsonStart).trimEnd().endsWith("}")) {
    return trimmed.slice(0, jsonStart).trimEnd();
  }
  return trimmed;
}

function makeSessionTitle(messages: AiUiMessage[], fallback: string): string {
  const firstUser = messages.find((message) => message.role === "user");
  if (!firstUser) return fallback;
  const text = firstUser.content.replace(/\s+/g, " ").trim();
  if (!text) return fallback;
  const ascii = [...text].every((char) => char.charCodeAt(0) < 128);
  const max = ascii ? 42 : 22;
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

function AiView({
  unit,
  onChanged,
  onGoSettings,
}: {
  unit: Unit;
  onChanged: () => void;
  onGoSettings: () => void;
}) {
  const today = todayKey();
  const { language, t } = useI18n();
  const [config, setConfig] = useState<AiConfig | null>(null);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [messages, setMessages] = useState<AiUiMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [pendingActions, setPendingActions] = useState<AiAction[] | null>(null);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<AiSessionMeta[]>([]);
  const [sessionsLoaded, setSessionsLoaded] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const messagesStateRef = useRef<AiUiMessage[]>([]);

  useEffect(() => {
    let active = true;
    getAiConfig()
      .then((value) => {
        if (active) setConfig(value);
      })
      .catch((caught) => {
        if (active) setError(String(caught));
      })
      .finally(() => {
        if (active) setConfigLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [today]);

  useEffect(() => {
    let active = true;
    listAiSessions()
      .then((items) => {
        if (active) setSessions(items);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setSessionsLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const node = messagesRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages, pendingActions]);

  const providerName = config ? t("provider." + config.provider) : "";

  const startNewChat = () => {
    if (sending || applying) return;
    setActiveSessionId(null);
    setPendingActions(null);
    setError(null);
    messagesStateRef.current = [];
    messagesRef.current = null;
    setMessages([]);
  };

  const loadSession = async (id: number) => {
    if (sending || applying || id === activeSessionId) return;
    setError(null);
    try {
      const session = await getAiSession(id);
      if (!session) return;
      const restored: AiUiMessage[] = session.messages.map((message) => ({
        role: message.role === "user" ? "user" : "assistant",
        content: message.content,
        actions: message.actions,
        appliedSummary: message.appliedSummary,
      }));
      messagesStateRef.current = restored;
      setMessages(restored);
      setActiveSessionId(id);
      setPendingActions(null);
    } catch (caught) {
      setError(String(caught));
    }
  };

  const handleDeleteSession = async (id: number) => {
    if (sending || applying) return;
    try {
      await deleteAiSession(id);
      setSessions((prev) => prev.filter((session) => session.id !== id));
      if (activeSessionId === id) startNewChat();
    } catch (caught) {
      setError(String(caught));
    }
  };

  const persistSession = async (list: AiUiMessage[]) => {
    if (!list.length) return;
    const stored: StoredChatMessage[] = list.map((message) => ({
      role: message.role,
      content: message.content,
      actions: message.actions ?? [],
      appliedSummary: message.appliedSummary ?? null,
    }));
    const saved = await saveAiSession({
      id: activeSessionId ?? undefined,
      title: makeSessionTitle(list, t("ai.newChat")),
      messages: stored,
    });
    setActiveSessionId(saved.id);
    setSessions((prev) => {
      const meta: AiSessionMeta = {
        id: saved.id,
        title: saved.title,
        created_at: saved.created_at,
        updated_at: saved.updated_at,
      };
      const rest = prev.filter((session) => session.id !== saved.id);
      return [meta, ...rest];
    });
  };

  const handleSend = async (raw: string) => {
    const prompt = raw.trim();
    if (!prompt || sending) return;
    if (!config?.api_key || !config.base_url.trim() || !config.model.trim()) {
      setError(t("ai.configError"));
      return;
    }
    setError(null);
    setSending(true);
    setDraft("");
    setPendingActions(null);
    const working = [
      ...messagesStateRef.current,
      { role: "user" as const, content: prompt },
      { role: "assistant" as const, content: "" },
    ];
    messagesStateRef.current = working;
    setMessages(working);
    try {
      const history: ChatMessage[] = working
        .slice(0, -2)
        .filter((item) => item.content.trim())
        .map((item) => ({ role: item.role, content: item.content }));
      const response = await aiChatStream(
        prompt,
        history,
        (delta) => {
          const next = [...working];
          const last = next[next.length - 1];
          if (last && last.role === "assistant") {
            next[next.length - 1] = {
              ...last,
              content: last.content + delta,
            };
            working.length = 0;
            working.push(...next);
          }
          messagesStateRef.current = next;
          setMessages(next);
        },
        (actions) => setPendingActions(actions.length ? actions : null),
      );
      const final = [...working];
      const last = final[final.length - 1];
      if (last && last.role === "assistant") {
        final[final.length - 1] = {
          ...last,
          content: response.text || last.content,
          actions: response.actions,
        };
      }
      messagesStateRef.current = final;
      setMessages(final);
      try {
        await persistSession(final);
      } catch (saveError) {
        setError(String(saveError));
      }
    } catch (caught) {
      const final = [...working];
      const last = final[final.length - 1];
      if (last && last.role === "assistant" && !last.content.trim()) {
        final.pop();
      }
      messagesStateRef.current = final;
      setMessages(final);
      setError(String(caught));
      try {
        await persistSession(final);
      } catch {
        // keep the original stream error visible
      }
    } finally {
      setSending(false);
    }
  };

  const handleApply = async () => {
    if (!pendingActions || applying) return;
    setApplying(true);
    setError(null);
    try {
      const result = await aiApplyActions(pendingActions);
      const created = [
        result.createdFoods.length
          ? t("ai.createdFoods", { names: result.createdFoods.join(", ") })
          : "",
        result.createdExercises.length
          ? t("ai.createdExercises", { names: result.createdExercises.join(", ") })
          : "",
      ]
        .filter(Boolean)
        .join("; ");
      const summary = created
        ? `${result.message}；${created}`
        : result.message;
      const final = [...messagesStateRef.current];
      const last = final[final.length - 1];
      if (last && last.role === "assistant") {
        final[final.length - 1] = { ...last, appliedSummary: summary };
      }
      messagesStateRef.current = final;
      setMessages(final);
      setPendingActions(null);
      onChanged();
      try {
        await persistSession(final);
      } catch (saveError) {
        setError(String(saveError));
      }
    } catch (caught) {
      setError(String(caught));
    } finally {
      setApplying(false);
    }
  };

  const describeAction = (action: AiAction): string => {
    if (action.type === "weight") {
      const parts = [
        t("ai.actionWeight", {
          date: action.date,
          weight: formatWeight(action.weightKg, unit),
          unit: unitLabel(unit),
        }),
      ];
      if (action.bodyFat != null)
        parts.push(t("ai.actionBodyFat", { value: action.bodyFat }));
      if (action.note) parts.push(action.note);
      return parts.join(" · ");
    }
    if (action.type === "food") {
      const kcal = Math.round((action.grams * action.kcalPer100g) / 100);
      return t("ai.actionFood", {
        date: action.date,
        name: action.name,
        grams: action.grams,
        kcal,
      });
    }
    if (action.type === "exercise") {
      return t("ai.actionExercise", {
        date: action.date,
        name: action.name,
        minutes: action.minutes,
        met: action.met,
      });
    }
    return t("ai.actionWater", { date: action.date, ml: action.ml });
  };

  const suggestions = [
    t("ai.suggestionAnalyze"),
    t("ai.suggestionEntry"),
    t("ai.suggestionGoal"),
  ];

  if (!configLoaded) {
    return (
      <EmptyState
        icon={Bot}
        title={t("ai.loadingTitle")}
        description={t("ai.loadingDesc")}
      />
    );
  }

  if (!config) {
    return (
      <div className="ai-guide panel">
        <span className="panel-icon-tile">
          <Bot size={18} />
        </span>
        <h2>{t("ai.noConfigTitle")}</h2>
        <p>{t("ai.noConfigDesc")}</p>
        <button className="primary-button" type="button" onClick={onGoSettings}>
          {t("ai.goSettings")}
        </button>
      </div>
    );
  }

  return (
    <div className="ai-grid">
      <aside className="panel ai-history-panel">
        <div className="ai-history-head">
          <div>
            <p className="panel-kicker">{t("ai.historyKicker")}</p>
            <h2>{t("ai.historyTitle")}</h2>
          </div>
        </div>
        <button
          className="ai-new-chat"
          type="button"
          disabled={sending || applying}
          onClick={startNewChat}
        >
          <Plus size={14} /> {t("ai.newChat")}
        </button>
        <div className="ai-history-list">
          {!sessionsLoaded ? (
            <p className="ai-history-empty">{t("ai.historyLoading")}</p>
          ) : sessions.length === 0 ? (
            <p className="ai-history-empty">{t("ai.noHistory")}</p>
          ) : (
            sessions.map((session) => (
              <div
                key={session.id}
                className={`ai-history-item${
                  session.id === activeSessionId ? " active" : ""
                }`}
                role="button"
                tabIndex={0}
                onClick={() => void loadSession(session.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    void loadSession(session.id);
                  }
                }}
              >
                <span className="ai-history-title">
                  {session.title || t("ai.newChat")}
                </span>
                <span className="ai-history-meta">
                  {formatFullDate(session.updated_at.slice(0, 10), language)}
                </span>
                <button
                  className="ai-history-delete"
                  type="button"
                  title={t("ai.deleteSession")}
                  aria-label={t("ai.deleteSession")}
                  disabled={sending || applying}
                  onClick={(event) => {
                    event.stopPropagation();
                    void handleDeleteSession(session.id);
                  }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))
          )}
        </div>
      </aside>
      <section className="panel ai-chat-panel">
        <div className="ai-chat-head">
          <span className="ai-chip">
            <span className="ai-chip-dot" />
            {providerName} · {config.model}
          </span>
        </div>
        <div className="ai-messages" ref={messagesRef}>
          {messages.length === 0 ? (
            <div className="ai-welcome">
              <Bot size={22} />
              <strong>{t("ai.welcome")}</strong>
              <span>{t("ai.welcomeDesc")}</span>
            </div>
          ) : (
            messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`ai-message${message.role === "user" ? " user" : ""}`}
              >
                {message.role === "assistant" ? (
                  <span className="ai-avatar">
                    <Bot size={15} />
                  </span>
                ) : null}
                <div className="ai-body">
                  {message.role === "assistant" ? (
                    <div className="ai-markdown-wrap">
                      <div className="ai-content ai-markdown">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {cleanStreamingAssistantText(message.content)}
                        </ReactMarkdown>
                      </div>
                      {sending && index === messages.length - 1 ? (
                        <span className="ai-caret" />
                      ) : null}
                    </div>
                  ) : (
                    <p className="ai-content">{message.content}</p>
                  )}
                  {message.actions?.length ? (
                    <div className="ai-inline-actions">
                      {message.actions.map((action, actionIndex) => (
                        <span key={`${action.type}-${actionIndex}`}>
                          {describeAction(action)}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {message.appliedSummary ? (
                    <em className="ai-applied">{message.appliedSummary}</em>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>
        {pendingActions ? (
          <div className="ai-pending">
            <div className="ai-pending-head">
              <Wand2 size={15} />
              <strong>
                {t("ai.pendingHead", { count: pendingActions.length })}
              </strong>
            </div>
            <div className="ai-pending-list">
              {pendingActions.map((action, index) => (
                <span key={`${action.type}-${index}`}>
                  {describeAction(action)}
                </span>
              ))}
            </div>
            <div className="ai-pending-actions">
              <button
                className="primary-button"
                type="button"
                disabled={applying}
                onClick={() => void handleApply()}
              >
                <Check size={14} /> {applying ? t("ai.applying") : t("ai.apply")}
              </button>
              <button
                className="secondary-button"
                type="button"
                disabled={applying}
                onClick={() => setPendingActions(null)}
              >
                <X size={14} /> {t("ai.ignore")}
              </button>
            </div>
          </div>
        ) : null}
        <form
          className="ai-composer"
          onSubmit={(event) => {
            event.preventDefault();
            void handleSend(draft);
          }}
        >
          <textarea
            rows={3}
            value={draft}
            placeholder={t("ai.placeholder")}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void handleSend(draft);
              }
            }}
          />
          <button
            className="primary-button"
            type="submit"
            disabled={sending || !draft.trim()}
          >
            <Send size={14} /> {sending ? t("ai.generating") : t("ai.send")}
          </button>
        </form>
        {error ? <p className="ai-error">{error}</p> : null}
        {messages.length === 0 ? (
          <div className="ai-suggestions">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                className="secondary-button"
                type="button"
                onClick={() => void handleSend(suggestion)}
              >
                {suggestion}
              </button>
            ))}
          </div>
        ) : null}
      </section>

    </div>
  );
}

function App() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [unit, setUnit] = useState<Unit>(() => readUnit());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<View>("today");
  const contentRef = useRef<HTMLElement>(null);
  const { language, t } = useI18n();

  const loadData = useCallback(async () => {
    try {
      const [nextEntries, nextGoal, nextProfile] = await Promise.all([
        listEntries(),
        getGoal(),
        getProfile(),
      ]);
      setEntries(nextEntries);
      setGoal(nextGoal);
      setProfile(nextProfile);
      if (!nextEntries.some((entry) => entry.date === todayKey())) {
        void sendDailyReminder(language);
      }
    } catch (caught) {
      setError(String(caught));
    } finally {
      setLoading(false);
    }
  }, [language]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const node = contentRef.current;
    if (!node) return;
    const update = () => node.classList.toggle("scrolled", node.scrollTop > 6);
    update();
    node.addEventListener("scroll", update, { passive: true });
    return () => node.removeEventListener("scroll", update);
  }, []);

  const handleUnitChange = (next: Unit) => {
    saveUnit(next);
    setUnit(next);
  };

  const meta = {
    title: t(`view.${activeView}.title`),
    eyebrow: t(`view.${activeView}.eyebrow`),
    dateLine:
      activeView === "today" ? formatToday(new Date(), language) : undefined,
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <LogoMark className="logo-mark" />
          <div>
            <strong>Ceres</strong>
            <span>{t("app.tagline")}</span>
          </div>
        </div>
        <nav className="nav-list">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.view}
              className={activeView === item.view ? "active" : ""}
              onClick={() => setActiveView(item.view)}
            >
              <item.icon size={16} />
              <span>{t("nav." + item.view)}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <ThemeSwitch />
          <div className="sidebar-foot">
            <LogoMark className="logo-mark" />
            <span>{t("app.foot")}</span>
          </div>
        </div>
      </aside>
      <main
        className={`content${
          activeView === "today"
            ? " content-today"
            : activeView === "ai"
              ? " content-ai"
              : ""
        }`}
        ref={contentRef}
      >
        <div className="page">
          <div className="page-head">
            <div>
              <p className="eyebrow">{meta.eyebrow}</p>
              <h1>{meta.title}</h1>
              {meta.dateLine ? (
                <p className="page-date">{meta.dateLine}</p>
              ) : null}
            </div>
          </div>
          {loading ? (
            <EmptyState
              icon={Activity}
              title={t("app.loading")}
              description={t("app.loadingDesc")}
            />
          ) : error ? (
            <div className="empty-state error-state">
              <NotebookPen size={22} />
              <strong>{t("app.loadFailed")}</strong>
              <span>{error}</span>
              <button
                className="secondary-button"
                type="button"
                onClick={() => {
                  setError(null);
                  setLoading(true);
                  void loadData();
                }}
              >
                {t("app.retry")}
              </button>
            </div>
          ) : (
            <>
              {activeView === "today" ? (
                <TodayView
                  entries={entries}
                  goal={goal}
                  unit={unit}
                  profile={profile}
                  onChanged={() => void loadData()}
                  onGoRecords={() => setActiveView("records")}
                />
              ) : null}
              {activeView === "trend" ? (
                <TrendView
                  entries={entries}
                  goal={goal}
                  unit={unit}
                  onGoToday={() => setActiveView("today")}
                  onRetry={() => void loadData()}
                />
              ) : null}
              {activeView === "records" ? (
                <RecordsView
                  entries={entries}
                  unit={unit}
                  onChanged={() => void loadData()}
                />
              ) : null}
              {activeView === "ai" ? (
                <AiView
                  unit={unit}
                  onChanged={() => void loadData()}
                  onGoSettings={() => setActiveView("settings")}
                />
              ) : null}
              {activeView === "settings" ? (
                <SettingsView
                  goal={goal}
                  unit={unit}
                  profile={profile}
                  onUnitChange={handleUnitChange}
                  onGoalSaved={() => void loadData()}
                  onProfileSaved={() => void loadData()}
                />
              ) : null}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
