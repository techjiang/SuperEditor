const { app, BrowserWindow, ipcMain, dialog, Menu, shell, Tray, nativeImage } = require('electron');
const http = require('node:http');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');

const DEV = process.argv.includes('--dev');
const SMOKE = process.argv.includes('--smoke');
const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const ICON = path.join(ROOT, 'public', 'icons', 'app.ico');
const USER_DIR = app.getPath('userData');
const WORKSPACE_FILE = path.join(USER_DIR, 'workspace.json');
const FOLDER_FILE = path.join(USER_DIR, 'sync-folder.txt');
const OPENABLE = /\.(md|markdown|txt|html?|docx|pdf|pptx|png|jpe?g|gif|webp|svg)$/i;

let win = null;
let server = null;
let tray = null;
let pendingFiles = [];

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf',
  '.wasm': 'application/wasm', '.map': 'application/json', '.txt': 'text/plain; charset=utf-8',
};

function showWindow() {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

function deliverFile(item) {
  if (!win || win.webContents.isLoading()) pendingFiles.push(item);
  else win.webContents.send('app:open-file', item);
}

function openExternalFile(filePath) {
  if (!filePath || !OPENABLE.test(filePath)) return;
  fsp.readFile(filePath)
    .then((buf) => deliverFile({
      name: path.basename(filePath),
      ext: path.extname(filePath).replace('.', '').toLowerCase(),
      base64: buf.toString('base64'),
      path: filePath,
    }))
    .catch(() => undefined);
}

function createTray() {
  if (tray) return;
  try {
    const img = nativeImage.createFromPath(ICON);
    tray = new Tray(img);
    tray.setToolTip('SuperEditor');
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: '显示 SuperEditor', click: () => showWindow() },
      { type: 'separator' },
      { label: '退出', click: () => { app.isQuiting = true; tray?.destroy(); tray = null; app.quit(); } },
    ]));
    tray.on('click', () => {
      if (win && win.isVisible() && !win.isMinimized()) win.hide();
      else showWindow();
    });
  } catch (err) {
    console.warn('[SuperEditor] 托盘创建失败', err.message);
  }
}

function startStaticServer(root) {
  return new Promise((resolve, reject) => {
    const instance = http.createServer(async (req, res) => {
      try {
        let urlPath = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
        if (urlPath === '/') urlPath = '/index.html';
        const target = path.resolve(root, `.${urlPath}`);
        if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
          res.writeHead(403).end('Forbidden');
          return;
        }
        const data = await fsp.readFile(target);
        res.writeHead(200, {
          'Content-Type': MIME[path.extname(target).toLowerCase()] || 'application/octet-stream',
          'Cache-Control': 'no-store',
        });
        res.end(data);
      } catch {
        res.writeHead(404).end('Not found');
      }
    });
    instance.on('error', reject);
    instance.listen(0, '127.0.0.1', () => resolve(instance));
  });
}

const DOC_FILTERS = [
  { name: '文档', extensions: ['md', 'markdown', 'txt', 'html', 'htm', 'docx', 'pdf', 'pptx'] },
  { name: '图片', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'] },
  { name: '备份', extensions: ['json'] },
  { name: '全部文件', extensions: ['*'] },
];

function safeName(name) {
  return String(name || '未命名文档').replace(/[\\/:*?"<>|\r\n\t]/g, '_').trim();
}

function joinPath(dir, name) {
  return path.join(dir, name);
}

async function createWindow() {
  win = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 880,
    minHeight: 540,
    show: false,
    frame: false,
    backgroundColor: '#f3f4f6',
    icon: ICON,
    title: 'SuperEditor',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  });

  win.once('ready-to-show', () => {
    win.show();
    if (DEV) win.webContents.openDevTools({ mode: 'detached' });
  });
  win.on('closed', () => { win = null; });
  win.on('close', (e) => {
    if (!app.isQuiting) { e.preventDefault(); win.hide(); }
  });
  win.webContents.on('did-finish-load', () => {
    const queued = pendingFiles;
    pendingFiles = [];
    queued.forEach((item) => win.webContents.send('app:open-file', item));
  });
  createTray();

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^(https?:\/\/|mailto:)/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  win.webContents.on('context-menu', (_event, params) => {
    if (!params.isEditable && !params.selectionText) return;
    const template = [
      { label: '剪切', role: 'cut', enabled: params.isEditable },
      { label: '复制', role: 'copy', enabled: params.isEditable || !!params.selectionText },
      { label: '粘贴', role: 'paste', enabled: params.isEditable },
      { type: 'separator' },
      { label: '全选', role: 'selectAll' },
    ];
    Menu.buildFromTemplate(template).popup({ window: win });
  });

  win.on('maximize', () => win.webContents.send('window:maximize', true));
  win.on('unmaximize', () => win.webContents.send('window:maximize', false));

  if (DEV) {
    await win.loadURL('http://127.0.0.1:5173/');
  } else {
    server = await startStaticServer(DIST);
    await win.loadURL(`http://127.0.0.1:${server.address().port}/`);
  }

  if (SMOKE) {
    setTimeout(async () => {
      const userDir = app.getPath('userData');
      try {
        const image = await win.webContents.capturePage();
        const target = app.isPackaged
          ? path.join(userDir, 'desktop-smoke.png')
          : path.join(ROOT, 'desktop-smoke.png');
        await fsp.writeFile(target, image.toPNG());
        const status = {
          packaged: app.isPackaged,
          version: app.getVersion(),
          url: win.webContents.getURL(),
          hasDesktopApi: await win.webContents.executeJavaScript('!!window.desktop'),
          docCount: await win.webContents.executeJavaScript('document.querySelectorAll(".doc-item").length'),
          windowControls: await win.webContents.executeJavaScript('!document.getElementById("window-controls").hidden'),
          title: await win.webContents.executeJavaScript('document.title'),
        };
        await fsp.writeFile(path.join(userDir, 'smoke-status.json'), `${JSON.stringify(status, null, 2)}\n`);
        console.log('[SuperEditor] smoke ok', JSON.stringify(status));
      } catch (err) {
        await fsp.writeFile(path.join(userDir, 'smoke-status.json'), JSON.stringify({ ok: false, error: err.message }));
        console.warn('[SuperEditor] smoke failed', err.message);
      }
      app.isQuiting = true;
      tray?.destroy();
      tray = null;
      app.quit();
    }, 4500);
  }
}

ipcMain.handle('app:info', () => ({
  version: app.getVersion(),
  platform: process.platform,
  dataPath: WORKSPACE_FILE,
  isDesktop: true,
}));

ipcMain.handle('win:minimize', () => { win?.minimize(); });
ipcMain.handle('win:toggleMaximize', () => {
  if (!win) return false;
  if (win.isMaximized()) win.unmaximize();
  else win.maximize();
  return win.isMaximized();
});
ipcMain.handle('win:close', () => { win?.close(); });
ipcMain.handle('win:isMaximized', () => win?.isMaximized() || false);
ipcMain.handle('win:setTitle', (_e, title) => { if (win) win.setTitle(`${title} - SuperEditor`); });

ipcMain.handle('file:open', async () => {
  const result = await dialog.showOpenDialog(win, {
    title: '导入文档',
    properties: ['openFile', 'multiSelections'],
    filters: DOC_FILTERS,
  });
  if (result.canceled) return [];
  return Promise.all(result.filePaths.map(async (filePath) => ({
    name: path.basename(filePath),
    ext: path.extname(filePath).replace('.', '').toLowerCase(),
    base64: (await fsp.readFile(filePath)).toString('base64'),
    path: filePath,
  })));
});

ipcMain.handle('file:save', async (_e, { name, base64 }) => {
  const result = await dialog.showSaveDialog(win, {
    title: '导出 / 保存',
    defaultPath: path.join(app.getPath('documents'), safeName(name)),
    filters: DOC_FILTERS,
  });
  if (result.canceled || !result.filePath) return null;
  await fsp.writeFile(result.filePath, Buffer.from(base64, 'base64'));
  return result.filePath;
});

ipcMain.handle('folder:choose', async () => {
  const result = await dialog.showOpenDialog(win, {
    title: '选择同步文件夹',
    properties: ['openDirectory', 'createDirectory'],
  });
  return result.canceled ? null : result.filePaths[0];
});
ipcMain.handle('folder:get', () => fs.existsSync(FOLDER_FILE) ? fs.readFileSync(FOLDER_FILE, 'utf8').trim() : '');
ipcMain.handle('folder:set', (_e, folder) => {
  if (folder) fs.writeFileSync(FOLDER_FILE, folder, 'utf8');
  else if (fs.existsSync(FOLDER_FILE)) fs.unlinkSync(FOLDER_FILE);
});

ipcMain.handle('fs:read', (_e, filePath) => fsp.readFile(filePath, 'utf8'));
ipcMain.handle('fs:write', (_e, { filePath, text }) => fsp.writeFile(filePath, text, 'utf8'));
ipcMain.handle('fs:delete', async (_e, filePath) => { await fsp.unlink(filePath).catch(() => undefined); });
ipcMain.handle('fs:readMarkdown', async (_e, dir) => {
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  const files = entries.filter((e) => e.isFile() && /\.(md|markdown|txt)$/i.test(e.name) && !e.name.startsWith('.'));
  return Promise.all(files.map(async (e) => ({
    name: e.name,
    content: await fsp.readFile(joinPath(dir, e.name), 'utf8'),
  })));
});

ipcMain.handle('workspace:read', () => fs.existsSync(WORKSPACE_FILE) ? fs.readFileSync(WORKSPACE_FILE, 'utf8') : null);
ipcMain.handle('workspace:write', (_e, text) => fsp.writeFile(WORKSPACE_FILE, text, 'utf8'));
ipcMain.handle('shell:showItem', (_e, filePath) => shell.showItemInFolder(filePath));
ipcMain.handle('shell:openExternal', (_e, url) => { if (/^(https?:\/\/|mailto:)/i.test(url)) shell.openExternal(url); });
ipcMain.handle('app:addRecent', (_e, filePath) => {
  if (filePath) {
    try { app.addRecentDocument(filePath); } catch { /* 仅在已打包且具备身份时生效 */ }
  }
});
ipcMain.handle('fs:readBase64', async (_e, filePath) => (await fsp.readFile(filePath)).toString('base64'));

// 任何退出路径都要先放行窗口的 close 事件，否则「关闭到托盘」会阻止 app.quit()
app.on('before-quit', () => { app.isQuiting = true; });

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', (_e, argv) => {
    showWindow();
    argv.slice(1).forEach((arg) => openExternalFile(arg));
  });
  Menu.setApplicationMenu(null);
  app.whenReady().then(async () => {
    await createWindow();
    process.argv.slice(1).forEach((arg) => openExternalFile(arg));
  }).catch((err) => {
    console.error('[SuperEditor] 启动失败', err);
    app.quit();
  });
}

app.on('window-all-closed', () => {
  if (server) { server.closeAllConnections?.(); server.close(); server = null; }
  // 有托盘时关闭窗口只隐藏；托盘不可用时仍应正常退出
  if (!tray) app.quit();
});
