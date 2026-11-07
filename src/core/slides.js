export function parseSlides(source) {
  const lines = String(source ?? '').replace(/\r\n?/g, '\n').split('\n');
  let start = 0;
  if (/^\s*---\s*$/.test(lines[0] || '')) {
    const end = lines.findIndex((l, i) => i > 0 && /^\s*---\s*$/.test(l));
    if (end > 0) start = end + 1;
  }

  const slides = [];
  let buffer = [];
  let fenceChar = null;
  for (let i = start; i < lines.length; i++) {
    const line = lines[i];
    const fence = /^\s*(`{3,}|~{3,})/.exec(line);
    if (fence) {
      const ch = fence[1][0];
      if (!fenceChar) fenceChar = ch;
      else if (fenceChar === ch) fenceChar = null;
    }
    if (!fenceChar && /^\s*-{3,}\s*$/.test(line) && line.trim().length >= 3) {
      slides.push(buffer.join('\n'));
      buffer = [];
      continue;
    }
    buffer.push(line);
  }
  slides.push(buffer.join('\n'));

  return slides
    .map((raw, i) => {
      const content = raw.trim();
      const heading = /^\s*#{1,6}\s+(.+)$/m.exec(content);
      return { index: i, content, title: heading ? heading[1].replace(/[*_`]/g, '').trim() : `第 ${i + 1} 页` };
    })
    .filter((s, i, arr) => s.content.length > 0 || arr.length === 1);
}

export function splitSlideLines(content) {
  const result = { title: '', bullets: [], quote: '', code: '', table: null, body: '' };
  const lines = String(content).split('\n');
  let inCode = false;
  const codeLines = [];
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^```/.test(line.trim())) { inCode = !inCode; continue; }
    if (inCode) { codeLines.push(line); continue; }
    const h = /^#{1,6}\s+(.+)$/.exec(line.trim());
    if (h && !result.title) { result.title = h[1].replace(/\*\*|__|\*|_|`/g, '').trim(); continue; }
    const li = /^\s*(?:[-*+]|\d+\.)\s+(?:\[[ xX]\]\s*)?(.*)$/.exec(line);
    if (li) { result.bullets.push(li[1].replace(/\*\*|__|\*|_|`/g, '').trim()); continue; }
    const q = /^>\s*(.+)$/.exec(line.trim());
    if (q && !result.quote) { result.quote = q[1].replace(/\*\*|__|\*|_|`/g, '').trim(); continue; }
    if (/^\|.*\|$/.test(line.trim()) && !line.includes('---')) {
      const cells = line.trim().slice(1, -1).split('|').map((c) => c.trim());
      if (!result.table) result.table = [];
      result.table.push(cells);
      continue;
    }
    if (!result.body && line.trim() && !/^[-=|]+$/.test(line.trim())) result.body = line.trim().replace(/\*\*|__|\*|_|`/g, '');
  }
  if (codeLines.length) result.code = codeLines.join('\n');
  return result;
}
