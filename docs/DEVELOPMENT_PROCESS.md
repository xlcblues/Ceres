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
- **图表**：轻量 SVG 自绘，趋势图与环形进度图为主，不引入重型图表库。

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
│  ├─ 视图：今日 / 趋势 / 记录 / AI / 设置   │
│  ├─ 组件库：按设计令牌构建                 │
│  └─ 状态：React hooks + SQLite 命令        │
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

> 实际表结构以 `src-tauri/src/db.rs` 的迁移为准：v2 新增 `profile`、`food_catalog`、`exercise_catalog`、`food_log`、`exercise_log`、`water_log`，v3 为 `goal` 增加 `target_date`，v4 新增 `ai_session` 会话表用于 AI 多轮对话与历史记录。

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
- 前端：React 19、TypeScript、Vite、`lucide-react`、`react-markdown` + `remark-gfm`；图表为自绘 SVG。
- 数据：`rusqlite`（bundled SQLite），AI 配置与流式对话经 Tauri IPC（`Channel`）。
- 测试：Vitest（单元）、Rust `cargo test`、`scripts/ui-verify.cjs`（Playwright UI 审计）。

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

- [x] 趋势页：折线图、区间聚合、均值/波动指标
- [x] 连续记录天数（Streak）与里程碑（如"减重 5kg"）
- [x] 导出 CSV / JSON
- [x] 系统通知（记录提醒，可选）

### M3 交付说明

- 趋势页新增区间切换（7 天 / 30 天 / 90 天 / 全部），图表展示原始曲线与 7 日移动平均，悬停可查看单日详情。
- 新增连续记录、最长连续、累计变化与减重里程碑（1 / 2.5 / 5 / 7.5 / 10 kg）面板。
- 新增 CSV / JSON 导出；Tauri 桌面端写入应用数据目录 `exports/`，浏览器预览模式直接下载。
- 以应用内"今日未记录"提示作为轻量提醒，系统通知已在 M4 接入 Tauri 通知插件。

### 里程碑 M4：打磨与发布（第 9-10 周，已完成）

- [x] 空状态、错误状态与边界输入（单位、日期）
- [x] 打包安装程序与图标验证
- [x] 端到端冒烟测试
- [x] 发布 v0.1（本地分发）

### M4 交付说明

- 边界输入：体重限制在 0.1-500（显示单位），空串与非法数值被拦截；录入日期与目标起始日期均不能晚于今天；体脂率限制在 0-100。校验集中在 `src/lib/validation.ts`，录入、编辑、目标三个入口统一复用。
- 空状态与错误状态：今日页、记录页、趋势页均有空状态引导；应用顶层读取失败展示错误态并支持重试；导出状态区分成功与失败。
- 系统通知：启动时若今日未记录体重，通过系统通知提醒一次（每日一次，浏览器预览模式降级为 Web Notification）。
- 浏览器预览不再自动填充演示数据，改为显式开启：`npm run dev -- --host` 后访问 `/?demo=1` 可查看示例数据。
- 端到端冒烟：`npm test`（23 项）、`cargo test`（7 项）、`npm run build`、`npm run tauri build` 均通过。

### 优化阶段：UI 布局（已完成首轮）

功能基本完成后进入 UI 优化轮，重点处理信息层级、滚动体验与窄窗口适配：

- [x] 侧边栏新增主题快速切换（浅色/深色/跟随系统），紧凑窗口下收窄为纯图标栏
- [x] 页头改为 sticky 毛玻璃分隔，滚动时显示边界线
- [x] 统计卡图标统一为固定尺寸圆角方块，悬停轻微浮起
- [x] 录入与目标表单改为原生 `<form>`，回车即可保存
- [x] 今日面板新增“已记录/未记录”状态胶囊，减少重复录入误判
- [x] 记录页按月份分组，长列表限高滚动、表头固定、行悬停/编辑态高亮
- [x] 趋势图用图例替代纯文字提示
- [x] 设置页新增“关于 Ceres”面板
- [x] 自定义细滚动条，并补充 760px 以下紧凑侧栏布局
- [x] 新增 UI 审计脚本：`node scripts/ui-verify.cjs`，覆盖桌面/窄/紧凑视口与深浅主题共 24 张截图，检查溢出、重叠与滚动吸附

### 里程碑 M5：饮食、运动与饮水（已完成）

- [x] 内置食物 / 运动数据库（48 种食物、16+ 种运动），点击弹窗选择
- [x] 每日饮食、运动、饮水记录，自动计算摄入与消耗卡路里
- [x] 基于热量差预测明日体重
- [x] 食物 / 运动条目支持 AI 估算卡路里并自动入库

### 里程碑 M6：AI 助手（已完成）

- [x] 支持硅基流动 / OpenAI / DeepSeek / 自定义 OpenAI 兼容 API
- [x] 流式聊天（Tauri `Channel`），Markdown 渲染，无气泡的对话式布局
- [x] 读取系统数据（体重、饮食、运动、目标），以自然语言录入并应用动作
- [x] 未知食物 / 运动 AI 估算热量并写入数据库

### 里程碑 M7：多语言与发布（已完成）

- [x] 简体中文 / English 切换
- [x] 今日页对称四面板、斤单位、体重两位小数
- [x] v0.1.0 打包发布（NSIS 安装包 + 便携版）
- [x] v0.2.0 打包发布（AI 记忆/历史、界面修复、热量计算修正）
- [x] v0.2.1 打包发布（消耗能量包含每日代谢）
- [x] v0.2.2 打包发布（里程碑按减重目标生成）

### v0.1.0 发布说明

- 版本号 `0.1.0`，主窗口 1180x760（最小 960x640）。
- 产物包含 NSIS 安装程序与 `Ceres_0.1.0_x64_portable.zip`，Release 附带 SHA256 校验。
- 已知限制：安装包未签名，首次运行会被 Windows SmartScreen 拦截，需「更多信息 → 仍要运行」。

### v0.2.0 发布说明

- 版本号 `0.2.0`，AI 助手支持多轮记忆与历史会话。
- 修复 AI 页面空白、会话时间字段不兼容问题。
- 今日页「净热量」改为 `摄入 - 运动消耗`，与「摄入/消耗」卡片保持一致。
- 产物包含 NSIS 安装程序与 `Ceres_0.2.0_x64_portable.zip`，Release 附带 SHA256 校验。

### v0.2.1 发布说明

- 版本号 `0.2.1`，「消耗」卡片计入每日代谢（TDEE + 运动消耗）。
- 今日页三张热量卡片统一为 `摄入 - 总消耗 = 净热量`，数值展示保持一致。
- 产物包含 NSIS 安装程序、MSI 与 `Ceres_0.2.1_x64_portable.zip`，Release 附带 SHA256 校验。

### v0.2.2 发布说明

- 版本号 `0.2.2`，趋势页「减重节点」改为按减重目标生成：目标减重幅度的 10% / 25% / 50% / 75% / 100%。
- 节点文案显示「目标百分比 · 减重数值」，未设置目标时回退到固定节点。
- 产物包含 NSIS 安装程序、MSI 与 `Ceres_0.2.2_x64_portable.zip`，Release 附带 SHA256 校验。

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

# UI 布局审计（需先启动 npm run dev）
node scripts/ui-verify.cjs
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
- 已知限制：当前安装包未签名，SmartScreen 会提示未知发布者；正式分发可申请代码签名证书消除该提示。

## 9. 验收清单

- [x] 应用可安装并启动，无控制台报错。
- [x] 深色/浅色模式均符合品牌板视觉。
- [x] 录入、编辑、删除记录后重启数据不丢失。
- [x] 趋势图正确反映数据，日期与数值无偏移。
- [x] 单位切换（kg/lb/斤）与日期边界无异常。
- [x] 安装包体积符合预期，图标在所有尺寸清晰。
- [x] 核心流程通过端到端冒烟测试。

## 10. 后续规划（非 MVP）

- 与体重秤/健康应用的数据导入。
- 本地备份与多设备同步（可选、加密）。
- 桌面小组件/托盘快捷记录。
- 体重指数（BMI）、体脂目标与更多健康指标。

