const KEY = 'supereditor.workspace.v1';

export const DEFAULT_SETTINGS = {
  theme: 'light',
  mode: 'edit',
  modeChosen: false,
  fontSize: 14,
  lineHeight: 1.65,
  fontFamily: 'mono',
  previewWidth: 820,
  syncScroll: true,
  sidebarWidth: 220,
  sidebarVisible: true,
  splitRatio: 50,
  outlineVisible: false,
  autoSave: true,
  breaks: false,
};

const WELCOME = `# SuperEditor 使用说明

SuperEditor 是一个本地优先的 Markdown 编辑器。文档默认保存在浏览器中，也可以绑定到本机文件夹，同步为独立的 .md 文件。需要交付时再导出成 PDF、Word、PPT 或网页。

## 窗口布局

从上到下是标题栏、菜单栏、工作区和状态栏。左侧是文档列表；编辑区顶部是格式工具条，预览区顶部是与之对齐的标题条；右侧可以打开大纲。

- 标题栏中间是当前文档名，单击即可改名。
- 标题栏右侧显示同步状态，点击可连接本地文件夹。
- 菜单栏包含文件、编辑、视图、插入、工具、帮助。
- 编辑区工具条只放最常用的格式按钮，其余命令在「插入」菜单和命令面板里。
- 视图模式在菜单栏右侧切换，也可以按 \`Ctrl+Shift+P\` 循环。

## 常用操作

| 操作 | 位置 |
| --- | --- |
| 新建文档 | 文件 → 新建文档，或 \`Ctrl+Alt+N\` |
| 导入文件 | 文件 → 导入文件，或侧栏的上传按钮 |
| 导出 | 文件 → 导出为，或右上角「导出」 |
| 查找全部命令 | \`Ctrl+K\` |
| 幻灯片放映 | \`F5\` |
| 备份与恢复 | 侧栏底部 |

## Markdown 速查

| 写法 | 结果 |
| --- | --- |
| \`# 标题\` | 一级标题 |
| \`**文字**\` | 粗体 |
| \`- 项目\` | 无序列表 |
| \`- [ ] 事项\` | 待办项 |
| \`> 引用\` | 引用块 |
| 三个反引号加语言名 | 代码块 |

表格、代码块、数学公式和流程图都可以从「插入」菜单直接插入。公式写作 \`$E = mc^2$\` 或独立成段的 \`$$\` 块，流程图写在 mermaid 代码块里。

## 幻灯片

在文档里用单独一行 \`---\` 分页。按 \`F5\` 开始放映，方向键或空格翻页，\`Esc\` 退出。同一份内容也能从「导出」菜单生成 .pptx 文件。

代码块内部的 \`---\` 不会分页。只想画一条水平分隔线时请用 \`***\`。

## 数据

内容保存在浏览器本地存储，请定期用「备份工作区」导出 JSON。清除浏览器站点数据会一并删除文档。连接文件夹同步后，每篇文档在磁盘上对应一个 .md 文件，其他编辑器也能直接打开。
`;

const SLIDES = `# SuperEditor

## 本地优先的 Markdown 编辑器

版本 1.2 · 2026 年 11 月

---

## 要解决的问题

- 同一份内容需要分别制作 Word、PPT 和 PDF
- 排版操作打断写作
- 文档与特定软件绑定，迁移成本高
- 需要一个能直接读写 .md 文件的工具

---

## 当前实现

| 模块 | 状态 |
| --- | --- |
| Markdown 编辑与实时预览 | 已完成 |
| PDF / Word / 网页 / 长图导出 | 已完成 |
| 幻灯片放映与 .pptx 导出 | 已完成 |
| DOCX / PDF / PPTX 导入 | 已完成 |
| 本地文件夹同步 | 已完成 |
| 多窗口同步 | 已完成 |
| 云同步 | 未规划 |

---

## 数据流向

\`\`\`mermaid
graph LR
  A[.md 源文件] --> B[SuperEditor]
  B --> C[PDF]
  B --> D[PPTX]
  B --> E[DOCX]
  B --> F[本地文件夹]
\`\`\`

---

## 后续

- 提高表格与图片在导出文件中的还原度
- 增加文档版本历史
- 补充更多导入格式

### 讨论
`;

const uid = () => `d_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

function now() { return Date.now(); }

function freshState() {
  const docs = [
    { id: uid(), title: '使用说明', content: WELCOME, createdAt: now(), updatedAt: now() },
    { id: uid() + 'b', title: '项目进度（幻灯片）', content: SLIDES, createdAt: now(), updatedAt: now() - 1 },
  ];
  return { version: 1, docs, activeId: docs[0].id, settings: { ...DEFAULT_SETTINGS } };
}

function sanitize(raw) {
  if (!raw || !Array.isArray(raw.docs)) return null;
  const docs = raw.docs
    .filter((d) => d && typeof d === 'object')
    .map((d) => ({
      id: String(d.id || uid()),
      title: String(d.title || '未命名文档'),
      content: String(d.content || ''),
      createdAt: Number(d.createdAt) || now(),
      updatedAt: Number(d.updatedAt) || now(),
    }));
  if (!docs.length) docs.push({ id: uid(), title: '未命名文档', content: '', createdAt: now(), updatedAt: now() });
  const activeId = docs.some((d) => d.id === raw.activeId) ? raw.activeId : docs[0].id;
  const settings = { ...DEFAULT_SETTINGS, ...(raw.settings || {}) };
  // 旧版本默认分屏且用户未主动选择过视图时，迁移到新的默认「仅编辑」
  if (!raw.settings?.modeChosen) settings.mode = DEFAULT_SETTINGS.mode;
  return {
    version: 1,
    docs,
    activeId,
    settings,
  };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = sanitize(JSON.parse(raw));
      if (parsed) return parsed;
    }
  } catch (err) {
    console.warn('[SuperEditor] 读取本地数据失败', err);
  }
  return freshState();
}

let state = load();
const listeners = new Set();
let saveTimer = null;
let lastPersistOk = true;

export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit(type, payload) { listeners.forEach((fn) => fn(type, payload)); }

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== KEY || !event.newValue) return;
    try {
      if (event.newValue === JSON.stringify(state)) return;
      const incoming = sanitize(JSON.parse(event.newValue));
      if (!incoming) return;
      state = incoming;
      emit('external', { docs: state.docs.length });
    } catch (err) {
      console.warn('[SuperEditor] 其他窗口的更新无法解析', err);
    }
  });
}

export function getState() { return state; }
export function getSettings() { return state.settings; }
export function getDocs() { return state.docs; }
export function getActiveDoc() { return state.docs.find((d) => d.id === state.activeId) || state.docs[0]; }
export function getDoc(id) { return state.docs.find((d) => d.id === id); }

export function persist() {
  clearTimeout(saveTimer);
  let data = null;
  try {
    data = JSON.stringify(state);
    localStorage.setItem(KEY, data);
    lastPersistOk = true;
  } catch (err) {
    lastPersistOk = false;
    console.warn('[SuperEditor] 本地保存失败', err);
  }
  if (data && typeof window !== 'undefined' && window.desktop) {
    window.desktop.workspace.write(data).catch(() => undefined);
  }
  return lastPersistOk;
}

export function schedulePersist() {
  if (!state.settings.autoSave) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(persist, 350);
}

export function isPersistOk() { return lastPersistOk; }

export function createDoc({ title = '未命名文档', content = '', activate = true } = {}) {
  const doc = { id: uid(), title, content, createdAt: now(), updatedAt: now() };
  state.docs.unshift(doc);
  if (activate) state.activeId = doc.id;
  schedulePersist();
  emit('docs', { action: 'create', doc });
  if (activate) emit('active', doc);
  return doc;
}

export function updateContent(id, content) {
  const doc = getDoc(id);
  if (!doc || doc.content === content) return doc;
  doc.content = content;
  doc.updatedAt = now();
  schedulePersist();
  emit('content', doc);
  return doc;
}

export function renameDoc(id, title) {
  const doc = getDoc(id);
  if (!doc) return;
  doc.title = title || '未命名文档';
  doc.updatedAt = now();
  schedulePersist();
  emit('docs', { action: 'rename', doc });
}

export function deleteDoc(id) {
  const idx = state.docs.findIndex((d) => d.id === id);
  if (idx < 0) return;
  const [removed] = state.docs.splice(idx, 1);
  if (state.activeId === id) state.activeId = (state.docs[Math.min(idx, state.docs.length - 1)] || {}).id || null;
  if (!state.docs.length) {
    const doc = { id: uid(), title: '未命名文档', content: '', createdAt: now(), updatedAt: now() };
    state.docs.push(doc);
    state.activeId = doc.id;
  }
  schedulePersist();
  emit('docs', { action: 'delete', doc: removed });
  emit('active', getActiveDoc());
}

export function duplicateDoc(id) {
  const src = getDoc(id);
  if (!src) return;
  return createDoc({ title: `${src.title} 副本`, content: src.content });
}

export function setActive(id) {
  if (!getDoc(id) || state.activeId === id) return getActiveDoc();
  state.activeId = id;
  schedulePersist();
  emit('active', getActiveDoc());
  return getActiveDoc();
}

export function setSetting(key, value) {
  state.settings[key] = value;
  schedulePersist();
  emit('settings', { key, value });
}

export function setSettings(patch) {
  Object.assign(state.settings, patch);
  schedulePersist();
  emit('settings', { key: '*', value: patch });
}

export function importDocs(list) {
  const created = list.map((d) => createDoc({ title: d.title, content: d.content, activate: false }));
  if (created.length) setActive(created[0].id);
  persist();
  return created;
}

export function exportWorkspace() {
  return { app: 'SuperEditor', version: 1, exportedAt: new Date().toISOString(), docs: state.docs, settings: state.settings };
}

export function restoreWorkspace(data) {
  const parsed = sanitize({ ...data, activeId: data.docs?.[0]?.id });
  if (!parsed) throw new Error('备份文件格式不正确');
  state = { ...parsed, settings: { ...state.settings, ...parsed.settings } };
  persist();
  emit('docs', { action: 'restore' });
  emit('active', getActiveDoc());
  emit('settings', { key: '*' });
  return state.docs.length;
}

export function resetWorkspace() {
  state = freshState();
  persist();
  emit('docs', { action: 'restore' });
  emit('active', getActiveDoc());
  emit('settings', { key: '*' });
}
