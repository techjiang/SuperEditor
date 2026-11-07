import './styles/theme.css';
import './styles/base.css';
import './styles/markdown.css';
import './styles/slides.css';
import 'katex/dist/katex.min.css';

import { icon, hydrateIcons, setIcon } from './ui/icons.js';
import { toast } from './ui/toast.js';
import { confirmDialog, promptDialog } from './ui/modal.js';
import { createPalette } from './ui/palette.js';
import { openSettings, openShortcuts, openAbout, openSyncDialog } from './ui/dialogs.js';
import { createPresenter } from './ui/presenter.js';

import * as store from './core/store.js';
import { BRAND, logoSvg } from './core/brand.js';
import { createEditor, setEditorActions } from './core/editor.js';
import { renderMarkdown, enhancePreview, extractOutline } from './core/markdown.js';
import { createCommands, TOOLBAR_LAYOUT } from './core/commands.js';
import { openSearchPanel } from '@codemirror/search';

import { EXPORT_FORMATS, exportDocument } from './io/exporters.js';
import { importFile, imageToDataUrl, SUPPORTED_IMPORT } from './io/importers.js';
import * as sync from './io/sync.js';
import { downloadText, readFile, extOf } from './io/download.js';

const $ = (id) => document.getElementById(id);
const app = $('app');
const fileInput = $('file-input');

let editor;
let commands;
let palette;
let presenter;
let renderTimer = null;
let saveTimer = null;
let listTimer = null;
let contextMenu = null;
let scrollLock = false;
let menuPopup = null;
let openMenuId = null;
let installPrompt = null;

/* ---------------- 通用辅助 ---------------- */

function setSaveState(text, cls = '') {
  const el = $('save-state');
  el.textContent = text;
  el.className = `save-state ${cls}`.trim();
}

function saveNow() {
  const ok = store.persist();
  setSaveState(ok ? '已保存' : '本地空间不足', ok ? '' : 'error');
  if (!ok) toast('浏览器本地存储空间不足，建议导出备份或移除内嵌图片', 'error', 6000);
  return ok;
}

function relativeTime(ts) {
  const diff = Date.now() - ts;
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`;
  return new Date(ts).toLocaleDateString('zh-CN');
}

function countWords(text) {
  const cjk = (text.match(/[\u3400-\u9fff\u3040-\u30ff]/g) || []).length;
  const rest = text.replace(/[\u3400-\u9fff\u3040-\u30ff]/g, ' ');
  const latin = (rest.match(/[A-Za-z0-9_'-]+/g) || []).length;
  return cjk + latin;
}

function activeId() { return store.getActiveDoc()?.id; }

/* ---------------- 设置与布局 ---------------- */

function applySetting(key, value) {
  store.setSetting(key, value);
  if (key === 'mode') store.setSetting('modeChosen', true);
  applySettings();
  if (key === 'breaks') renderPreviewNow();
  if (key === 'theme') renderPreviewNow();
}

function applySettings() {
  const s = store.getSettings();
  const root = document.documentElement;
  root.dataset.theme = s.theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', s.theme === 'dark' ? '#171a1e' : '#f3f4f6');
  root.style.setProperty('--editor-font-size', `${s.fontSize}px`);
  root.style.setProperty('--editor-line-height', String(s.lineHeight));
  root.style.setProperty('--editor-font', s.fontFamily === 'sans'
    ? '"Segoe UI", "Microsoft YaHei", sans-serif'
    : 'Consolas, "Cascadia Mono", "Microsoft YaHei", monospace');
  root.style.setProperty('--preview-width', `${s.previewWidth}px`);
  root.style.setProperty('--sidebar-width', `${s.sidebarWidth}px`);

  app.dataset.mode = s.mode;
  app.dataset.sidebar = s.sidebarVisible ? 'shown' : 'hidden';
  $('outline-panel').hidden = !s.outlineVisible;
  $('pane-editor').style.flex = `${s.splitRatio} 1 0%`;
  $('pane-preview').style.flex = `${100 - s.splitRatio} 1 0%`;

  $('view-modes').querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.mode === s.mode));
  $('btn-outline').classList.toggle('active', s.outlineVisible);
  $('btn-toggle-sidebar').classList.toggle('active', s.sidebarVisible);
  setIcon($('btn-theme'), s.theme === 'dark' ? 'sun' : 'moon');
  $('btn-theme').title = s.theme === 'dark' ? '切换到浅色主题' : '切换到深色主题';
  $('stat-theme').textContent = s.theme === 'dark' ? '深色' : '浅色';
}

/* ---------------- 工具栏与菜单 ---------------- */

function renderToolbar() {
  const groups = TOOLBAR_LAYOUT.map((group) => group.map((id) => {
    const c = commands[id];
    return `<button class="tool-btn" data-cmd="${id}" data-icon="${c.icon}" title="${c.title.replace(/"/g, '&quot;')}"></button>`;
  }).join('')).join('<span class="tool-sep"></span>');
  $('toolbar').innerHTML = groups;
  hydrateIcons($('toolbar'));
}

function renderExportMenu() {
  const item = (id, label, desc, iconName, badge) => `
    <button class="dropdown-item" data-format="${id}">
      <span class="dd-ico">${icon(iconName, 17)}</span>
      <span class="dd-text"><strong>${label}</strong><small>${desc}</small></span>
      ${badge ? `<kbd>${badge}</kbd>` : ''}
    </button>`;
  $('export-menu').innerHTML = `
    <div class="dropdown-title">导出为</div>
    ${EXPORT_FORMATS.map((f) => item(f.id, f.label, f.desc, f.icon, f.ext.toUpperCase())).join('')}
    <div class="dropdown-sep"></div>
    ${item('print', '打印 / 另存为 PDF', '使用浏览器打印，排版更清晰', 'printer', '')}
    ${item('backup', '备份整个工作区', '导出全部文档为 JSON', 'archive', 'JSON')}`;
}

function closeExportMenu() { $('export-menu').hidden = true; }
function toggleExportMenu() { $('export-menu').hidden = !$('export-menu').hidden; }

/* ---------------- 菜单栏 ---------------- */

const SEP = { sep: true };
let MENUS = [];

function buildMenus() {
  const run = (id) => () => commands[id]?.run();
  MENUS = [
    { id: 'file', label: '文件', items: [
      { label: '新建文档', icon: 'file-plus', key: 'Ctrl+Alt+N', run: newDoc },
      SEP,
      { label: '导入文件…', icon: 'upload', run: openImport },
      { label: '导出为…', icon: 'download', run: toggleExportMenu },
      SEP,
      { label: '保存', icon: 'save', key: 'Ctrl+S', run: () => { saveNow(); toast('已保存', 'success', 1500); } },
      { label: '备份工作区', icon: 'archive', run: backupWorkspace },
      { label: '从备份恢复…', icon: 'rotate-ccw', run: () => { openRestore(); } },
      SEP,
      { label: '同步设置…', icon: 'folder-open', run: openSyncPanel },
      ...(window.desktop ? [{
        label: '打开数据文件位置', icon: 'folder', run: async () => {
          const info = await window.desktop.info();
          window.desktop.shell.showItem(info.dataPath);
        },
      }] : [{ label: '安装为应用…', icon: 'monitor', run: installApp }]),
    ] },
    { id: 'edit', label: '编辑', items: [
      { label: '撤销', icon: 'undo', key: 'Ctrl+Z', run: run('undo') },
      { label: '重做', icon: 'redo', key: 'Ctrl+Y', run: run('redo') },
      SEP,
      { label: '粗体', icon: 'bold', key: 'Ctrl+B', run: run('bold') },
      { label: '斜体', icon: 'italic', key: 'Ctrl+I', run: run('italic') },
      { label: '删除线', icon: 'strikethrough', key: 'Ctrl+Shift+X', run: run('strike') },
      { label: '行内代码', icon: 'code', key: 'Ctrl+Shift+C', run: run('code') },
      SEP,
      { label: '查找与替换', icon: 'search', key: 'Ctrl+F', run: () => { editor.focus(); openSearchPanel(editor.view); } },
      { label: '命令面板', icon: 'sparkles', key: 'Ctrl+K', run: () => palette.show() },
    ] },
    { id: 'view', label: '视图', items: [
      { label: '仅编辑', icon: 'pencil', run: () => applySetting('mode', 'edit') },
      { label: '编辑 + 预览', icon: 'columns', run: () => applySetting('mode', 'split') },
      { label: '仅预览', icon: 'eye', run: () => applySetting('mode', 'preview') },
      SEP,
      { label: '文档侧栏', icon: 'panel-left', key: 'Ctrl+Shift+B', run: () => applySetting('sidebarVisible', !store.getSettings().sidebarVisible) },
      { label: '文档大纲', icon: 'list-tree', run: () => applySetting('outlineVisible', !store.getSettings().outlineVisible) },
      SEP,
      { label: '切换浅色 / 深色', icon: 'sun', run: () => applySetting('theme', store.getSettings().theme === 'dark' ? 'light' : 'dark') },
    ] },
    { id: 'insert', label: '插入', items: [
      { label: '表格', icon: 'table', run: run('table') },
      { label: '图片…', icon: 'image', run: run('image') },
      { label: '链接', icon: 'link', key: 'Ctrl+Shift+K', run: run('link') },
      { label: '代码块', icon: 'code-block', run: run('codeblock') },
      SEP,
      { label: '数学公式', icon: 'sigma', run: run('math') },
      { label: '流程图 / 图表', icon: 'git-branch', run: run('mermaid') },
      { label: '分隔线', icon: 'minus', run: run('hr') },
      { label: '幻灯片分页符', icon: 'presentation', run: run('slide-break') },
    ] },
    { id: 'tools', label: '工具', items: [
      { label: '开始演示', icon: 'presentation', key: 'F5', run: () => presenter.open() },
      { label: '打印 / 另存为 PDF', icon: 'printer', run: () => doExport('print') },
      SEP,
      { label: '立即写入同步文件夹', icon: 'hard-drive', run: syncNow },
      { label: '同步设置…', icon: 'folder-open', run: openSyncPanel },
      SEP,
      { label: '设置', icon: 'settings', run: openSettingsPanel },
    ] },
    { id: 'help', label: '帮助', items: [
      { label: '键盘快捷键', icon: 'keyboard', run: openShortcuts },
      SEP,
      { label: `关于 ${BRAND.name}`, icon: 'info', run: openAbout },
    ] },
  ];
}

function renderMenubar() {
  $('menu-items').innerHTML = MENUS.map((m) => `<button class="menu-top" data-menu="${m.id}">${m.label}</button>`).join('');
  $('menu-items').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-menu]');
    if (!btn) return;
    if (openMenuId === btn.dataset.menu) closeMenu();
    else showMenu(btn.dataset.menu, btn);
  });
  $('menu-items').addEventListener('mouseover', (e) => {
    if (!openMenuId) return;
    const btn = e.target.closest('[data-menu]');
    if (btn && btn.dataset.menu !== openMenuId) showMenu(btn.dataset.menu, btn);
  });
}

function showMenu(id, anchor) {
  closeMenu();
  const menu = MENUS.find((m) => m.id === id);
  if (!menu) return;
  openMenuId = id;
  anchor.classList.add('open');
  const popup = document.createElement('div');
  popup.className = 'menu-popup';
  popup.innerHTML = menu.items.map((it, i) => (it.sep
    ? '<div class="menu-sep-h"></div>'
    : `<button class="menu-item" data-index="${i}">${icon(it.icon || 'file-text', 14)}<span class="menu-label"></span><span class="menu-key">${it.key || ''}</span></button>`)).join('');
  popup.querySelectorAll('.menu-item').forEach((el) => {
    const it = menu.items[Number(el.dataset.index)];
    el.querySelector('.menu-label').textContent = it.label;
    el.addEventListener('click', () => { closeMenu(); setTimeout(() => it.run?.(), 10); });
  });
  document.body.appendChild(popup);
  const rect = anchor.getBoundingClientRect();
  popup.style.left = `${Math.max(4, Math.min(rect.left, window.innerWidth - popup.offsetWidth - 8))}px`;
  popup.style.top = `${rect.bottom}px`;
  menuPopup = popup;
}

function closeMenu() {
  if (menuPopup) { menuPopup.remove(); menuPopup = null; }
  $('menu-items').querySelectorAll('.menu-top.open').forEach((el) => el.classList.remove('open'));
  openMenuId = null;
}

/* ---------------- 同步与安装 ---------------- */

function renderSyncStatus(s) {
  const labels = {
    local: '仅本地', connected: '已连接', syncing: '同步中', synced: '已同步',
    paused: '待授权', error: '同步异常', unsupported: '不支持文件夹同步',
  };
  const base = labels[s.status] || s.status;
  const text = s.folderName && !['local', 'unsupported'].includes(s.status) ? `${base} · ${s.folderName}` : base;
  $('sync-state').textContent = text;
  $('btn-sync').dataset.state = s.status;
  $('btn-sync').title = s.error ? `同步异常：${s.error}` : `同步设置（${text}）`;
  $('stat-sync').textContent = text;
}

async function syncNow() {
  if (!sync.getSyncStatus().folderName) { toast('尚未连接同步文件夹', 'warn'); return; }
  try {
    const count = await sync.pushAll(store.getDocs());
    toast(`已写入 ${count} 个 .md 文件`, 'success');
  } catch (err) {
    toast(`同步失败：${err?.message || '未知错误'}`, 'error', 5000);
  }
}

function openSyncPanel() {
  openSyncDialog({
    getStatus: sync.getSyncStatus,
    onConnect: async () => {
      const name = await sync.connectFolder();
      toast(`已连接文件夹「${name}」`, 'success');
      const count = await sync.pushAll(store.getDocs());
      toast(`已写入 ${count} 个 .md 文件`, 'success');
    },
    onReconnect: async () => {
      await sync.reconnectFolder();
      toast('文件夹权限已恢复', 'success');
    },
    onDisconnect: async () => {
      await sync.disconnectFolder();
      toast('已断开文件夹同步', 'success');
    },
    onPush: syncNow,
    onPull: async () => {
      const list = await sync.pullAll();
      if (!list.length) { toast('文件夹中没有 .md 文件', 'warn'); return; }
      const ok = await confirmDialog('从文件夹读取', `将导入 ${list.length} 个 .md 文件作为新文档，继续吗？`, { okLabel: '导入' });
      if (!ok) return;
      store.persist();
      store.importDocs(list.map(({ title, content }) => ({ title, content })));
      refreshAll();
      pushWorkspace();
      toast(`已导入 ${list.length} 个文档`, 'success');
    },
    onError: (message) => toast(message, 'error', 5000),
  });
}

function installApp() {
  if (window.desktop) {
    toast('当前已是独立桌面应用，无需安装', 'info');
    return;
  }
  if (installPrompt) {
    installPrompt.prompt();
    installPrompt.userChoice?.then(() => { installPrompt = null; });
  } else if (window.matchMedia?.('(display-mode: standalone)').matches) {
    toast('当前已作为独立应用运行', 'info');
  } else {
    toast('请使用浏览器菜单中的「安装应用 / 创建快捷方式」', 'info', 4200);
  }
}

/* ---------------- 文档列表 ---------------- */

function renderDocList() {
  const docs = store.getDocs();
  const active = activeId();
  const q = $('doc-search').value.trim().toLowerCase();
  const shown = q ? docs.filter((d) => `${d.title} ${d.content}`.toLowerCase().includes(q)) : docs;
  const list = $('doc-list');
  if (!shown.length) {
    list.innerHTML = `<div class="doc-empty">${q ? '没有匹配的文档' : '还没有文档<br>点击上方 + 新建'}</div>`;
    return;
  }
  list.innerHTML = shown.map((d) => `
    <div class="doc-item ${d.id === active ? 'active' : ''}" data-id="${d.id}">
      <span class="doc-ico">${icon('file-text', 15)}</span>
      <span class="doc-name"></span>
      <button class="doc-more" data-icon="more-horizontal" title="更多操作"></button>
    </div>`).join('');
  list.querySelectorAll('.doc-item').forEach((el) => {
    const d = store.getDoc(el.dataset.id);
    el.querySelector('.doc-name').textContent = d.title;
    el.title = `${d.title}\n${countWords(d.content)} 词 · ${relativeTime(d.updatedAt)}`;
  });
  hydrateIcons(list);
}

function scheduleListRefresh() {
  clearTimeout(listTimer);
  listTimer = setTimeout(renderDocList, 450);
}

function closeContextMenu() {
  if (contextMenu) { contextMenu.remove(); contextMenu = null; }
}

function showDocMenu(id, x, y) {
  closeContextMenu();
  const menu = document.createElement('div');
  menu.className = 'context-menu';
  menu.innerHTML = `
    <button data-act="rename">${icon('pencil', 15)} 重命名</button>
    <button data-act="duplicate">${icon('copy', 15)} 创建副本</button>
    <button data-act="export">${icon('download', 15)} 导出此文档</button>
    <button data-act="delete" class="danger">${icon('trash', 15)} 删除</button>`;
  document.body.appendChild(menu);
  const rect = menu.getBoundingClientRect();
  menu.style.left = `${Math.min(x, window.innerWidth - rect.width - 10)}px`;
  menu.style.top = `${Math.min(y, window.innerHeight - rect.height - 10)}px`;
  contextMenu = menu;
  menu.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;
    closeContextMenu();
    if (act === 'rename') {
      const d = store.getDoc(id);
      const name = await promptDialog('重命名文档', '新标题', d.title);
      if (name) { store.renameDoc(id, name); refreshAll(); toast('已重命名', 'success'); }
    } else if (act === 'duplicate') {
      store.duplicateDoc(id); refreshAll(); toast('已创建副本', 'success');
    } else if (act === 'export') {
      switchDoc(id); toggleExportMenu();
    } else if (act === 'delete') {
      await deleteDoc(id);
    }
  });
}

/* ---------------- 预览与大纲 ---------------- */

function renderPreviewNow() {
  const s = store.getSettings();
  const source = store.getActiveDoc()?.content || '';
  const preview = $('preview');
  preview.innerHTML = renderMarkdown(source, { breaks: s.breaks });
  buildOutline();
  enhancePreview(preview, { theme: s.theme });
}

function scheduleRender() {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(renderPreviewNow, 150);
}

function buildOutline() {
  const items = extractOutline($('preview'));
  const nav = $('outline-list');
  if (!items.length) {
    nav.innerHTML = '<div class="outline-empty">文档中使用 # 标题后，<br>这里会自动生成目录。</div>';
  } else {
    nav.innerHTML = items.map((it, i) => `<button class="outline-item ${i === 0 ? 'active' : ''}" data-level="${it.level}" data-target="${it.id}"></button>`).join('');
    nav.querySelectorAll('.outline-item').forEach((el, i) => { el.textContent = items[i].text; });
  }
  $('preview-hint').textContent = `${items.length} 个标题 · ${parseSlidesCount(sourceOf())} 页幻灯片`;
}

function sourceOf() { return store.getActiveDoc()?.content || ''; }

function parseSlidesCount(src) {
  return String(src).split(/\n\s*-{3,}\s*\n/).length;
}

function updateStatus() {
  const text = editor.getValue();
  const info = editor.cursorInfo();
  $('stat-word').textContent = `${countWords(text)} 词`;
  $('stat-char').textContent = `${text.length} 字符`;
  $('stat-line').textContent = `${info.totalLines} 行`;
  $('stat-pos').textContent = `Ln ${info.line}, Col ${info.col}${info.selected ? ` · 选中 ${info.selected}` : ''}`;
}

function refreshAll() {
  const doc = store.getActiveDoc();
  $('doc-title').value = doc.title;
  editor.setValue(doc.content);
  renderDocList();
  renderPreviewNow();
  updateStatus();
  setSaveState('已保存');
  window.desktop?.window.setTitle(doc.title);
}

function switchDoc(id) {
  if (!store.getDoc(id) || id === activeId()) return;
  store.persist();
  store.setActive(id);
  refreshAll();
}

/* ---------------- 文档操作 ---------------- */

function pushWorkspace() {
  if (!sync.getSyncStatus().folderName) return;
  sync.pushAll(store.getDocs()).catch((err) => toast(`同步失败：${err?.message || '未知错误'}`, 'error', 4000));
}

function newDoc() {
  store.persist();
  store.createDoc({ title: '未命名文档', content: '' });
  refreshAll();
  pushWorkspace();
  $('doc-title').focus();
  $('doc-title').select();
  toast('已新建文档', 'success');
}

async function deleteDoc(id) {
  const d = store.getDoc(id);
  if (!d) return;
  const ok = await confirmDialog('删除文档', `确定删除「${d.title}」吗？此操作无法撤销。`, { danger: true, okLabel: '删除' });
  if (!ok) return;
  store.deleteDoc(id);
  refreshAll();
  pushWorkspace();
  toast('文档已删除', 'success');
}

/* ---------------- 导入 / 导出 ---------------- */

function nativeToFile(item) {
  const binary = atob(item.base64 || '');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const types = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
    md: 'text/markdown', txt: 'text/plain', html: 'text/html', json: 'application/json',
  };
  return new File([bytes], item.name, { type: types[item.ext] || 'application/octet-stream' });
}

async function openDesktopFiles(purpose, presetItems = null) {
  try {
    const items = presetItems || await window.desktop.openFiles();
    if (!items?.length) return;
    fileInput.dataset.purpose = purpose;
    await handleFiles(items.map(nativeToFile), purpose);
    if (purpose === 'import') items.forEach((i) => window.desktop.recent.add(i.path));
  } catch (err) {
    toast(`打开失败：${err?.message || '未知错误'}`, 'error', 5000);
  }
}

function openImport() {
  if (window.desktop) { openDesktopFiles('import'); return; }
  fileInput.dataset.purpose = 'import';
  fileInput.accept = SUPPORTED_IMPORT;
  fileInput.multiple = true;
  fileInput.value = '';
  fileInput.click();
}

function openImagePicker() {
  if (window.desktop) { openDesktopFiles('image'); return; }
  fileInput.dataset.purpose = 'image';
  fileInput.accept = 'image/*';
  fileInput.multiple = true;
  fileInput.value = '';
  fileInput.click();
}

function openRestore() {
  if (window.desktop) {
    window.desktop.openFiles().then(async (items) => {
      const backup = items?.find((item) => item.ext === 'json');
      if (!backup) { toast('请选择 JSON 备份文件', 'warn'); return; }
      try { await restoreFromFile(nativeToFile(backup)); }
      catch (err) { toast(`恢复失败：${err?.message || '文件格式错误'}`, 'error', 5000); }
    }).catch((err) => toast(`打开失败：${err?.message || '未知错误'}`, 'error', 5000));
    return;
  }
  $('backup-input').value = '';
  $('backup-input').click();
}

async function restoreFromFile(file) {
  const data = JSON.parse(await readFile(file));
  const count = store.restoreWorkspace(data);
  applySettings();
  refreshAll();
  pushWorkspace();
  toast(`已恢复 ${count} 个文档`, 'success');
}

async function handleFiles(files, purpose = null) {
  const list = [...files];
  if (!list.length) return;
  if ((purpose || fileInput.dataset.purpose) === 'image') {
    let n = 0;
    for (const f of list) {
      if (!f.type.startsWith('image/')) continue;
      const url = await imageToDataUrl(f);
      editor.insertImage(url, f.name.replace(/\.[^.]+$/, ''));
      n++;
    }
    if (n) toast(`已插入 ${n} 张图片（以 Base64 内嵌）`, 'success');
    return;
  }
  const imported = [];
  for (const file of list) {
    try {
      if (extOf(file.name) === 'json') { await restoreFromFile(file); continue; }
      const { title, content } = await importFile(file);
      imported.push({ title, content });
    } catch (err) {
      console.warn('[SuperEditor] 已跳过该文件', file.name, err?.message || err);
      toast(`${file.name}：${err?.message || '导入失败'}`, 'error', 5500);
    }
  }
  if (imported.length) {
    store.persist();
    store.importDocs(imported);
    refreshAll();
    pushWorkspace();
    toast(`已导入 ${imported.length} 个文档`, 'success');
  }
  fileInput.value = '';
}

function exportContext() {
  return {
    title: store.getActiveDoc().title,
    source: store.getActiveDoc().content,
    previewEl: $('preview'),
    settings: store.getSettings(),
    toast,
  };
}

function doExport(format) {
  closeExportMenu();
  if (format === 'backup') return backupWorkspace();
  clearTimeout(renderTimer);
  renderPreviewNow();
  exportDocument(format, exportContext()).catch(() => {});
}

function backupWorkspace() {
  const date = new Date().toISOString().slice(0, 10);
  downloadText(JSON.stringify(store.exportWorkspace(), null, 2), `SuperEditor-备份-${date}.json`, 'application/json;charset=utf-8');
  toast('工作区备份已下载', 'success');
}

/* ---------------- 命令面板 ---------------- */

function paletteItems() {
  const items = [
    { group: '快捷操作', label: '新建文档', desc: '空白 Markdown 文档', icon: 'file-plus', shortcut: 'Ctrl+Alt+N', run: newDoc },
    { group: '快捷操作', label: '导入文件', desc: 'MD / HTML / DOCX / PDF / PPTX', icon: 'upload', run: openImport },
    { group: '快捷操作', label: '开始演示', desc: '按 --- 分页放映', icon: 'presentation', shortcut: 'F5', run: () => presenter.open() },
    { group: '快捷操作', label: '切换主题', desc: '浅色 / 深色', icon: 'sun', run: () => applySetting('theme', store.getSettings().theme === 'dark' ? 'light' : 'dark') },
    { group: '快捷操作', label: '同步设置', desc: '连接本地文件夹', icon: 'folder-open', run: openSyncPanel },
    { group: '快捷操作', label: '立即写入同步文件夹', desc: '把全部文档写成 .md', icon: 'hard-drive', run: syncNow },
    { group: '快捷操作', label: '安装为应用', desc: '独立窗口运行', icon: 'monitor', run: installApp },
    { group: '快捷操作', label: '设置', desc: '字体、字号、行为', icon: 'settings', run: openSettingsPanel },
    { group: '快捷操作', label: '备份工作区', desc: '导出全部文档为 JSON', icon: 'archive', run: backupWorkspace },
    { group: '快捷操作', label: '键盘快捷键', desc: '查看全部快捷键', icon: 'keyboard', run: openShortcuts },
    { group: '视图', label: '仅编辑（默认）', desc: '只显示源文件', icon: 'pencil', run: () => applySetting('mode', 'edit') },
    { group: '视图', label: '编辑 + 预览', desc: '编辑与预览并排', icon: 'columns', run: () => applySetting('mode', 'split') },
    { group: '视图', label: '仅预览', desc: '只显示排版结果', icon: 'eye', run: () => applySetting('mode', 'preview') },
    { group: '视图', label: '显示 / 隐藏文档大纲', desc: '右侧标题目录', icon: 'list-tree', run: () => applySetting('outlineVisible', !store.getSettings().outlineVisible) },
  ];
  EXPORT_FORMATS.forEach((f) => items.push({
    group: '导出', label: `导出为 ${f.label}`, desc: f.desc, icon: f.icon, keywords: f.ext,
    run: () => doExport(f.id),
  }));
  items.push({ group: '导出', label: '打印 / 另存为 PDF', desc: '使用浏览器打印', icon: 'printer', run: () => doExport('print') });
  Object.entries(commands).forEach(([, c]) => items.push({
    group: '编辑命令', label: c.label, desc: c.title, icon: c.icon, shortcut: c.shortcut, run: c.run,
  }));
  store.getDocs().forEach((d) => items.push({
    group: '切换文档', label: d.title, desc: `${countWords(d.content)} 词 · ${relativeTime(d.updatedAt)}`, icon: 'file-text',
    keywords: 'doc 文档', run: () => switchDoc(d.id),
  }));
  return items;
}

function openSettingsPanel() {
  openSettings({
    getSettings: store.getSettings,
    setSetting: applySetting,
    onReset: () => {
      store.resetWorkspace();
      applySettings();
      refreshAll();
      pushWorkspace();
      toast('工作区已重置', 'success');
    },
  });
}

/* ---------------- 事件绑定 ---------------- */

function bindEvents() {
  $('view-modes').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-mode]');
    if (btn) applySetting('mode', btn.dataset.mode);
  });

  $('btn-theme').addEventListener('click', () => applySetting('theme', store.getSettings().theme === 'dark' ? 'light' : 'dark'));
  $('btn-settings').addEventListener('click', openSettingsPanel);
  $('btn-sync').addEventListener('click', openSyncPanel);
  $('btn-outline').addEventListener('click', () => applySetting('outlineVisible', !store.getSettings().outlineVisible));
  $('btn-close-outline').addEventListener('click', () => applySetting('outlineVisible', false));
  $('btn-toggle-sidebar').addEventListener('click', () => applySetting('sidebarVisible', !store.getSettings().sidebarVisible));
  $('btn-present').addEventListener('click', () => presenter.open());

  $('btn-export').addEventListener('click', (e) => { e.stopPropagation(); toggleExportMenu(); });
  $('export-menu').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-format]');
    if (btn) doExport(btn.dataset.format);
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.dropdown-anchor')) closeExportMenu();
    if (!e.target.closest('.context-menu') && !e.target.closest('.doc-more')) closeContextMenu();
    if (!e.target.closest('.menu-popup') && !e.target.closest('#menu-items')) closeMenu();
  });

  $('toolbar').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-cmd]');
    if (btn) commands[btn.dataset.cmd]?.run();
  });

  $('btn-new').addEventListener('click', newDoc);
  $('btn-import').addEventListener('click', openImport);
  $('btn-backup').addEventListener('click', backupWorkspace);
  $('btn-restore').addEventListener('click', () => { openRestore(); });
  $('doc-search').addEventListener('input', renderDocList);

  $('doc-title').addEventListener('change', (e) => {
    const title = e.target.value.trim() || '未命名文档';
    e.target.value = title;
    store.renameDoc(activeId(), title);
    renderDocList();
    scheduleListRefresh();
    sync.schedulePush(store.getActiveDoc());
  });

  $('doc-list').addEventListener('click', (e) => {
    const item = e.target.closest('.doc-item');
    if (!item) return;
    const id = item.dataset.id;
    if (e.target.closest('.doc-more')) {
      const rect = e.target.closest('.doc-more').getBoundingClientRect();
      showDocMenu(id, rect.left, rect.bottom + 4);
      return;
    }
    switchDoc(id);
  });

  $('outline-list').addEventListener('click', (e) => {
    const btn = e.target.closest('.outline-item');
    if (!btn) return;
    const target = $('preview').querySelector(`#${CSS.escape(btn.dataset.target)}`);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      $('outline-list').querySelectorAll('.outline-item').forEach((el) => el.classList.toggle('active', el === btn));
    }
  });

  $('preview').addEventListener('click', async (e) => {
    const copy = e.target.closest('.code-copy');
    if (copy) {
      const code = copy.closest('.code-block')?.querySelector('pre code')?.textContent || '';
      try {
        await navigator.clipboard.writeText(code);
        copy.textContent = '已复制';
        setTimeout(() => { copy.textContent = '复制'; }, 1400);
      } catch { toast('复制失败，请手动选择代码', 'warn'); }
      return;
    }
    const img = e.target.closest('img.md-image');
    if (img) {
      $('lightbox-img').src = img.src;
      $('lightbox').hidden = false;
      return;
    }
    const anchor = e.target.closest('a[href^="#"]');
    if (anchor) {
      e.preventDefault();
      const id = anchor.getAttribute('href').slice(1);
      const target = $('preview').querySelector(`#${CSS.escape(id)}`);
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  $('lightbox').addEventListener('click', () => { $('lightbox').hidden = true; });

  fileInput.addEventListener('change', (e) => handleFiles(e.target.files));
  $('backup-input').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try { await restoreFromFile(file); }
    catch (err) { toast(`恢复失败：${err?.message || '文件格式错误'}`, 'error', 5000); }
  });

  // 分屏 / 侧栏拖拽
  $('sidebar-splitter').addEventListener('mousedown', (e) => startDrag(e, 'sidebar'));
  $('pane-splitter').addEventListener('mousedown', (e) => startDrag(e, 'pane'));

  document.addEventListener('keydown', onGlobalKey);
  window.addEventListener('beforeunload', () => store.persist());
  document.addEventListener('visibilitychange', () => { if (document.hidden) store.persist(); });
}

function startDrag(e, kind) {
  e.preventDefault();
  const splitter = e.currentTarget;
  delete splitter.dataset.width;
  delete splitter.dataset.ratio;
  splitter.classList.add('dragging');
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';
  const move = (ev) => {
    if (kind === 'sidebar') {
      const width = Math.max(180, Math.min(420, ev.clientX));
      document.documentElement.style.setProperty('--sidebar-width', `${width}px`);
      splitter.dataset.width = width;
    } else {
      const rect = $('main').getBoundingClientRect();
      const ratio = Math.max(20, Math.min(80, Math.round(((ev.clientX - rect.left) / rect.width) * 100)));
      $('pane-editor').style.flex = `${ratio} 1 0%`;
      $('pane-preview').style.flex = `${100 - ratio} 1 0%`;
      splitter.dataset.ratio = ratio;
    }
  };
  const up = () => {
    document.removeEventListener('mousemove', move);
    document.removeEventListener('mouseup', up);
    splitter.classList.remove('dragging');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    if (splitter.dataset.width) applySetting('sidebarWidth', Number(splitter.dataset.width));
    if (splitter.dataset.ratio) applySetting('splitRatio', Number(splitter.dataset.ratio));
  };
  document.addEventListener('mousemove', move);
  document.addEventListener('mouseup', up);
}

function onGlobalKey(e) {
  if (e.defaultPrevented) return;
  if (e.key === 'Escape') {
    if (!$('lightbox').hidden) { $('lightbox').hidden = true; return; }
    closeExportMenu();
    closeContextMenu();
    closeMenu();
    return;
  }
  if (palette.isOpen()) return;
  const mod = e.ctrlKey || e.metaKey;
  const key = e.key.toLowerCase();
  if (mod && key === 'k') { e.preventDefault(); palette.show(); }
  else if (mod && key === 's') { e.preventDefault(); saveNow(); toast('已保存到本地', 'success', 1600); }
  else if (mod && e.altKey && key === 'n') { e.preventDefault(); newDoc(); }
  else if (mod && e.shiftKey && key === 'b') { e.preventDefault(); applySetting('sidebarVisible', !store.getSettings().sidebarVisible); }
  else if (mod && e.shiftKey && key === 'p') {
    e.preventDefault();
    const modes = ['edit', 'split', 'preview'];
    applySetting('mode', modes[(modes.indexOf(store.getSettings().mode) + 1) % modes.length]);
  } else if (mod && e.shiftKey && key === 'e') { e.preventDefault(); toggleExportMenu(); }
  else if (e.key === 'F5') { e.preventDefault(); if (!presenter.isActive()) presenter.open(); }
  else if (e.altKey && ['1', '2', '3'].includes(e.key)) {
    e.preventDefault();
    applySetting('mode', { 1: 'edit', 2: 'split', 3: 'preview' }[e.key]);
  }
}

/* ---------------- 启动 ---------------- */

function boot() {
  $('logo-slot').innerHTML = logoSvg({ size: 18 });
  hydrateIcons(document);
  applySettings();

  if (window.desktop) {
    document.body.classList.add('is-desktop');
    $('window-controls').hidden = false;
    $('win-minimize').addEventListener('click', () => window.desktop.window.minimize());
    $('win-maximize').addEventListener('click', () => window.desktop.window.toggleMaximize());
    $('win-close').addEventListener('click', () => window.desktop.window.close());
    window.desktop.window.onMaximizeChange((maximized) => {
      document.body.classList.toggle('is-maximized', maximized);
    });
    document.querySelector('.titlebar').addEventListener('dblclick', (e) => {
      if (e.target.closest('button') || e.target.closest('input')) return;
      window.desktop.window.toggleMaximize();
    });
    window.desktop.info().then((info) => { document.title = `SuperEditor ${info.version}`; }).catch(() => undefined);
    window.desktop.openFile((item) => openDesktopFiles('import', [item]));
    window.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    });
    window.addEventListener('drop', async (e) => {
      e.preventDefault();
      const dt = e.dataTransfer;
      if (!dt || !dt.files || !dt.files.length) return;
      const items = [];
      for (const f of dt.files) {
        if (!f.path) continue;
        try {
          const base64 = await window.desktop.fs.readBase64(f.path);
          items.push({ name: f.name, ext: (f.name.split('.').pop() || '').toLowerCase(), base64, path: f.path });
        } catch { /* 跳过不可读文件 */ }
      }
      if (items.length) openDesktopFiles('import', items);
    });
  }

  const initial = store.getActiveDoc()?.content || '';
  editor = createEditor({
    parent: $('editor'),
    initial,
    onChange(text) {
      store.updateContent(activeId(), text);
      setSaveState('保存中…', 'saving');
      clearTimeout(saveTimer);
      saveTimer = setTimeout(saveNow, 700);
      scheduleRender();
      scheduleListRefresh();
      updateStatus();
      sync.schedulePush(store.getActiveDoc());
    },
    onCursor: updateStatus,
    onScroll(scroller) {
      if (!store.getSettings().syncScroll || scrollLock || store.getSettings().mode !== 'split') return;
      const max = scroller.scrollHeight - scroller.clientHeight;
      const ratio = max > 0 ? scroller.scrollTop / max : 0;
      const target = $('preview-scroll');
      const tmax = target.scrollHeight - target.clientHeight;
      scrollLock = true;
      target.scrollTop = ratio * tmax;
      requestAnimationFrame(() => { scrollLock = false; });
    },
    onPasteFiles(files) {
      handleFiles(files, 'image');
    },
  });

  const ctx = {
    save: saveNow,
    openPalette: () => palette.show(),
    openImagePicker,
  };
  commands = createCommands(editor, ctx);
  setEditorActions(Object.fromEntries(Object.entries(commands).map(([id, c]) => [id, c.run])));

  buildMenus();
  renderMenubar();
  renderToolbar();
  renderExportMenu();

  palette = createPalette({ getItems: paletteItems });
  presenter = createPresenter({
    getSource: sourceOf,
    getTheme: () => store.getSettings().theme,
    onToast: toast,
  });

  sync.onSyncStatus(renderSyncStatus);
  sync.initSync();
  if (window.desktop) {
    window.desktop.workspace.read().then((text) => {
      if (!text || localStorage.getItem('supereditor.workspace.v1')) return;
      try { store.restoreWorkspace(JSON.parse(text)); refreshAll(); }
      catch (err) { console.warn('[SuperEditor] 数据文件恢复失败', err); }
    }).catch(() => undefined);
  }
  store.subscribe((type) => {
    if (type !== 'external') return;
    refreshAll();
    toast('已应用其他窗口的修改', 'info', 1800);
  });

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installPrompt = e;
  });
  if ('serviceWorker' in navigator && import.meta.env.PROD && !window.desktop) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => undefined);
    });
  }

  bindEvents();
  refreshAll();
  editor.focus();
  console.info('[SuperEditor] 就绪 · 文档数：', store.getDocs().length);
}

boot();
