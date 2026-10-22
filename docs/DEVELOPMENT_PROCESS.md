# Ceres 开发流程文档

> Ceres：一款面向 Windows 的本地优先减肥记录桌面应用。
> 本文档记录从品牌设计、技术选型到交付验收的完整开发流程，作为后续所有开发工作的依据。

## 1. 产品定位

Ceres 用于记录体重、体脂等身体指标，追踪长期趋势，帮助用户以稳定的节奏达成目标。

核心原则：

- **本地优先**：数据保存在本机 SQLite，无需登录、不依赖云服务，启动即用。
- **趋势而非数字**：界面强调长期趋势和可持续习惯，弱化对单日数值的评判。
- **安静、高级**：克制的数据面板，不打扰用户，让记录成为日常习惯。

## 2. 品牌与设计系统

### 2.1 Logo 设计理念

Logo 灵感来自 Ceres（谷物与丰收女神）的名字：

- **主体**：一个开放的空心圆弧，构成字母 `C`，同时像一轮新月或收割后的谷穗。
- **中心**：一颗 Harvest Gold 的圆点，象征谷物颗粒、目标进度，以及"每天一点收获"。
- **风格**：极简几何、大量留白、两种主色，可在任意尺寸下保持可读性。

品牌资产位于 `assets/brand/`：

| 文件 | 用途 |
| --- | --- |
| `logo-mark.svg` | 浅色背景上的图标 |
| `logo-mark-dark.svg` | 深色背景上的图标 |
| `logo-horizontal-light.svg` | 浅色背景横版 Logo |
| `logo-horizontal-dark.svg` | 深色背景横版 Logo |
| `brand-board.html` / `.png` | 品牌板，汇总 Logo、色彩、字体与 UI 预览 |

### 2.2 从 Logo 推导色彩

Logo 中只有两种颜色：Ceres Green（谷绿）与 Harvest Gold（收获金）。整个界面以这两种颜色为轴心扩展出完整色板。

| Token | 值 | 角色 |
| --- | --- | --- |
| `ceres.green` | `#173B2F` | 主色，深绿，用于导航、主按钮、图表主线条 |
| `ceres.deep` | `#10251C` | 深色模式背景、Hero 区域 |
| `harvest.gold` | `#E3A63C` | 强调色，用于进度、目标、关键数字 |
| `paper` | `#F4F0E6` | 浅色模式背景，暖白纸感 |
| `ink` | `#101D17` | 主文字色 |
| `sage` | `#6F8B7B` | 次级文字、分隔线、弱化元素 |

配色逻辑：

- 浅色模式：`paper` 背景 + `ink` 文字 + `green` 结构 + `gold` 强调。
- 深色模式：`deep` 背景 + 暖白文字 + 半透明白色层级 + `gold` 强调。
- 金色只用于"目标、进度、收获"类语义，避免全界面滥用。

### 2.3 字体与排版

- 字体：`Segoe UI Variable`（Windows 原生），回退到 `Inter`。
- 字重：界面文字 400，标题/数据 600-650；不使用负字距。
- 原则：大字号只用于目标和数字；面板内使用紧凑标题。
- 圆角：8px（卡片、按钮、输入框），延续品牌板的克制风格。
- 密度：日常可扫描的密集信息布局，同时保留充足留白。

### 2.4 界面风格原则

- 仪表盘式布局：左侧导航栏 + 主内容区，不出现营销化大 Banner。
- 视觉节奏：细边框分隔，避免大色块堆叠；阴影低对比、柔和。
- 动效：轻微淡入与位移，不打扰数据阅读，尊重系统"减少动态效果"设置。
- 深色/浅色：跟随系统或手动切换，两套 token 共用一套组件。

## 3. 技术选型

### 3.1 约束与目标

- 仅面向 Windows（优先 Windows 10/11）。
- 需要"现代高级"的自定义 UI，前端表达力强。
- 本地数据优先，安装包小、启动快、资源占用低。
- 需要系统通知、导出、托盘等桌面能力。

### 3.2 方案对比

| 方案 | 前端能力 | 安装包/启动 | 本地存储 | 生态/维护 | 结论 |
| --- | --- | --- | --- | --- | --- |
| Tauri 2 + React + TS | 高，完全自定义 | 极小（约 10-20MB），启动快 | SQLite（Rust 插件） | 活跃，Vite 生态 | 推荐 |
| Electron + React | 高 | 大（约 100MB+），内存高 | SQLite/IndexedDB | 成熟但重 | 备选 |
| WinUI 3 + C#/.NET | 中，需手写大量控件 | 中 | SQLite（EF Core） | 微软官方，Windows 感最强 | 备选 |
| Qt/QML | 中高 | 中 | SQLite | 成熟，但授权与开发体验一般 | 不推荐 |

### 3.3 选定技术栈

**主选：Tauri 2 + React + TypeScript + Vite**

- **外壳**：Tauri 2（Rust），负责窗口、系统通知、托盘、打包与自动更新。
- **前端**：React 19 + TypeScript + Vite，承载全部品牌 UI。
- **样式**：CSS 设计令牌（Design Tokens）+ 轻量 CSS 方案，不用重型组件库，以最大化品牌一致性。
- **数据层**：SQLite（实际采用 `rusqlite` + bundled 编译），个人体重记录数据量小，SQLite 足够且零运维。
- **图表**：轻量 SVG 自绘或 `Recharts`，趋势图与环形进度图为主。

**备选：WinUI 3 + C#/.NET 8**

当"原生 Windows 手感"优先于开发速度与自定义 UI 时启用。适合需要 Fluent 动效、深色模式原生集成、以及未来接入 WinRT 能力的场景，但完全自定义高级 UI 的成本更高。

### 3.4 关键技术理由

- **为什么不用 Electron**：本项目是个人工具，Electron 的运行时体积与内存占用没有收益。
- **为什么用 React 而非纯 Rust 前端**：品牌 UI 需要快速迭代，Web 技术栈表达力最高，且与 Tauri 前端能力完全匹配。
- **为什么用 SQLite 而非 JSON/IndexedDB**：需要查询趋势、聚合统计与增量导出；SQLite 稳定、可备份、可迁移。

## 4. 架构设计

### 4.1 整体架构

```text
┌─────────────────────────────────────────────┐
│  Tauri 2 外壳 (Rust)                       │
│  ├─ 窗口管理 / 托盘 / 系统通知             │
│  ├─ SQLite 数据层 (rusqlite bundled)          │
│  └─ 命令接口 (tauri commands)              │
├─────────────────────────────────────────────┤
│  React + TypeScript 前端                   │
│  ├─ 视图：今日 / 趋势 / 记录 / 设置        │
│  ├─ 组件库：按设计令牌构建                 │
│  └─ 状态：Zustand / TanStack Query         │
└─────────────────────────────────────────────┘
```

### 4.2 数据模型（MVP）

```sql
-- 用户目标
CREATE TABLE goal (
  id INTEGER PRIMARY KEY,
  target_weight REAL NOT NULL,
  start_weight REAL,
  start_date TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- 每日记录
CREATE TABLE entry (
  id INTEGER PRIMARY KEY,
  date TEXT NOT NULL UNIQUE,
  weight REAL NOT NULL,
  body_fat REAL,
  note TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- 应用设置
CREATE TABLE setting (
  key TEXT PRIMARY KEY,
  value TEXT
);
```

### 4.3 模块划分

- `src-tauri/`：Rust 外壳、SQLite 封装、`commands`、通知与托盘。
- `src/`：React 前端。
  - `src/views/`：今日、趋势、记录、设置。
  - `src/components/`：可复用 UI 组件。
  - `src/lib/`：数据访问、日期/单位工具、图表。
  - `src/styles/`：设计令牌（CSS 变量）与全局样式。
- `assets/brand/`：品牌资产。

## 5. 依赖与工具

### 5.1 核心依赖

- 运行时：Rust（stable）、Node.js 18+、Tauri 2 CLI。
- 前端：React、TypeScript、Vite、Zustand、TanStack Query、Recharts（或自绘 SVG）。
- 数据：`rusqlite 0.32`（bundled SQLite，M2 已实际采用）。
- 测试：Vitest（单元）、React Testing Library（组件）、Playwright（端到端，可选）。

### 5.2 推荐的 Tauri Skills

- `dchuk/claude-code-tauri-skills@setting-up-tauri-projects`：Tauri 2 项目初始化与常见踩坑。
- `smithery.ai@tauri-v2`：Tauri 2 插件与命令编写参考。
- 安装与阅读对应 `SKILL.md` 后再开始脚手架，避免版本与配置陷阱。

## 6. MVP 路线图

### 里程碑 M1：品牌与工程骨架（第 1-2 周）

- [x] Logo 与品牌板（当前已完成）
- [x] Tauri 2 + React + TS 脚手架初始化
- [x] 设计令牌落地为 CSS 变量，接入全局样式
- [x] 深色/浅色模式切换
- [x] Windows 图标与应用元数据（见第 8 节）

### 里程碑 M2：核心记录闭环（第 3-5 周，已完成）

- [x] SQLite 建表与迁移
- [x] 今日页：录入体重/体脂、编辑、删除当日记录
- [x] 目标设置与进度环形图
- [x] 基础单元测试（日期工具、数据层）

### 里程碑 M3：趋势与洞察（第 6-8 周）

- [ ] 趋势页：折线图、区间聚合、均值/波动指标
- [ ] 连续记录天数（Streak）与里程碑（如"减重 5kg"）
- [ ] 导出 CSV / JSON
- [ ] 系统通知（记录提醒，可选）

### 里程碑 M4：打磨与发布（第 9-10 周）

- [ ] 空状态、错误状态与边界输入（单位、日期）
- [ ] 打包安装程序与图标验证
- [ ] 端到端冒烟测试
- [ ] 发布 v0.1（本地分发）

## 7. 开发流程与命令

### 7.1 日常开发

```bash
# 安装依赖并启动开发模式（热更新）
npm install
npm run tauri dev

# 仅启动前端（无桌面外壳时）
npm run dev
```

### 7.2 测试

```bash
# 单元测试
npm test

# 构建
npm run build
npm run tauri build
```

### 7.3 约定

- 分支：`main` 保持可发布；功能开发用特性分支。
- 提交：小而聚焦，提交信息说明意图。
- 每次改动品牌色/排版时，同步更新 `assets/brand/` 与设计令牌，避免两端漂移。
- 数据层改动必须写迁移，不得直接改已有表结构。

## 8. Windows 打包与图标

- 从 `logo-mark.svg` 导出 1024x1024 透明 PNG（`assets/brand/logo-mark-1024.png`）。
- 用 `npm run tauri icon assets/brand/logo-mark-1024.png` 生成全套 Windows/macOS/Store 图标到 `src-tauri/icons/`。
- `tauri.conf.json` 配置 `bundle.icon` 与窗口元数据（当前 `productName`/`title` 为 Ceres）。
- 打包命令：`npm run tauri build`，产物在 `src-tauri/target/release/bundle/`。
- 发布前检查：任务栏图标、窗口标题栏、托盘图标在浅色/深色系统主题下均清晰。

## 9. 验收清单

- [ ] 应用可安装并启动，无控制台报错。
- [ ] 深色/浅色模式均符合品牌板视觉。
- [ ] 录入、编辑、删除记录后重启数据不丢失。
- [ ] 趋势图正确反映数据，日期与数值无偏移。
- [ ] 单位切换（kg/lb）与日期边界无异常。
- [ ] 安装包体积符合预期，图标在所有尺寸清晰。
- [ ] 核心流程通过端到端冒烟测试。

## 10. 后续规划（非 MVP）

- 体重趋势的移动平均与目标预测。
- 与体重秤/健康应用的数据导入。
- 本地备份与多设备同步（可选、加密）。
- 桌面小组件/托盘快捷记录。

