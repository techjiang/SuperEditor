import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { readFile, extOf, stripExt, safeName } from './download.js';
import { escapeHtml } from '../core/markdown.js';

function makeTurndown() {
  const td = new TurndownService({
    headingStyle: 'atx',
    hr: '---',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
    fence: '```',
    emDelimiter: '*',
    strongDelimiter: '**',
    linkStyle: 'inlined',
  });
  td.use(gfm);
  td.addRule('removeEmptyAnchors', {
    filter: (node) => node.nodeName === 'A' && !node.textContent.trim() && !node.getAttribute('href'),
    replacement: () => '',
  });
  return td;
}

export function htmlToMarkdown(html) {
  const doc = new DOMParser().parseFromString(String(html), 'text/html');
  doc.querySelectorAll('script, style, noscript, nav, footer, header, svg, iframe, form, button').forEach((el) => el.remove());
  const root = doc.querySelector('main, article, .markdown-body, [role="main"], body') || doc.body;
  const title = doc.querySelector('title')?.textContent?.trim() || '';
  const md = makeTurndown().turndown(root.innerHTML || root.textContent || '');
  return { content: md.replace(/\n{4,}/g, '\n\n\n').trim() + '\n', title };
}

async function docxToMarkdown(buffer) {
  const mod = await import('mammoth/mammoth.browser.js');
  const mammoth = mod.default || mod;
  const result = await mammoth.convertToHtml({ arrayBuffer: buffer });
  if (result.messages?.length) console.info('[SuperEditor] DOCX 转换提示', result.messages);
  return htmlToMarkdown(result.value);
}

async function pdfToMarkdown(buffer) {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(buffer), useSystemFonts: true }).promise;
  const pages = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    let lastY = null;
    let text = '';
    for (const item of content.items) {
      if (!('str' in item)) continue;
      const y = item.transform?.[5];
      if (lastY !== null && y !== null && Math.abs(y - lastY) > 3 && !text.endsWith('\n')) {
        text += '\n';
      }
      text += item.str;
      lastY = y;
    }
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean).join('\n');
    pages.push(lines);
  }
  await pdf.destroy?.();
  const meaningful = pages.map((p) => p.trim()).filter(Boolean);
  if (!meaningful.length) {
    throw new Error('该 PDF 没有可提取的文字层（扫描件 / 图片型 PDF），请改用文本型 PDF');
  }
  return { content: meaningful.join('\n\n---\n\n') + '\n', title: '' };
}

async function pptxToMarkdown(buffer) {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(buffer);
  const names = Object.keys(zip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/i.test(n))
    .sort((a, b) => Number(/\d+/.exec(a)[0]) - Number(/\d+/.exec(b)[0]));
  if (!names.length) throw new Error('未在 PPTX 中找到幻灯片');
  const parser = new DOMParser();
  const slides = [];
  for (const name of names) {
    const xml = await zip.file(name).async('string');
    const doc = parser.parseFromString(xml, 'application/xml');
    const paragraphs = [...doc.getElementsByTagNameNS('*', 'p')].filter((el) => el.getElementsByTagNameNS('*', 't').length);
    const blocks = paragraphs
      .map((p) => [...p.getElementsByTagNameNS('*', 't')].map((t) => t.textContent || '').join('').trim())
      .filter(Boolean)
      .filter((b) => !/^\d+\s*\/\s*\d+$/.test(b) && !/^SuperEditor$/i.test(b));
    if (!blocks.length) { slides.push(''); continue; }
    const [first, ...rest] = blocks;
    let md = `## ${first}\n\n`;
    if (rest.length) md += rest.map((b) => `- ${b}`).join('\n') + '\n';
    slides.push(md);
  }
  return { content: slides.filter(Boolean).join('\n---\n\n') + '\n', title: '' };
}

function plainTextToMarkdown(text) {
  return String(text).replace(/\r\n?/g, '\n').replace(/\n{4,}/g, '\n\n\n');
}

export const SUPPORTED_IMPORT = '.md,.markdown,.txt,.text,.html,.htm,.docx,.pdf,.pptx';

export async function importFile(file) {
  const ext = extOf(file.name);
  const fallbackTitle = stripExt(safeName(file.name)) || '导入的文档';
  let result;
  switch (ext) {
    case 'md':
    case 'markdown':
    case 'txt':
    case 'text':
      result = { content: plainTextToMarkdown(await readFile(file)), title: '' };
      break;
    case 'html':
    case 'htm':
      result = htmlToMarkdown(await readFile(file));
      break;
    case 'docx':
      result = await docxToMarkdown(await readFile(file, 'buffer'));
      break;
    case 'pdf':
      result = await pdfToMarkdown(await readFile(file, 'buffer'));
      break;
    case 'pptx':
      result = await pptxToMarkdown(await readFile(file, 'buffer'));
      break;
    default:
      throw new Error(`暂不支持导入 .${ext || '未知'} 格式`);
  }
  return { title: result.title || fallbackTitle, content: result.content || '' };
}

export async function imageToDataUrl(file) {
  return readFile(file, 'dataurl');
}

export function buildStandaloneHtml({ title, contentHtml }) {
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head>
<body><article class="markdown-body">${contentHtml}</article></body></html>`;
}
