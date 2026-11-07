import { showDialog, confirmDialog } from './modal.js';
import { icon } from './icons.js';
import { BRAND, AUTHOR, logoSvg } from '../core/brand.js';

const SHORTCUTS = [
  ['命令面板', 'Ctrl + K'], ['保存', 'Ctrl + S'], ['新建文档', 'Ctrl + Alt + N'],
  ['切换侧栏', 'Ctrl + Shift + B'], ['切换视图模式', 'Ctrl + Shift + P'], ['开始演示', 'F5'],
  ['粗体', 'Ctrl + B'], ['斜体', 'Ctrl + I'], ['删除线', 'Ctrl + Shift + X'],
  ['行内代码', 'Ctrl + Shift + C'], ['插入链接', 'Ctrl + Shift + K'], ['无序列表', 'Ctrl + Shift + 8'],
  ['有序列表', 'Ctrl + Shift + 7'], ['块引用', 'Ctrl + Shift + 9'], ['一级 / 二级 / 三级标题', 'Ctrl + Alt + 1/2/3'],
  ['编辑器内查找', 'Ctrl + F'], ['编辑器内替换', 'Ctrl + H'], ['撤销 / 重做', 'Ctrl + Z / Ctrl + Y'],
  ['演示：翻页', '← → / 空格'], ['演示：全屏 / 黑屏 / 退出', 'F / B / Esc'],
];

export function openShortcuts() {
  return showDialog({
    title: '键盘快捷键', icon: 'keyboard', width: 520,
    html: `<div class="shortcut-grid">${SHORTCUTS.map(([name, key]) => `<div><span>${name}</span><kbd>${key}</kbd></div>`).join('')}</div>`,
    actions: [{ label: '关闭', value: true, primary: true }],
  });
}

export function openAbout() {
  const links = [
    ['官网', AUTHOR.site],
    ['技术文档', AUTHOR.docs],
    ['GitHub', AUTHOR.github],
    ['哔哩哔哩', AUTHOR.bilibili],
    ['玲珑论坛', AUTHOR.forum],
    ['邮箱', `mailto:${AUTHOR.email}`],
  ];
  return showDialog({
    title: `关于 ${BRAND.name}`, icon: 'info', width: 460,
    html: `<div class="about-hero">
      ${logoSvg({ size: 38 })}
      <div><strong>${BRAND.name} ${BRAND.version}</strong><span>${AUTHOR.slogan}<br />本地优先的 Markdown 文档编辑器</span></div>
    </div>
    <div class="about-author">
      <div class="about-author-head"><strong>${AUTHOR.name}</strong><span>作者 · 出品</span></div>
      <div class="about-links">${links.map(([label, href]) => `<a href="${href}" target="_blank" rel="noopener noreferrer">${label}</a>`).join('')}</div>
      <div class="about-qq">QQ 群 ${AUTHOR.qqGroups.join(' / ')}</div>
    </div>
    <div class="shortcut-grid" style="grid-template-columns:1fr">
      <div><span>版本</span><kbd>${BRAND.version}</kbd></div>
      <div><span>运行方式</span><kbd>${window.desktop ? 'Windows 桌面应用' : '浏览器 / 可安装 PWA'}</kbd></div>
      <div><span>数据存储</span><kbd>本机文件 + 可选文件夹同步</kbd></div>
      <div><span>编辑器内核</span><kbd>CodeMirror 6</kbd></div>
      <div><span>渲染引擎</span><kbd>Marked + KaTeX + Mermaid</kbd></div>
      <div><span>许可</span><kbd>MIT · ${AUTHOR.copyright}</kbd></div>
    </div>`,
    actions: [{ label: '关闭', value: true, primary: true }],
  });
}

export function openSyncDialog({ getStatus, onConnect, onDisconnect, onPush, onPull, onReconnect, onError }) {
  const native = !!getStatus().native;
  return showDialog({
    title: '同步', icon: 'folder-open', width: 480,
    html: `<div class="sync-box">
        <p>把工作区绑定到本地文件夹后，每篇文档会保存为独立的 <code>.md</code> 文件；同一浏览器的多个窗口会自动同步。数据不经任何服务器。</p>
        <div class="shortcut-grid" style="grid-template-columns:1fr">
          <div><span>状态</span><kbd id="sync-dialog-state">—</kbd></div>
          <div><span>文件夹</span><kbd id="sync-dialog-folder">—</kbd></div>
          <div><span>最近同步</span><kbd id="sync-dialog-time">—</kbd></div>
        </div>
        <div class="sync-actions" style="margin-top:10px">
          <button class="btn" id="sync-connect">连接文件夹</button>
          <button class="btn" id="sync-push">写入全部文档</button>
          <button class="btn" id="sync-pull">从文件夹读取</button>
          <button class="btn" id="sync-disconnect">断开</button>
        </div>
      </div>
      <p class="dialog-text" style="margin-top:10px">写入以当前编辑器内容为准；「从文件夹读取」会把目录里的 .md 文件作为新文档导入。${native ? '桌面版通过系统对话框选择目录，直接读写本机磁盘。' : '文件夹同步仅 Chrome / Edge 支持。'}</p>`,
    actions: [{ label: '关闭', value: true, primary: true }],
    onMount(root) {
      const stateEl = root.querySelector('#sync-dialog-state');
      const folderEl = root.querySelector('#sync-dialog-folder');
      const timeEl = root.querySelector('#sync-dialog-time');
      const connectBtn = root.querySelector('#sync-connect');
      const labels = {
        local: '仅本地', connected: '已连接', syncing: '同步中', synced: '已同步',
        paused: '需要重新授权', error: '同步出错', unsupported: '浏览器不支持',
      };
      const refresh = () => {
        const s = getStatus();
        stateEl.textContent = labels[s.status] || s.status;
        folderEl.textContent = s.folderName || '未连接';
        timeEl.textContent = s.lastSyncedAt ? new Date(s.lastSyncedAt).toLocaleTimeString('zh-CN') : '—';
        connectBtn.textContent = s.status === 'paused' ? '重新授权' : '连接文件夹';
        connectBtn.disabled = s.status === 'unsupported';
        root.querySelector('#sync-push').disabled = !s.folderName;
        root.querySelector('#sync-pull').disabled = !s.folderName;
        root.querySelector('#sync-disconnect').disabled = !s.folderName;
      };
      const run = (fn) => async () => {
        try { await fn(); } catch (err) { onError?.(err?.message || '操作失败'); }
        refresh();
      };
      connectBtn.addEventListener('click', run(() => (getStatus().status === 'paused' ? onReconnect() : onConnect())));
      root.querySelector('#sync-push').addEventListener('click', run(onPush));
      root.querySelector('#sync-pull').addEventListener('click', run(onPull));
      root.querySelector('#sync-disconnect').addEventListener('click', run(onDisconnect));
      refresh();
    },
  });
}

export function openSettings({ getSettings, setSetting, onReset }) {
  const s = getSettings();
  const sel = (name, options, current) => `<select class="field-input" data-setting="${name}">${options.map(([v, label]) => `<option value="${v}"${String(current) === String(v) ? ' selected' : ''}>${label}</option>`).join('')}</select>`;
  const range = (name, min, max, step, current, unit = '') => `<input type="range" data-setting="${name}" min="${min}" max="${max}" step="${step}" value="${current}" /><span class="setting-value" data-value-for="${name}">${current}${unit}</span>`;
  const toggle = (name, current, label, desc) => `<label class="setting-label"><strong>${label}</strong><small>${desc}</small></label><div class="setting-control"><label class="switch"><input type="checkbox" data-setting="${name}"${current ? ' checked' : ''} /><span></span></label></div>`;

  const html = `
    <div class="setting-section">外观</div>
    <div class="setting-row"><label class="setting-label"><strong>界面主题</strong><small>浅色 / 深色，预览与代码同步换色</small></label><div class="setting-control">${sel('theme', [['light', '浅色'], ['dark', '深色']], s.theme)}</div></div>
    <div class="setting-row"><label class="setting-label"><strong>默认视图</strong><small>也可通过菜单栏随时切换</small></label><div class="setting-control">${sel('mode', [['edit', '仅编辑（默认）'], ['split', '编辑 + 预览'], ['preview', '仅预览']], s.mode)}</div></div>
    <div class="setting-section" style="margin-top:10px">编辑器</div>
    <div class="setting-row"><label class="setting-label"><strong>编辑器字体</strong><small>等宽字体更适合排版 Markdown</small></label><div class="setting-control">${sel('fontFamily', [['mono', '等宽字体'], ['sans', '无衬线字体']], s.fontFamily)}</div></div>
    <div class="setting-row"><label class="setting-label"><strong>字号</strong><small>编辑器文字大小</small></label><div class="setting-control">${range('fontSize', 12, 22, 1, s.fontSize, 'px')}</div></div>
    <div class="setting-row"><label class="setting-label"><strong>行高</strong><small>编辑器行间距</small></label><div class="setting-control">${range('lineHeight', 1.3, 2.2, 0.05, s.lineHeight)}</div></div>
    <div class="setting-row"><label class="setting-label"><strong>预览宽度</strong><small>正文最大宽度</small></label><div class="setting-control">${range('previewWidth', 600, 1200, 20, s.previewWidth, 'px')}</div></div>
    <div class="setting-section" style="margin-top:10px">行为</div>
    <div class="setting-row">${toggle('syncScroll', s.syncScroll, '滚动同步', '编辑区滚动时预览区跟随')}</div>
    <div class="setting-row">${toggle('autoSave', s.autoSave, '自动保存', '内容变更后写入浏览器本地存储')}</div>
    <div class="setting-row">${toggle('breaks', s.breaks, '单换行转段落', '开启后单个回车也会渲染为换行')}</div>
    <div class="setting-row">${toggle('outlineVisible', s.outlineVisible, '文档大纲', '在右侧显示标题目录')}</div>
    <div style="margin-top:14px;text-align:right"><button class="text-btn" id="btn-reset" style="color:var(--danger)">${icon('trash', 14)} 重置为示例文档</button></div>
  `;

  return showDialog({
    title: '设置', icon: 'settings', width: 500, html,
    actions: [{ label: '完成', value: 'done', primary: true }],
    onMount(root, finish) {
      root.querySelectorAll('[data-setting]').forEach((el) => {
        const key = el.dataset.setting;
        const handler = () => {
          const value = el.type === 'checkbox' ? el.checked : (el.type === 'range' ? Number(el.value) : el.value);
          setSetting(key, value);
          const label = root.querySelector(`[data-value-for="${key}"]`);
          if (label) label.textContent = `${value}${key === 'fontSize' || key === 'previewWidth' ? 'px' : ''}`;
        };
        el.addEventListener(el.tagName === 'SELECT' || el.type === 'checkbox' ? 'change' : 'input', handler);
      });
      root.querySelector('#btn-reset').addEventListener('click', () => finish('reset'));
    },
  }).then(async (result) => {
    if (result !== 'reset') return;
    const ok = await confirmDialog('重置工作区', '这会删除当前所有本地文档，并恢复为初始示例文档。建议先备份。确定继续吗？', { danger: true, okLabel: '确认重置' });
    if (ok) onReset();
  });
}
