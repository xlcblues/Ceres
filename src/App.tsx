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
  Award,
  Bell,
  CalendarDays,
  Check,
  Download,
  FileJson,
  FileSpreadsheet,
  LayoutDashboard,
  Monitor,
  Moon,
  NotebookPen,
  Pencil,
  Plus,
  Scale,
  Settings,
  Sun,
  Target,
  Trash2,
  TrendingUp,
  X,
} from "lucide-react";
import "./App.css";
import { TrendChart } from "./components/TrendChart";
import { useTheme, type ThemePreference } from "./theme";
import {
  deleteEntry,
  exportEntries,
  getGoal,
  listEntries,
  readUnit,
  saveGoal,
  saveUnit,
  upsertEntry,
  type Entry,
  type ExportFormat,
  type Goal,
  type Unit,
} from "./lib/api";
import {
  addDays,
  formatChineseDate,
  formatFullDate,
  formatToday,
  todayKey,
} from "./lib/date";
import { sendDailyReminder } from "./lib/reminder";
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

type View = "today" | "trend" | "records" | "settings";
type Icon = ComponentType<{ size?: number; className?: string }>;

const NAV_ITEMS: { view: View; label: string; icon: Icon }[] = [
  { view: "today", label: "今日", icon: LayoutDashboard },
  { view: "trend", label: "趋势", icon: TrendingUp },
  { view: "records", label: "记录", icon: NotebookPen },
  { view: "settings", label: "设置", icon: Settings },
];

const THEME_OPTIONS: { value: ThemePreference; label: string; icon: Icon }[] = [
  { value: "system", label: "系统", icon: Monitor },
  { value: "light", label: "浅色", icon: Sun },
  { value: "dark", label: "深色", icon: Moon },
];

const VIEW_META: Record<View, { title: string; eyebrow: string; dateLine?: string }> = {
  today: {
    title: "今天，轻一点。",
    eyebrow: "Ceres · 今日",
    dateLine: formatToday(new Date()),
  },
  trend: {
    title: "看见节奏，而不只是数字。",
    eyebrow: "Ceres · 趋势",
  },
  records: {
    title: "每一次记录，都是一颗谷粒。",
    eyebrow: "Ceres · 记录",
  },
  settings: {
    title: "让默认，成为你的习惯。",
    eyebrow: "Ceres · 设置",
  },
};

function ThemeSwitch() {
  const { preference, setPreference } = useTheme();
  return (
    <div className="theme-switch" role="group" aria-label="主题">
      {THEME_OPTIONS.map((option) => (
        <button
          key={option.value}
          className={preference === option.value ? "active" : ""}
          title={option.label}
          aria-label={option.label}
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
        ? String(Number(toDisplayWeight(existing.weight, unit).toFixed(1)))
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
    const dateError = validateNotFutureDate(date);
    if (dateError) {
      setError(dateError);
      return;
    }
    const weightError = validateWeightInput(weight);
    if (weightError) {
      setError(weightError);
      return;
    }
    const fatError = validateBodyFatInput(bodyFat);
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
        weight: Number(fromDisplayWeight(weightValue, unit).toFixed(1)),
        body_fat: fatValue != null ? Number(fatValue.toFixed(1)) : null,
        note: note.trim() || null,
      });
      setSuccess(existing ? "已更新" : "已保存");
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
      setSuccess("已删除");
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
        <div className="field">
          <label htmlFor="entry-date">日期</label>
          <input
            id="entry-date"
            type="date"
            value={date}
            max={today}
            onChange={(event) => handleDateChange(event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="entry-weight">体重（{unit}）</label>
          <input
            id="entry-weight"
            type="number"
            min="0.1"
            step="0.1"
            value={weight}
            placeholder="0.0"
            onChange={(event) => {
              setWeight(event.target.value);
              clearStatus();
            }}
          />
        </div>
        <div className="field">
          <label htmlFor="entry-fat">体脂率（%）</label>
          <input
            id="entry-fat"
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={bodyFat}
            placeholder="可选"
            onChange={(event) => {
              setBodyFat(event.target.value);
              clearStatus();
            }}
          />
        </div>
        <div className="field">
          <label htmlFor="entry-note">备注</label>
          <textarea
            id="entry-note"
            rows={1}
            maxLength={120}
            value={note}
            placeholder="晨起空腹 / 晚餐后…"
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
              {deleteArmed ? "确认删除" : "删除"}
            </button>
          ) : null}
          <button
            className="primary-button"
            type="submit"
            disabled={saving}
          >
            {saving ? "保存中…" : existing ? "更新记录" : "保存记录"}
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
          {existing ? "已有记录，保存将更新该日" : "该日期尚无记录，保存将新增一条"}
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
  const [target, setTarget] = useState("");
  const [start, setStart] = useState("");
  const [startDate, setStartDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setTarget(
      goal
        ? String(Number(toDisplayWeight(goal.target_weight, unit).toFixed(1)))
        : "",
    );
    setStart(
      goal?.start_weight != null
        ? String(Number(toDisplayWeight(goal.start_weight, unit).toFixed(1)))
        : "",
    );
    setStartDate(goal?.start_date ?? "");
    setError(null);
    setSuccess(null);
  }, [goal, unit]);

  const handleSave = async () => {
    const targetValue = Number(target);
    const startValue = start.trim() ? Number(start) : null;
    const targetError = validateGoalWeightInput(target, "目标体重");
    if (targetError) {
      setError(targetError);
      return;
    }
    if (start.trim() !== "") {
      const startError = validateGoalWeightInput(start, "起始体重");
      if (startError) {
        setError(startError);
        return;
      }
    }
    if (startDate) {
      const dateError = validateNotFutureDate(startDate);
      if (dateError) {
        setError(dateError);
        return;
      }
    } else if (start.trim() !== "") {
      setError("请选择起始日期");
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await saveGoal({
        target_weight: Number(fromDisplayWeight(targetValue, unit).toFixed(1)),
        start_weight:
          startValue != null
            ? Number(fromDisplayWeight(startValue, unit).toFixed(1))
            : null,
        start_date: startDate || null,
      });
      setSuccess("目标已保存");
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
        <label htmlFor="goal-target">目标体重（{unit}）</label>
        <input
          id="goal-target"
          type="number"
          min="0.1"
          step="0.1"
          value={target}
          placeholder="0.0"
          onChange={(event) => {
            setTarget(event.target.value);
            setError(null);
            setSuccess(null);
          }}
        />
      </div>
      <div className="field">
        <label htmlFor="goal-start">起始体重（{unit}）</label>
        <input
          id="goal-start"
          type="number"
          min="0.1"
          step="0.1"
          value={start}
          placeholder="可选"
          onChange={(event) => {
            setStart(event.target.value);
            setError(null);
            setSuccess(null);
          }}
        />
      </div>
      <div className="field">
        <label htmlFor="goal-start-date">起始日期</label>
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
      <div className="form-actions">
        <button
          className="primary-button"
          type="submit"
          disabled={saving}
        >
          {saving ? "保存中…" : goal ? "更新目标" : "保存目标"}
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

function TodayView({
  entries,
  goal,
  unit,
  onChanged,
}: {
  entries: Entry[];
  goal: Goal | null;
  unit: Unit;
  onChanged: () => void;
}) {
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
      ? Number((stats.currentWeight - goal.target_weight).toFixed(1))
      : null;
  const todayEntry = useMemo(
    () => entries.find((entry) => entry.date === todayKey()) ?? null,
    [entries],
  );

  return (
    <>
      <div className="stat-grid">
        <StatCard
          label="当前体重"
          value={
            stats.currentWeight != null
              ? formatWeight(stats.currentWeight, unit)
              : "—"
          }
          unit={unit}
          hint="最新记录"
          icon={<Scale size={16} />}
        />
        <StatCard
          label="近 7 日"
          value={
            stats.weekChange != null
              ? formatSignedChange(stats.weekChange, unit)
              : "—"
          }
          unit={unit}
          hint="体重变化"
          accent
          icon={<TrendingUp size={16} />}
        />
        <StatCard
          label="连续记录"
          value={String(stats.streakDays)}
          unit="天"
          hint="含今日或昨日"
          icon={<Activity size={16} />}
        />
        <StatCard
          label="距目标"
          value={targetDelta != null ? formatSignedChange(targetDelta, unit) : "—"}
          unit={unit}
          hint={
            goal
              ? `目标 ${formatWeight(goal.target_weight, unit)} ${unit}`
              : "尚未设置目标"
          }
          icon={<Target size={16} />}
        />
      </div>
      <div className="dashboard-grid">
        <section className="panel entry-panel">
          <div className="panel-head">
            <div>
              <p className="panel-kicker">今日</p>
              <h2>记录体重</h2>
            </div>
            {todayEntry ? (
              <span className="status-chip recorded">
                <Check size={13} />
                今日 {formatWeight(todayEntry.weight, unit)} {unit}
              </span>
            ) : (
              <span className="status-chip">
                <CalendarDays size={13} />
                今日未记录
              </span>
            )}
          </div>
          <EntryForm entries={entries} unit={unit} onChanged={onChanged} />
        </section>
        <div className="dashboard-stack">
          <section className="panel goal-panel">
            <div className="panel-head">
              <div>
                <p className="panel-kicker">目标</p>
                <h2>进度环</h2>
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
                  <span>{goal ? "已完成" : "未设置"}</span>
                </div>
              </div>
              <div className="goal-meta">
                <div>
                  <span>目标体重</span>
                  <strong>
                    {goal
                      ? `${formatWeight(goal.target_weight, unit)} ${unit}`
                      : "—"}
                  </strong>
                </div>
                <div>
                  <span>起始体重</span>
                  <strong>
                    {goal?.start_weight != null
                      ? `${formatWeight(goal.start_weight, unit)} ${unit}`
                      : "—"}
                  </strong>
                </div>
                <div>
                  <span>起始日期</span>
                  <strong>
                    {goal?.start_date ? formatFullDate(goal.start_date) : "—"}
                  </strong>
                </div>
              </div>
            </div>
          </section>
          <section className="panel week-panel">
            <div className="panel-head">
              <div>
                <p className="panel-kicker">近 7 日</p>
                <h2>体重曲线</h2>
              </div>
              <span className="panel-icon-tile">
                <TrendingUp size={16} />
              </span>
            </div>
            {weekEntries.length ? (
              <div className="trend-body">
                <Sparkline entries={weekEntries} />
                <div className="week-labels">
                  <span>{formatChineseDate(weekEntries[0].date)}</span>
                  <span>
                    {formatChineseDate(weekEntries[weekEntries.length - 1].date)}
                  </span>
                </div>
              </div>
            ) : (
              <EmptyState
                icon={Activity}
                title="暂无近 7 日记录"
                description="录入第一条记录后，曲线会出现在这里"
              />
            )}
          </section>
        </div>
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
      setExportStatus({ ok: true, text: `已导出：${result}` });
    } catch (caught) {
      setExportStatus({ ok: false, text: `导出失败：${String(caught)}` });
    } finally {
      setExporting(null);
    }
  };

  if (!entries.length) {
    return (
      <div className="empty-state">
        <TrendingUp size={22} />
        <strong>还没有趋势</strong>
        <span>录入至少两条记录后，这里会生成体重曲线</span>
        <button className="secondary-button" type="button" onClick={onRetry}>
          重试
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
            <strong>今天还没有记录</strong>
            <span>最新记录：{formatChineseDate(latestEntry.date)}</span>
          </div>
          <button className="primary-button" onClick={onGoToday}>
            去记录
          </button>
        </div>
      ) : null}

      <div className="stat-grid">
        <StatCard
          label="平均体重"
          value={stats.average != null ? formatWeight(stats.average, unit) : "—"}
          unit={unit}
          hint={`${stats.count} 条记录`}
          icon={<TrendingUp size={16} />}
        />
        <StatCard
          label="区间波动"
          value={stats.range != null ? formatWeight(stats.range, unit) : "—"}
          unit={unit}
          hint="最高与最低之差"
          accent
          icon={<Activity size={16} />}
        />
        <StatCard
          label="最低体重"
          value={stats.lowest != null ? formatWeight(stats.lowest, unit) : "—"}
          unit={unit}
          hint="区间最低"
          icon={<Target size={16} />}
        />
        <StatCard
          label="区间变化"
          value={stats.change != null ? formatSignedChange(stats.change, unit) : "—"}
          unit={unit}
          hint="首末差值"
          icon={<Award size={16} />}
        />
      </div>

      <section className="panel chart-panel">
        <div className="panel-head">
          <div>
            <p className="panel-kicker">区间曲线</p>
            <h2>体重趋势</h2>
          </div>
          <div className="segmented">
            {RANGE_LABELS.map((option) => (
              <button
                key={option.key}
                className={range === option.key ? "active" : ""}
                onClick={() => setRange(option.key)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        {rangeEntries.length >= 2 ? (
          <>
            <TrendChart entries={rangeEntries} unit={unit} />
            <div className="chart-foot">
              <div className="chart-legend">
                <span>
                  <i className="legend-line actual" />
                  实际记录
                </span>
                <span>
                  <i className="legend-line smooth" />
                  7 日均线
                </span>
              </div>
              {stats.weekOverWeek != null ? (
                <span
                  className={`change-pill ${changeClass(stats.weekOverWeek)}`}
                >
                  近 7 日 {formatSignedChange(stats.weekOverWeek, unit)} {unit}
                </span>
              ) : null}
            </div>
          </>
        ) : (
          <EmptyState
            icon={Activity}
            title="该区间记录不足"
            description="选择更大的区间，或先录入更多记录"
          />
        )}
      </section>

      <div className="insight-grid">
        <section className="panel streak-panel">
          <div className="panel-head">
            <div>
              <p className="panel-kicker">习惯</p>
              <h2>连续记录</h2>
            </div>
            <span className="panel-icon-tile">
              <Activity size={16} />
            </span>
          </div>
          <div className="streak-body">
            <div className="streak-number">
              <strong>{insights.streakDays}</strong>
              <span>天</span>
            </div>
            <div className="streak-meta">
              <div>
                <span>最长连续</span>
                <strong>{insights.longestStreak} 天</strong>
              </div>
              <div>
                <span>累计记录</span>
                <strong>{insights.daysTracked} 条</strong>
              </div>
              <div>
                <span>累计变化</span>
                <strong>
                  {insights.totalChange != null
                    ? `${formatSignedChange(insights.totalChange, unit)} ${unit}`
                    : "—"}
                </strong>
              </div>
            </div>
          </div>
        </section>
        <section className="panel milestone-panel">
          <div className="panel-head">
            <div>
              <p className="panel-kicker">里程碑</p>
              <h2>减重节点</h2>
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
                      减重 {formatWeight(milestone.threshold, unit)} {unit}
                    </span>
                    {milestone.reached ? (
                      <em>
                        <Check size={12} />
                        {milestone.date
                          ? formatChineseDate(milestone.date)
                          : "已达成"}
                      </em>
                    ) : milestone.remaining != null ? (
                      <em>
                        还差 {formatWeight(milestone.remaining, unit)} {unit}
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
            <p className="panel-kicker">数据</p>
            <h2>导出记录</h2>
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
          <p className="form-hint">导出全部记录，桌面端保存到应用数据目录</p>
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

  const startEdit = () => {
    setWeight(String(Number(toDisplayWeight(entry.weight, unit).toFixed(1))));
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
        weight: Number(fromDisplayWeight(weightValue, unit).toFixed(1)),
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
      ? Number((entry.weight - previousWeight).toFixed(1))
      : null;

  return (
    <div className={`record-row${editing ? " editing" : ""}`}>
      <span className="record-date">{formatFullDate(entry.date)}</span>
      {editing ? (
        <input
          className="inline-input"
          type="number"
          min="0.1"
          step="0.1"
          value={weight}
          aria-label="体重"
          onChange={(event) => {
            setWeight(event.target.value);
            setError(null);
          }}
        />
      ) : (
        <span className="record-weight">
          {formatWeight(entry.weight, unit)}
          <small>{unit}</small>
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
          aria-label="体脂率"
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
          aria-label="备注"
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
              title="保存"
              aria-label="保存"
              disabled={saving}
              onClick={() => void handleSave()}
            >
              <Check size={15} />
            </button>
            <button
              className="icon-button"
              title="取消"
              aria-label="取消"
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
              title="编辑"
              aria-label="编辑"
              onClick={startEdit}
            >
              <Pencil size={15} />
            </button>
            <button
              className={`icon-button danger${deleteArmed ? " armed" : ""}`}
              title={deleteArmed ? "再次点击确认删除" : "删除"}
              aria-label={deleteArmed ? "确认删除" : "删除"}
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

function RecordsView({
  entries,
  unit,
  onChanged,
}: {
  entries: Entry[];
  unit: Unit;
  onChanged: () => void;
}) {
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
        const [year, month] = key.split("-");
        result.push({
          key,
          label: `${year}年${Number(month)}月`,
          rows: [{ entry, previousWeight }],
        });
      } else {
        last.rows.push({ entry, previousWeight });
      }
    }
    return result;
  }, [sorted]);
  const oldest = sorted.length ? sorted[sorted.length - 1].date : null;
  const newest = sorted.length ? sorted[0].date : null;

  return (
    <>
      <div className="stat-grid three">
        <StatCard
          label="记录总数"
          value={String(sorted.length)}
          unit="条"
          hint="全部记录"
          accent
          icon={<CalendarDays size={16} />}
        />
        <StatCard
          label="最早记录"
          value={oldest ? formatChineseDate(oldest) : "—"}
          hint="按日期排序"
          icon={<NotebookPen size={16} />}
        />
        <StatCard
          label="最近记录"
          value={newest ? formatChineseDate(newest) : "—"}
          hint="最新一条"
          icon={<Activity size={16} />}
        />
      </div>
      <section className="panel quick-add-panel">
        <div className="panel-head">
          <div>
            <p className="panel-kicker">快速新增</p>
            <h2>补录一条</h2>
          </div>
          <span className="panel-icon-tile">
            <Plus size={16} />
          </span>
        </div>
        <EntryForm entries={entries} unit={unit} onChanged={onChanged} />
      </section>
      <section className="panel table-panel">
        <div className="panel-head">
          <div>
            <p className="panel-kicker">全部记录</p>
            <h2>记录列表</h2>
          </div>
        </div>
        {sorted.length ? (
          <div className="record-table">
            <div className="record-row record-head">
              <span>日期</span>
              <span>体重（{unit}）</span>
              <span>体脂</span>
              <span>备注</span>
              <span />
            </div>
            {groups.map((group) => (
              <div key={group.key} className="record-month">
                <div className="record-month-label">
                  <span>{group.label}</span>
                  <em>{group.rows.length} 条</em>
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
            title="还没有记录"
            description="新增第一条记录后，会出现在这里"
          />
        )}
      </section>
    </>
  );
}

function SettingsView({
  goal,
  unit,
  onUnitChange,
  onGoalSaved,
}: {
  goal: Goal | null;
  unit: Unit;
  onUnitChange: (unit: Unit) => void;
  onGoalSaved: () => void;
}) {
  const { preference, setPreference } = useTheme();

  return (
    <div className="settings-grid">
      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="panel-kicker">界面</p>
            <h2>外观主题</h2>
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
              {option.label}
            </button>
          ))}
        </div>
      </section>
      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="panel-kicker">数据</p>
            <h2>计量单位</h2>
          </div>
          <span className="panel-icon-tile">
            <Scale size={16} />
          </span>
        </div>
        <div className="segmented wide">
          {(["kg", "lb"] as Unit[]).map((value) => (
            <button
              key={value}
              className={unit === value ? "active" : ""}
              onClick={() => onUnitChange(value)}
            >
              {value}
            </button>
          ))}
        </div>
      </section>
      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="panel-kicker">目标</p>
            <h2>减重目标</h2>
          </div>
          <span className="panel-icon-tile">
            <Target size={16} />
          </span>
        </div>
        <GoalForm goal={goal} unit={unit} onSaved={onGoalSaved} />
      </section>
      <section className="panel about-panel">
        <div className="panel-head">
          <div>
            <p className="panel-kicker">关于</p>
            <h2>Ceres v0.1.0</h2>
          </div>
          <LogoMark className="about-logo" />
        </div>
        <div className="about-list">
          <div>
            <span>存储</span>
            <strong>数据仅保存在本机</strong>
          </div>
          <div>
            <span>版本</span>
            <strong>v0.1.0</strong>
          </div>
          <div>
            <span>定位</span>
            <strong>安静减重 · 长期陪伴</strong>
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

function App() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [unit, setUnit] = useState<Unit>(() => readUnit());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<View>("today");
  const contentRef = useRef<HTMLElement>(null);

  const loadData = useCallback(async () => {
    try {
      const [nextEntries, nextGoal] = await Promise.all([
        listEntries(),
        getGoal(),
      ]);
      setEntries(nextEntries);
      setGoal(nextGoal);
      if (!nextEntries.some((entry) => entry.date === todayKey())) {
        void sendDailyReminder();
      }
    } catch (caught) {
      setError(String(caught));
    } finally {
      setLoading(false);
    }
  }, []);

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

  const meta = VIEW_META[activeView];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <LogoMark className="logo-mark" />
          <div>
            <strong>Ceres</strong>
            <span>本地记录 · 安静减重</span>
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
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <ThemeSwitch />
          <div className="sidebar-foot">
            <LogoMark className="logo-mark" />
            <span>本地数据 · v0.1.0</span>
          </div>
        </div>
      </aside>
      <main className="content" ref={contentRef}>
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
              title="正在载入"
              description="读取本地记录…"
            />
          ) : error ? (
            <div className="empty-state error-state">
              <NotebookPen size={22} />
              <strong>读取失败</strong>
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
                重试
              </button>
            </div>
          ) : (
            <>
              {activeView === "today" ? (
                <TodayView
                  entries={entries}
                  goal={goal}
                  unit={unit}
                  onChanged={() => void loadData()}
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
              {activeView === "settings" ? (
                <SettingsView
                  goal={goal}
                  unit={unit}
                  onUnitChange={handleUnitChange}
                  onGoalSaved={() => void loadData()}
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
