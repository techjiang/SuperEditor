import { marked } from 'marked';
import themeCss from '../styles/theme.css?raw';
import markdownCss from '../styles/markdown.css?raw';
import { downloadBlob, downloadText, safeName } from './download.js';
import { escapeHtml, renderMarkdown } from '../core/markdown.js';
import { parseSlides, splitSlideLines } from '../core/slides.js';
import { BRAND, logoSvg } from '../core/brand.js';

export const EXPORT_FORMATS = [
  { id: 'md', label: 'Markdown', ext: 'md', icon: 'file-md', desc: '纯文本源文件' },
  { id: 'html', label: 'HTML 网页', ext: 'html', icon: 'file-html', desc: '自带样式的独立网页' },
  { id: 'pdf', label: 'PDF 文档', ext: 'pdf', icon: 'file-pdf', desc: 'A4 分页，可直接分享' },
  { id: 'docx', label: 'Word 文档', ext: 'docx', icon: 'file-word', desc: '保留标题 / 列表 / 表格' },
  { id: 'pptx', label: 'PPT 演示文稿', ext: 'pptx', icon: 'file-ppt', desc: '按 --- 分页生成幻灯片' },
  { id: 'png', label: 'PNG 长图', ext: 'png', icon: 'file-image', desc: '导出整篇预览为图片' },
];

const EXPORT_CSS_EXTRA = `
  html, body { background: #eceef1 !important; }
  body { max-width: 900px; margin: 0 auto; padding: 30px 16px 64px; }
  .markdown-body { background: #fff; border: 1px solid #cdd2da; padding: 42px 48px; }
  .doc-banner { display:flex; align-items:center; gap:8px; margin-bottom:12px; color:#757d88; font: 11px/1.5 'Segoe UI','Microsoft YaHei',sans-serif; }
  .doc-banner b { color:#1d2128; font-size:12px; font-weight:650; }
  .doc-banner .app-logo { width:16px; height:16px; }
  .doc-banner .spacer { flex:1; }
  @media print {
    html, body { background:#fff !important; padding:0; margin:0; max-width:none; }
    .markdown-body { border:0; padding:0; }
    .doc-banner { display:none; }
    .code-block, table, blockquote { break-inside: avoid; }
    h1,h2,h3,h4,h5,h6 { break-after: avoid; }
  }
`;

function standaloneHtml({ title, bodyHtml, banner = true }) {
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>${themeCss}\n${markdownCss}\n${EXPORT_CSS_EXTRA}</style></head>
<body>${banner ? `<div class="doc-banner">${logoSvg({ size: 16, color: BRAND.color })}<b>${BRAND.name}</b><span>${escapeHtml(title)}</span><span class="spacer"></span><span>${new Date().toLocaleDateString('zh-CN')}</span></div>` : ''}<article class="markdown-body">${bodyHtml}</article></body></html>`;
}

function currentPreviewHtml(ctx) {
  const el = ctx.previewEl;
  if (el && el.innerHTML.trim()) return el.innerHTML;
  return renderMarkdown(ctx.source || '');
}

function fileName(ctx, ext) {
  return `${safeName(ctx.title)}.${ext}`;
}

async function exportMarkdown(ctx) {
  downloadText(ctx.source || '', fileName(ctx, 'md'), 'text/markdown;charset=utf-8');
}

async function exportHtml(ctx) {
  const html = standaloneHtml({ title: ctx.title, bodyHtml: currentPreviewHtml(ctx) });
  downloadText(html, fileName(ctx, 'html'), 'text/html;charset=utf-8');
}

async function toCanvas(el) {
  const html2canvas = (await import('html2canvas')).default;
  const rootStyle = getComputedStyle(document.documentElement);
  const bg = rootStyle.getPropertyValue('--bg-1').trim() || '#ffffff';
  const render = (target) => html2canvas(target, {
    backgroundColor: bg,
    scale: Math.min(2, window.devicePixelRatio > 1 ? 2 : 1.5),
    useCORS: true,
    logging: false,
    windowWidth: Math.max(target.scrollWidth, 900),
    scrollX: 0,
    scrollY: 0,
  });

  // 「仅编辑」模式下预览面板被隐藏，直接截图会得到 0 宽画布；
  // 克隆到离屏容器，保证 PNG / PDF 导出在任何视图模式下都可用。
  if (el.getClientRects().length && el.offsetWidth > 0) return render(el);

  const width = rootStyle.getPropertyValue('--preview-width').trim() || '820px';
  const stage = document.createElement('div');
  stage.style.cssText = `position:fixed;left:0;top:0;width:${width};z-index:-1;pointer-events:none;`;
  const clone = el.cloneNode(true);
  clone.style.display = 'block';
  clone.style.width = '100%';
  clone.style.maxHeight = 'none';
  clone.style.overflow = 'visible';
  stage.appendChild(clone);
  document.body.appendChild(stage);
  try {
    return await render(clone);
  } finally {
    stage.remove();
  }
}

async function exportPng(ctx) {
  const canvas = await toCanvas(ctx.previewEl);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('图片生成失败');
  downloadBlob(blob, fileName(ctx, 'png'));
}

async function exportPdf(ctx) {
  const [{ jsPDF }, canvas] = await Promise.all([import('jspdf'), toCanvas(ctx.previewEl)]);
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
  const pageW = 210;
  const pageH = 297;
  const margin = 10;
  const imgW = pageW - margin * 2;
  const imgH = (canvas.height * imgW) / canvas.width;
  const usableH = pageH - margin * 2;
  const pages = Math.max(1, Math.ceil(imgH / usableH));
  const data = canvas.toDataURL('image/jpeg', 0.9);
  for (let i = 0; i < pages; i++) {
    if (i > 0) pdf.addPage();
    pdf.addImage(data, 'JPEG', margin, margin - i * usableH, imgW, imgH, `super-page-${i}`, 'FAST');
  }
  pdf.setProperties({ title: ctx.title, creator: 'SuperEditor', subject: '由 SuperEditor 导出' });
  downloadBlob(pdf.output('blob'), fileName(ctx, 'pdf'));
  return pages;
}

async function exportDocx(ctx) {
  const d = await import('docx');
  const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle, HeadingLevel, ExternalHyperlink } = d;
  const HEADINGS = [null, HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4, HeadingLevel.HEADING_5, HeadingLevel.HEADING_6];

  const inlineRuns = (tokens = [], style = {}) => {
    const out = [];
    for (const tk of tokens) {
      if (!tk) continue;
      switch (tk.type) {
        case 'text':
        case 'escape':
          out.push(new TextRun({ text: tk.text || '', ...style }));
          break;
        case 'strong': out.push(...inlineRuns(tk.tokens, { ...style, bold: true })); break;
        case 'em': out.push(...inlineRuns(tk.tokens, { ...style, italics: true })); break;
        case 'del': out.push(...inlineRuns(tk.tokens, { ...style, strike: true })); break;
        case 'codespan': out.push(new TextRun({ text: tk.text || '', font: 'Consolas', color: '7C3AED', ...style })); break;
        case 'link':
          out.push(new ExternalHyperlink({
            link: /^(https?|mailto):/i.test(tk.href || '') ? tk.href : 'https://example.com',
            children: inlineRuns(tk.tokens, { ...style, color: '4F46E5', underline: {} }),
          }));
          break;
        case 'image': out.push(new TextRun({ text: `[图片] ${tk.text || ''}`, italics: true, color: '8B90A5' })); break;
        case 'br': out.push(new TextRun({ text: '', break: 1 })); break;
        default:
          if (tk.tokens) out.push(...inlineRuns(tk.tokens, style));
          else if (tk.text) out.push(new TextRun({ text: tk.text, ...style }));
      }
    }
    return out.length ? out : [new TextRun({ text: '' })];
  };

  const itemInline = (item) => (item.tokens || []).flatMap((t) => (t.type === 'text' ? (t.tokens || [t]) : [t]));

  function convert(tokens, level = 0) {
    const out = [];
    for (const tk of tokens) {
      switch (tk.type) {
        case 'heading':
          out.push(new Paragraph({ children: inlineRuns(tk.tokens, { bold: true }), heading: HEADINGS[tk.depth] || HeadingLevel.HEADING_6, spacing: { before: 280, after: 140 } }));
          break;
        case 'paragraph':
          out.push(new Paragraph({ children: inlineRuns(tk.tokens), spacing: { after: 140 } }));
          break;
        case 'text':
          out.push(new Paragraph({ children: inlineRuns(tk.tokens || [{ type: 'text', text: tk.text }]) }));
          break;
        case 'list':
          tk.items.forEach((item, i) => {
            const prefix = tk.ordered ? `${tk.start + i}. ` : '• ';
            const children = [new TextRun({ text: prefix, color: '6366F1', bold: true }), ...inlineRuns(itemInline(item))];
            if (item.task) children.unshift(new TextRun({ text: item.checked ? '☑ ' : '☐ ' }));
            out.push(new Paragraph({ children, indent: { left: 420 * (level + 1), hanging: 260 }, spacing: { after: 80 } }));
          });
          break;
        case 'blockquote':
          out.push(new Paragraph({ children: inlineRuns(tk.tokens?.flatMap((t) => t.tokens || [t]) || [], { italics: true, color: '5B6178' }), indent: { left: 480 }, spacing: { before: 120, after: 120 }, border: { left: { style: BorderStyle.SINGLE, size: 18, color: 'A5B4FC', space: 8 } } }));
          break;
        case 'code': {
          const lines = String(tk.text || '').split('\n');
          out.push(new Paragraph({
            children: lines.flatMap((line, i) => [new TextRun({ text: line, font: 'Consolas', size: 18, color: '334155', ...(i ? { break: 1 } : {}) })]),
            shading: { fill: 'F3F4FA' }, spacing: { before: 120, after: 160 }, indent: { left: 200, right: 200 },
          }));
          break;
        }
        case 'table': {
          const rows = [tk.header, ...tk.rows].map((cells, ri) => new TableRow({
            tableHeader: ri === 0,
            children: cells.map((cell) => new TableCell({
              shading: ri === 0 ? { fill: 'EEF0FF' } : undefined,
              children: [new Paragraph({ children: inlineRuns(cell.tokens, ri === 0 ? { bold: true } : {}), spacing: { before: 60, after: 60 } })],
            })),
          }));
          out.push(new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } }));
          out.push(new Paragraph({ children: [new TextRun({ text: '' })] }));
          break;
        }
        case 'hr':
          out.push(new Paragraph({ children: [], border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'DDE0EC', space: 6 } }, spacing: { before: 120, after: 200 } }));
          break;
        case 'space': break;
        case 'html':
          if (/^<(img|br|hr)/i.test(tk.text || '')) break;
          out.push(new Paragraph({ children: [new TextRun({ text: String(tk.text || '').replace(/<[^>]*>/g, '') })] }));
          break;
        default:
          if (tk.tokens) out.push(...convert(tk.tokens, level));
          break;
      }
    }
    return out;
  }

  const tokens = marked.lexer(ctx.source || '');
  const children = convert(tokens);
  if (!children.length) children.push(new Paragraph({ children: [new TextRun({ text: '' })] }));

  const doc = new Document({
    creator: 'SuperEditor',
    title: ctx.title,
    description: '由 SuperEditor 从 Markdown 导出',
    styles: {
      default: {
        document: {
          run: { font: 'Microsoft YaHei', size: 22, color: '242733' },
          paragraph: { spacing: { line: 340 } },
        },
      },
    },
    sections: [{
      properties: { page: { margin: { top: 1200, right: 1200, bottom: 1200, left: 1200 } } },
      children,
    }],
  });
  const blob = await Packer.toBlob(doc);
  downloadBlob(blob, fileName(ctx, 'docx'));
}

async function exportPptx(ctx) {
  const PptxGenJS = (await import('pptxgenjs')).default;
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = BRAND.name;
  pptx.company = BRAND.name;
  pptx.subject = ctx.title;
  pptx.title = ctx.title;

  const slides = parseSlides(ctx.source || '');
  const total = slides.length;
  const FONT = 'Microsoft YaHei';
  const rect = PptxGenJS.ShapeType?.rect || 'rect';
  const INK = '1D2128';
  const BODY = '3C434E';
  const MUTED = '8B9199';
  const RULE = 'CDD2DA';
  const ACCENT = '2B62A8';
  const SOFT = 'F1F3F6';

  slides.forEach((slide, i) => {
    const s = pptx.addSlide();
    const info = splitSlideLines(slide.content);
    s.background = { color: 'FFFFFF' };
    s.addShape(rect, { x: 0.85, y: 0.36, w: 11.6, h: 0.035, fill: { color: ACCENT }, line: { color: ACCENT } });
    s.addText(info.title || `第 ${i + 1} 页`, {
      x: 0.85, y: 0.55, w: 11.6, h: 0.95, fontSize: 30, bold: true, color: INK, fontFace: FONT, valign: 'mid', margin: 0,
    });
    s.addShape(rect, { x: 0.85, y: 1.62, w: 11.6, h: 0.012, fill: { color: RULE }, line: { color: RULE } });

    let bodyY = 1.98;
    if (info.quote) {
      s.addText(info.quote, { x: 0.9, y: bodyY, w: 11.5, h: 0.8, fontSize: 18, italic: true, color: MUTED, fontFace: FONT, margin: 0 });
      bodyY += 0.9;
    }
    if (info.bullets.length) {
      s.addText(info.bullets.map((b) => ({ text: b, options: { bullet: { code: '2022' }, breakLine: true, fontSize: 19, color: BODY, paraSpaceAfterPt: 9 } })), {
        x: 0.95, y: bodyY, w: 11.4, h: Math.max(1, 6.8 - bodyY - 0.5), fontFace: FONT, valign: 'top', margin: 0, lineSpacingMultiple: 1.15,
      });
    } else if (info.table?.length) {
      const rows = info.table.map((cells, ri) => cells.map((text) => ({
        text,
        options: { bold: ri === 0, fill: { color: ri === 0 ? SOFT : 'FFFFFF' }, color: ri === 0 ? ACCENT : BODY, fontSize: 15, fontFace: FONT },
      })));
      s.addTable(rows, { x: 0.9, y: bodyY, w: 11.5, rowH: 0.55, border: { pt: 1, color: RULE }, fontFace: FONT, autoPage: false, valign: 'mid' });
    } else if (info.code) {
      s.addShape(rect, { x: 0.9, y: bodyY, w: 11.5, h: 3.4, fill: { color: SOFT }, line: { color: RULE } });
      s.addText(info.code.slice(0, 900), { x: 1.15, y: bodyY + 0.2, w: 11, h: 3, fontSize: 13, fontFace: 'Consolas', color: BODY, valign: 'top', margin: 0 });
    } else if (info.body) {
      s.addText(info.body.slice(0, 400), { x: 0.95, y: bodyY, w: 11.4, h: 3, fontSize: 19, color: BODY, fontFace: FONT, valign: 'top', margin: 0 });
    }

    s.addText(BRAND.name, { x: 0.9, y: 6.95, w: 3, h: 0.3, fontSize: 10, color: MUTED, fontFace: 'Consolas', margin: 0 });
    s.addText(`${i + 1} / ${total}`, { x: 11.5, y: 6.95, w: 1, h: 0.3, fontSize: 10, color: MUTED, align: 'right', fontFace: 'Consolas', margin: 0 });
  });

  const result = await pptx.write({ outputType: 'blob', compression: true });
  const blob = result instanceof Blob ? result : new Blob([result], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
  downloadBlob(blob, fileName(ctx, 'pptx'));
  return total;
}

function printDocument(ctx) {
  const html = standaloneHtml({ title: ctx.title, bodyHtml: currentPreviewHtml(ctx), banner: false });
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;';
  document.body.appendChild(iframe);
  iframe.onload = () => {
    setTimeout(() => {
      try { iframe.contentWindow?.focus(); iframe.contentWindow?.print(); } catch (e) { console.warn(e); }
      setTimeout(() => iframe.remove(), 1000);
    }, 260);
  };
  iframe.srcdoc = html;
}

export async function exportDocument(format, ctx) {
  const labels = { ...Object.fromEntries(EXPORT_FORMATS.map((f) => [f.id, f.label])), print: '打印', backup: '备份' };
  ctx.toast?.(`正在生成 ${labels[format] || format}…`, 'info', 1600);
  try {
    switch (format) {
      case 'md': await exportMarkdown(ctx); break;
      case 'html': await exportHtml(ctx); break;
      case 'png': await exportPng(ctx); break;
      case 'pdf': {
        const pages = await exportPdf(ctx);
        ctx.toast?.(`PDF 已导出（共 ${pages} 页）· 需要可选中文字请用「打印」`, 'success', 4200);
        return;
      }
      case 'docx': await exportDocx(ctx); break;
      case 'pptx': {
        const pages = await exportPptx(ctx);
        ctx.toast?.(`PPT 已导出（共 ${pages} 张幻灯片）`, 'success');
        return;
      }
      case 'print': printDocument(ctx); ctx.toast?.('已打开打印窗口，可选择「另存为 PDF」', 'success'); return;
      default: throw new Error(`未知的导出格式：${format}`);
    }
    ctx.toast?.(`${labels[format]} 导出完成`, 'success');
  } catch (err) {
    console.error(`[SuperEditor] 导出 ${format} 失败`, err);
    ctx.toast?.(`导出失败：${err?.message || '未知错误'}`, 'error', 5000);
    throw err;
  }
}

export { standaloneHtml };
