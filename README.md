# SuperEditor

**同一个世界，同一个互联网！** · 作者：科技酱

本地优先的 Markdown 文档编辑器，提供两种形态：

- **Windows 桌面应用**：Electron 独立窗口、任务栏图标、原生打开/保存对话框、直接读写本机文件，可打包成免安装 exe。
- **Web / PWA**：浏览器访问或安装为独立窗口，功能一致。

两者共用同一套前端代码；桌面版额外获得系统对话框、Node 文件系统同步与应用数据文件。

## 快速开始

需要 Node.js 20.19+（推荐 22 / 24）。

```bash
npm install
npm run build          # 构建前端到 dist/
npm run desktop        # 启动桌面应用（独立窗口）
npm run dev            # 浏览器开发服务器 http://127.0.0.1:5173/
npm run preview        # 预览生产构建
npm run gen:logo       # 重新生成全部图标资源（零依赖）
```

### 桌面应用

```bash
npm run desktop        # 直接运行（需先 npm run build）
npm run desktop:dev    # 配合 npm run dev，连接 Vite 开发服务器
npm run desktop:smoke  # 启动窗口、截图后自动退出，用于验证
npm run dist:win       # 生成桌面安装包与免安装目录
```

`dist:win` 会产出：

- `desktop-release/win-unpacked/SuperEditor.exe`：免安装目录，可直接复制分发、双击运行。
- `desktop-release/SuperEditor-Setup-${version}.exe`：NSIS 安装包，写入开始菜单与桌面快捷方式，并注册 `.md` 文件关联。

桌面版的具体行为：

- 无边框自绘标题栏，右侧是最小化 / 最大化 / 关闭按钮；双击标题栏最大化，标题栏可拖动窗口。
- 关闭窗口默认收进系统托盘，托盘图标可恢复或退出；从托盘退出才会真正关闭进程。
- 导入、插入图片、恢复备份走系统「打开文件」对话框；所有导出走系统「保存文件」对话框并直接写磁盘，不经过浏览器下载列表。
- 支持把文件直接拖入窗口导入；安装后双击系统中的 `.md` 文件会用本应用打开并导入为文档（免安装版可在系统「打开方式」中手动关联）。
- 打开或导入的文档会写入系统「最近使用」跳转列表，方便从任务栏快速找回。
- 工作区同时写入 `%APPDATA%/super-editor/workspace.json`，首次启动可从该文件恢复；「文件 → 打开数据文件位置」可在资源管理器中定位。
- 文件夹同步使用 Node `fs`，不需要浏览器授权；目录路径记在 `sync-folder.txt`。
- 原生右键菜单、外部链接调用系统浏览器、单实例锁（重复启动会聚焦已有窗口）。
- 主进程在本地回环启动静态服务加载 `dist/`，因此 PDF worker、字体与动态 import 与浏览器版行为一致；桌面版不注册 Service Worker。

主进程在 `desktop/main.cjs`，预加载桥接在 `desktop/preload.cjs`（`contextIsolation` 开启，只暴露白名单 IPC）。

打包由 `tools/build-pkg.ps1` 完成：先手动组装完整应用目录（Electron 运行时 + `resources/app.asar`），再以 `electron-builder --prepackaged` 生成 NSIS 安装包。这样既保证免安装目录与安装包都包含完整的 Electron 运行时，也不依赖打包器对旧目录的删除/回收站操作——部分受限环境会拦截该操作，导致常规打包失败。

## 界面与功能

| 模块 | 说明 |
| --- | --- |
| 标题栏 | 透明 Logo、文档名（单击改名）、保存状态、同步状态、主题与设置；桌面版右侧有窗口控制按钮 |
| 菜单栏 | 文件 / 编辑 / 视图 / 插入 / 工具 / 帮助，原生风格下拉菜单；右侧是视图模式、演示与导出 |
| 工作区 | 左侧文档列表；编辑区顶部是紧凑格式工具条，预览区顶部是与之等高对齐的标题条；右侧可展开大纲 |
| 编辑器 | CodeMirror 6：语法高亮、行号、折叠、查找替换、括号匹配、多光标 |
| 实时预览 | GFM 表格 / 任务列表、代码高亮、KaTeX 公式、Mermaid 图表、DOMPurify 净化 |
| 视图 | 默认「仅编辑」，可切换分屏 / 仅预览；预览内容始终实时渲染，分屏与侧栏可拖拽，编辑区与预览区滚动同步 |
| 文档管理 | 多文档、新建 / 重命名 / 复制 / 删除 / 筛选、自动保存、JSON 备份与恢复 |
| 演示模式 | 按 `---` 分页，全屏放映，方向键翻页，F 全屏、B 黑屏、Esc 退出 |
| 其他 | 明暗双主题、文档大纲、字数状态栏、命令面板（`Ctrl+K`）、设置面板 |

顶部只有标题栏与菜单栏两层，格式按钮收在编辑区自己的工具条里，避免同一个功能在多个横条中重复出现。控件高度、字号和间距使用统一刻度（36 / 28 / 32 / 24px，12px 正文、11px 次要信息）。

## 同步

点击标题栏右侧的「仅本地」，或在「文件 → 同步设置」中打开同步对话框。

- **多窗口同步**：同源其他窗口的修改会通过 `localStorage` 的 `storage` 事件实时同步。
- **文件夹同步**：绑定本机目录后，每篇文档对应一个 `.md` 文件，目录里另有 `.supereditor-index.json` 记录映射。内容变更 1.2 秒后增量写入；新建、删除、重命名、导入、恢复会全量重写；「从文件夹读取」可把目录里的 `.md` / `.txt` 导入为新文档。

桌面版通过 Node `fs` 直接读写；Web 版使用 File System Access API（仅 Chrome / Edge，权限存 IndexedDB，可能要求每次会话重新授权）。数据不经任何服务器，也没有云同步。

## 图标

Logo 是**透明背景**的单色几何图形：一个被竖线分开的窗口，左侧是 Markdown 源码行，右侧是预览标题行。所有位置共用同一份几何数据 `src/core/brand.js`：

- 顶栏、关于对话框、演示页、导出 HTML / 打印页
- `public/favicon.svg`、`public/favicon.ico`
- `public/icons/icon-16…512.png`（含 maskable 图标）、`public/icons/app.ico`
- `public/manifest.webmanifest`（Web 版）与 Windows 可执行程序图标

改 Logo 只需编辑 `src/core/brand.js` 的矩形数组，然后运行 `npm run gen:logo`。PNG / ICO 由脚本用 Node 内置 `zlib` 直接编码，无第三方依赖。

Web 版另带 `manifest.webmanifest` 与 `sw.js`，可安装为独立窗口应用并离线打开；Service Worker 只在生产构建的浏览器环境注册。

## 格式支持

| 格式 | 导入 | 导出 | 实现 |
| --- | :---: | :---: | --- |
| Markdown / TXT | 是 | 是 | 原生 |
| HTML | 是 | 是 | Turndown / 独立样式网页 |
| PDF | 是 | 是 | pdf.js 提取文字 / jsPDF + html2canvas |
| Word DOCX | 是 | 是 | mammoth / docx |
| PPTX | 是 | 是 | JSZip 解析 / PptxGenJS 生成 |
| PNG 长图 | — | 是 | html2canvas |
| 打印 | — | 是 | 浏览器打印，可选择「另存为 PDF」，文字可选中 |

一键导出的 PDF 为 A4 分页截图，版面一致但文字不可选中；需要文字层请用「打印 / 另存为 PDF」。

## 幻灯片语法

```markdown
# 封面标题
## 副标题

---

## 第二页要点
- 第一点
- 第二点
```

- 代码块内的 `---` 不会分页；文档开头的 YAML frontmatter 会被跳过。
- 没有分页符时整篇文档作为一页；只想要水平分隔线请用 `***`。

## 常用快捷键

| 操作 | 快捷键 |
| --- | --- |
| 命令面板 | `Ctrl + K` |
| 保存 / 新建 | `Ctrl + S` / `Ctrl + Alt + N` |
| 切换视图 / 侧栏 | `Ctrl + Shift + P` / `Ctrl + Shift + B` |
| 开始演示 | `F5` |
| 粗体 / 斜体 / 删除线 / 行内代码 | `Ctrl + B` / `Ctrl + I` / `Ctrl + Shift + X` / `Ctrl + Shift + C` |
| 链接 / 列表 / 引用 | `Ctrl + Shift + K` / `Ctrl + Shift + 8、7` / `Ctrl + Shift + 9` |
| 标题 1~3 | `Ctrl + Alt + 1、2、3` |
| 演示翻页 / 全屏 / 黑屏 / 退出 | `← →` 或空格 / `F` / `B` / `Esc` |

## 数据与限制

- Web 版文档保存在 `localStorage`（约 5 MB）；桌面版额外有 `workspace.json` 数据文件。
- 内嵌大量 Base64 图片可能触发浏览器容量告警，此时请导出 JSON 备份或改用图片链接。
- 扫描件 / 图片型 PDF 没有文字层，导入时会给出明确提示。
- PPTX 导入提取幻灯片文字并还原为「标题 + 列表 + 分页」的 Markdown，不还原复杂图形与动画；PPTX 导出同样基于结构化文本生成简洁版式。
- Mermaid、PDF、Office 转换库按需动态加载，首次使用图表或导入导出时会有短暂加载。

## 技术栈

Vite 8 · Electron 38 · CodeMirror 6 · Marked · DOMPurify · highlight.js · KaTeX · Mermaid · Turndown · mammoth · pdf.js · docx · PptxGenJS · jsPDF · html2canvas · JSZip

## 发布版本

当前版本 `v1.2.0`。执行 `npm run dist:win`（先 `npm install`）会在 `desktop-release/` 生成：

| 产物 | 说明 |
| --- | --- |
| `SuperEditor-Setup-1.2.0.exe` | NSIS 安装版：开始菜单、桌面快捷方式、`.md` 文件关联、卸载程序 |
| `SuperEditor-Portable-1.2.0.zip` | 便携版：解压即用，不写注册表，适合 U 盘携带 |
| `win-unpacked/SuperEditor.exe` | 免安装目录，可直接复制分发 |

发布页：https://github.com/techjiang/SuperEditor/releases

## 作者

**科技酱** · 同一个世界，同一个互联网！

| | |
| --- | --- |
| 官网 | https://www.asoe.cn |
| 技术文档 | https://docs.asoe.cn |
| GitHub | https://github.com/techjiang/ |
| 哔哩哔哩 | https://space.bilibili.com/1768832152 |
| 玲珑论坛 | https://forums.asoe.cn/ |
| 邮箱 | official@tech.asoe.cn |
| QQ 群 | 291974598 · 474819022 · 631167288 |

开源许可：[MIT](LICENSE) · Copyright © 2026 科技酱
