import { safeName, stripExt } from './download.js';

const INDEX_FILE = '.supereditor-index.json';
const DB_NAME = 'supereditor';
const DB_STORE = 'fs-handles';
const DESKTOP = typeof window !== 'undefined' ? window.desktop : null;

let dirHandle = null;
let dirPath = '';
let folderName = '';
let status = 'local';
let error = '';
let lastSyncedAt = 0;
let pushTimer = null;
const listeners = new Set();

function join(dir, name) {
  return `${String(dir).replace(/[\\/]+$/, '')}/${name}`;
}

function basename(value) {
  return String(value).split(/[\\/]/).filter(Boolean).pop() || String(value);
}

export function isSupported() {
  return !!DESKTOP || (typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function');
}

export function getSyncStatus() {
  return { status, folderName, error, lastSyncedAt, supported: isSupported(), native: !!DESKTOP };
}

export function onSyncStatus(fn) {
  listeners.add(fn);
  fn(getSyncStatus());
  return () => listeners.delete(fn);
}

function setStatus(next, message = '') {
  status = next;
  error = message;
  listeners.forEach((fn) => fn(getSyncStatus()));
}

function reqPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txPromise(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

async function openDb() {
  const req = indexedDB.open(DB_NAME, 1);
  req.onupgradeneeded = () => {
    const db = req.result;
    if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE);
  };
  return reqPromise(req);
}

async function idbGet(key) {
  const db = await openDb();
  return reqPromise(db.transaction(DB_STORE, 'readonly').objectStore(DB_STORE).get(key));
}

async function idbSet(key, value) {
  const db = await openDb();
  const tx = db.transaction(DB_STORE, 'readwrite');
  tx.objectStore(DB_STORE).put(value, key);
  return txPromise(tx);
}

async function idbDelete(key) {
  const db = await openDb();
  const tx = db.transaction(DB_STORE, 'readwrite');
  tx.objectStore(DB_STORE).delete(key);
  return txPromise(tx);
}

export async function initSync() {
  if (DESKTOP) {
    try {
      const saved = await DESKTOP.folder.get();
      if (saved) {
        dirPath = saved;
        folderName = basename(saved);
        setStatus('connected');
      } else {
        setStatus('local');
      }
    } catch (err) {
      setStatus('error', err?.message || '无法读取同步配置');
    }
    return getSyncStatus();
  }
  if (!isSupported()) { setStatus('unsupported'); return getSyncStatus(); }
  try {
    const saved = await idbGet('folder');
    if (saved?.handle) {
      dirHandle = saved.handle;
      folderName = saved.name || dirHandle.name || '已连接文件夹';
      const permission = await dirHandle.queryPermission({ mode: 'readwrite' });
      setStatus(permission === 'granted' ? 'connected' : 'paused');
    } else {
      setStatus('local');
    }
  } catch (err) {
    setStatus('error', err?.message || '无法读取同步配置');
  }
  return getSyncStatus();
}

export async function connectFolder() {
  if (DESKTOP) {
    const selected = await DESKTOP.chooseFolder();
    if (!selected) throw new Error('已取消选择文件夹');
    await DESKTOP.folder.set(selected);
    dirPath = selected;
    folderName = basename(selected);
    setStatus('connected');
    return folderName;
  }
  if (!isSupported()) throw new Error('当前浏览器不支持文件夹同步，请使用 Chrome 或 Edge');
  const handle = await window.showDirectoryPicker({ mode: 'readwrite', id: 'supereditor', startIn: 'documents' });
  await idbSet('folder', { handle, name: handle.name }).catch(() => undefined);
  dirHandle = handle;
  folderName = handle.name;
  setStatus('connected');
  return folderName;
}

export async function reconnectFolder() {
  if (DESKTOP) {
    if (!dirPath) return connectFolder();
    setStatus('connected');
    return folderName;
  }
  if (!dirHandle) return connectFolder();
  const granted = await dirHandle.requestPermission({ mode: 'readwrite' });
  if (granted !== 'granted') throw new Error('未获得文件夹访问权限');
  setStatus('connected');
  return folderName;
}

export async function disconnectFolder() {
  clearTimeout(pushTimer);
  dirHandle = null;
  dirPath = '';
  folderName = '';
  lastSyncedAt = 0;
  if (DESKTOP) await DESKTOP.folder.set('');
  else await idbDelete('folder').catch(() => undefined);
  setStatus('local');
}

async function ensurePermission(interactive = false) {
  if (DESKTOP) {
    if (!dirPath) throw new Error('尚未连接同步文件夹');
    return;
  }
  if (!dirHandle) throw new Error('尚未连接同步文件夹');
  const options = { mode: 'readwrite' };
  if (await dirHandle.queryPermission(options) === 'granted') return;
  if (interactive && await dirHandle.requestPermission(options) === 'granted') return;
  throw new Error('文件夹权限已失效，请重新授权');
}

async function writeText(name, content) {
  if (DESKTOP) {
    await DESKTOP.fs.write(join(dirPath, name), content);
    return;
  }
  const handle = await dirHandle.getFileHandle(name, { create: true });
  const writable = await handle.createWritable();
  await writable.write(content);
  await writable.close();
}

async function readIndex() {
  try {
    const text = DESKTOP
      ? await DESKTOP.fs.read(join(dirPath, INDEX_FILE))
      : await (await (await dirHandle.getFileHandle(INDEX_FILE)).getFile()).text();
    const data = JSON.parse(text);
    return Array.isArray(data.docs) ? data : { docs: [] };
  } catch {
    return { docs: [] };
  }
}

async function writeIndex(index) {
  await writeText(INDEX_FILE, `${JSON.stringify(index, null, 2)}\n`);
}

function uniqueName(base, used) {
  if (!used.has(base)) return base;
  const dot = base.lastIndexOf('.');
  const stem = dot > 0 ? base.slice(0, dot) : base;
  const ext = dot > 0 ? base.slice(dot) : '';
  let n = 2;
  while (used.has(`${stem}-${n}${ext}`)) n++;
  return `${stem}-${n}${ext}`;
}

async function removeEntry(name) {
  try {
    if (DESKTOP) await DESKTOP.fs.delete(join(dirPath, name));
    else await dirHandle.removeEntry(name);
  } catch { /* 文件可能已被手动删除 */ }
}

export async function pushAll(docs) {
  await ensurePermission(true);
  setStatus('syncing');
  try {
    const previous = await readIndex();
    const used = new Set();
    const next = { version: 1, updatedAt: Date.now(), docs: [] };
    for (const doc of docs) {
      const file = uniqueName(`${safeName(doc.title)}.md`, used);
      used.add(file);
      await writeText(file, doc.content);
      next.docs.push({ id: doc.id, file, updatedAt: doc.updatedAt });
    }
    for (const old of previous.docs || []) {
      if (!used.has(old.file)) await removeEntry(old.file);
    }
    await writeIndex(next);
    lastSyncedAt = Date.now();
    setStatus('synced');
    return next.docs.length;
  } catch (err) {
    setStatus('error', err?.message || '同步失败');
    throw err;
  }
}

export async function writeDoc(doc) {
  if (!dirHandle && !dirPath) return false;
  await ensurePermission(false);
  setStatus('syncing');
  const index = await readIndex();
  const used = new Set((index.docs || []).map((e) => e.file));
  const wanted = `${safeName(doc.title)}.md`;
  let entry = (index.docs ||= []).find((e) => e.id === doc.id);
  let file = entry?.file || wanted;

  if (entry && entry.file !== wanted && !used.has(wanted)) {
    await removeEntry(entry.file);
    used.delete(entry.file);
    file = wanted;
  }
  if (!entry) {
    file = uniqueName(wanted, used);
    entry = { id: doc.id, file };
    index.docs.push(entry);
  }
  entry.file = file;
  entry.updatedAt = doc.updatedAt;
  await writeText(file, doc.content);
  await writeIndex(index);
  lastSyncedAt = Date.now();
  setStatus('synced');
  return true;
}

export function schedulePush(doc) {
  if ((!dirHandle && !dirPath) || status === 'unsupported' || status === 'paused') return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(async () => {
    try { await writeDoc(doc); }
    catch (err) { setStatus('error', err?.message || '自动同步失败'); }
  }, 1200);
}

export async function pullAll() {
  await ensurePermission(true);
  const result = [];
  if (DESKTOP) {
    const files = await DESKTOP.fs.readMarkdown(dirPath);
    for (const item of files) result.push({ title: stripExt(item.name), content: item.content, file: item.name });
    return result;
  }
  for await (const [name, handle] of dirHandle.entries()) {
    if (handle.kind !== 'file' || name.startsWith('.')) continue;
    if (!/\.(md|markdown|txt)$/i.test(name)) continue;
    const content = await (await handle.getFile()).text();
    result.push({ title: stripExt(name), content, file: name });
  }
  return result;
}

export function getFolderName() { return folderName; }
