export function safeName(name) {
  return String(name || '未命名文档').replace(/[\\/:*?"<>|\r\n\t]/g, '_').trim().slice(0, 120) || '未命名文档';
}

export function stripExt(name) {
  return String(name || '').replace(/\.[^./\\]+$/, '');
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export async function downloadBlob(blob, filename) {
  const name = safeName(filename);
  if (typeof window !== 'undefined' && window.desktop) {
    try {
      return await window.desktop.saveFile(name, await blobToBase64(blob));
    } catch (err) {
      console.warn('[SuperEditor] 桌面保存失败', err);
      return null;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
  return name;
}

export function downloadText(text, filename, mime = 'text/plain;charset=utf-8') {
  return downloadBlob(new Blob([text], { type: mime }), filename);
}

export function readFile(file, as = 'text') {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    if (as === 'buffer') reader.readAsArrayBuffer(file);
    else if (as === 'dataurl') reader.readAsDataURL(file);
    else reader.readAsText(file, 'utf-8');
  });
}

export function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export function extOf(name) {
  const m = /\.([a-z0-9]+)$/i.exec(name || '');
  return m ? m[1].toLowerCase() : '';
}
