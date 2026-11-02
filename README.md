# Ceres

> 面向 Windows 的本地优先减肥记录桌面应用。

Ceres 是一款极简、现代的 Windows 桌面应用：安静的数据面板、克制的交互，用长期趋势代替对单日数字的评判。所有数据保存在本机 SQLite，无需登录，启动即用。

## 功能

- 体重 / 体脂记录：支持斤 / 公斤 / 磅，体重保留两位小数
- 目标管理：目标体重、起始体重、目标日期，今日页进度环形图，趋势页每日目标线
- 趋势洞察：7 / 30 / 90 天 / 全部区间，原始曲线 + 7 日移动平均，连续记录、最长连续、里程碑与累计变化
- 明日体重预测：基于饮食、运动热量差估算下一天体重
- 饮食 / 运动 / 饮水记录：内置 48 种食物与 16+ 种运动数据库，点击弹窗选择，自动计算卡路里
- AI 助手：支持硅基流动、OpenAI、DeepSeek 与自定义 OpenAI 兼容 API；流式聊天、读取系统数据、语音录入体重/饮食/运动，未知食物与运动可 AI 估算卡路里并自动入库
- 多语言：简体中文 / English
- 在线更新：设置页检查更新，发布新版后应用内直接下载并安装
- 系统通知、CSV / JSON 导出、浅色 / 深色 / 跟随系统主题

## 技术栈

- 外壳：Tauri 2（Rust），本地存储采用 `rusqlite`（bundled SQLite）
- 前端：React 19 + TypeScript + Vite，自绘 SVG 图表
- 图标：`lucide-react`；AI 输出渲染：`react-markdown` + `remark-gfm`

## 开发

```bash
npm install
npm run tauri dev
```

仅启动前端（浏览器预览）：

```bash
npm run dev
```

浏览器预览默认不填充演示数据；需要示例数据时访问 `/?demo=1`。

## 构建

```bash
npm run build
npm run tauri build
```

打包产物位于 `src-tauri/target/release/bundle/`。

由于启用了应用内更新，正式打包时需要提供更新签名私钥：

```powershell
$env:TAURI_SIGNING_PRIVATE_KEY = "C:\Users\11963\.tauri\ceres.key"
npm run tauri build
```

私钥只保存在本机，不要提交到仓库；公钥已写入 `src-tauri/tauri.conf.json`。

## 发布

1. 构建前设置 `TAURI_SIGNING_PRIVATE_KEY` 环境变量。
2. 执行 `npm run tauri build` 生成安装包。
3. 生成更新清单：

```bash
npm run update:manifest -- --notes "本次更新说明"
```

4. 将 NSIS 安装包与 `src-tauri/target/release/bundle/latest.json` 一起上传到 GitHub Release 资产；`latest.json` 必须保持这个文件名，应用会从 `releases/latest/download/latest.json` 检查更新。

> 当前安装包未签名，首次运行可能触发 Windows SmartScreen；点击「更多信息」→「仍要运行」即可。

## 品牌资产

Logo、色板与品牌板见 `assets/brand/`。

## 文档

完整的开发流程文档见 [docs/DEVELOPMENT_PROCESS.md](docs/DEVELOPMENT_PROCESS.md)。

