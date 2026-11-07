import { Marked } from 'marked';
import hljs from 'highlight.js/lib/common';
import DOMPurify from 'dompurify';
import katex from 'katex';

export function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

let slugMap = new Map();
function slugify(text) {
  const base = String(text)
    .replace(/<[^>]*>/g, '')
    .replace(/[\s]+/g, '-')
    .replace(/[^\p{L}\p{N}_-]/gu, '')
    .toLowerCase()
    .slice(0, 64) || 'section';
  const n = slugMap.get(base) || 0;
  slugMap.set(base, n + 1);
  return n ? `${base}-${n}` : base;
}

function sanitizeLink(href) {
  const url = String(href || '').trim();
  if (/^\s*(javascript|vbscript|file):/i.test(url)) return '#';
  return url;
}

const mathBlock = {
  name: 'mathBlock',
  level: 'block',
  start(src) { return src.indexOf('$$'); },
  tokenizer(src) {
    const m = /^\$\$[ \t]*\n?([\s\S]+?)\n?\$\$[ \t]*(?:\n|$)/.exec(src);
    if (m) return { type: 'mathBlock', raw: m[0], text: m[1].trim() };
    return undefined;
  },
  renderer(token) {
    try {
      return `<div class="math-block">${katex.renderToString(token.text, { displayMode: true, throwOnError: false, strict: false, output: 'html' })}</div>`;
    } catch (e) {
      return `<pre class="math-error">${escapeHtml(token.text)}</pre>`;
    }
  },
};

const mathInline = {
  name: 'mathInline',
  level: 'inline',
  start(src) { return src.indexOf('$'); },
  tokenizer(src) {
    const m = /^\$(?!\$)((?:\\.|[^$\\\n])+?)\$(?!\$)/.exec(src);
    if (m) return { type: 'mathInline', raw: m[0], text: m[1] };
    return undefined;
  },
  renderer(token) {
    try {
      return katex.renderToString(token.text, { displayMode: false, throwOnError: false, strict: false, output: 'html' });
    } catch (e) {
      return `<code>${escapeHtml(token.text)}</code>`;
    }
  },
};

const marked = new Marked({ gfm: true, breaks: false, pedantic: false });

marked.use({
  extensions: [mathBlock, mathInline],
  renderer: {
    code({ text, lang }) {
      const language = String(lang || '').split(/\s+/)[0].toLowerCase();
      if (language === 'mermaid') {
        return `<div class="mermaid-box"><div class="mermaid-loading">正在绘制图表…</div><pre class="mermaid-src" hidden>${escapeHtml(text)}</pre></div>`;
      }
      let highlighted;
      try {
        highlighted = language && hljs.getLanguage(language)
          ? hljs.highlight(text, { language, ignoreIllegals: true }).value
          : hljs.highlightAuto(text).value;
      } catch {
        highlighted = escapeHtml(text);
      }
      const label = language ? escapeHtml(language.toUpperCase()) : 'TEXT';
      return `<div class="code-block" data-lang="${escapeHtml(language)}"><div class="code-head"><span class="code-lang">${label}</span><button class="code-copy" type="button" title="复制代码">复制</button></div><pre><code class="hljs">${highlighted}</code></pre></div>`;
    },
    heading({ tokens, depth }) {
      const inner = this.parser.parseInline(tokens);
      const id = slugify(inner);
      return `<h${depth} id="${id}" class="md-heading"><a class="heading-anchor" href="#${id}" aria-hidden="true">#</a>${inner}</h${depth}>`;
    },
    link({ href, title, tokens }) {
      const url = sanitizeLink(href);
      const text = this.parser.parseInline(tokens);
      const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
      const external = /^https?:\/\//i.test(url);
      const extra = external ? ' target="_blank" rel="noopener noreferrer"' : '';
      return `<a href="${escapeHtml(url)}"${titleAttr}${extra}>${text}</a>`;
    },
    image({ href, title, text }) {
      const url = sanitizeLink(href);
      return `<img src="${escapeHtml(url)}" alt="${escapeHtml(text || '')}"${title ? ` title="${escapeHtml(title)}"` : ''} loading="lazy" class="md-image" />`;
    },
    checkbox({ checked }) {
      return `<input type="checkbox" disabled${checked ? ' checked' : ''} class="md-checkbox" /> `;
    },
    hr() { return '<hr class="md-hr" />'; },
  },
});

const PURIFY_CONFIG = {
  USE_PROFILES: { html: true, svg: true, svgFilters: true, mathMl: true },
  ADD_TAGS: ['math', 'semantics', 'annotation', 'mrow', 'mi', 'mo', 'mn', 'msup', 'msub', 'mfrac', 'mtext', 'msqrt', 'mspace', 'mtable', 'mtr', 'mtd', 'mover', 'munder', 'mpadded', 'mstyle', 'annotation-xml', 'foreignObject'],
  ADD_ATTR: ['target', 'rel', 'class', 'id', 'data-lang', 'aria-hidden', 'aria-label', 'loading', 'title', 'style', 'viewBox', 'xmlns', 'preserveAspectRatio', 'width', 'height', 'align', 'colspan', 'rowspan', 'disabled', 'checked', 'type'],
};

export function renderMarkdown(source, { breaks = false } = {}) {
  slugMap = new Map();
  marked.setOptions({ breaks });
  const raw = marked.parse(String(source ?? ''));
  return DOMPurify.sanitize(raw, PURIFY_CONFIG);
}

export function extractOutline(container) {
  return [...container.querySelectorAll('h1.md-heading, h2.md-heading, h3.md-heading, h4.md-heading, h5.md-heading, h6.md-heading')]
    .map((el) => ({
      id: el.id,
      level: Number(el.tagName.slice(1)),
      text: el.textContent.replace(/^#/, '').trim(),
    }));
}

let renderSeq = 0;
let mermaidModule = null;

async function getMermaid(theme) {
  if (!mermaidModule) mermaidModule = (await import('mermaid')).default;
  mermaidModule.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: theme === 'dark' ? 'dark' : 'default',
    fontFamily: 'Segoe UI, Microsoft YaHei, sans-serif',
    flowchart: { useMaxWidth: true, htmlLabels: false },
    sequence: { useMaxWidth: true },
  });
  return mermaidModule;
}

export async function enhancePreview(container, { theme = 'light' } = {}) {
  const seq = ++renderSeq;
  const boxes = [...container.querySelectorAll('.mermaid-box')];
  if (!boxes.length) return;
  try {
    const mermaid = await getMermaid(theme);
    for (let i = 0; i < boxes.length; i++) {
      if (seq !== renderSeq) return;
      const box = boxes[i];
      const src = box.querySelector('.mermaid-src');
      if (!src || box.dataset.done === '1') continue;
      const code = src.textContent;
      try {
        const { svg } = await mermaid.render(`mermaid-graph-${seq}-${i}`, code);
        if (seq !== renderSeq) return;
        box.innerHTML = DOMPurify.sanitize(svg, PURIFY_CONFIG);
        box.classList.add('mermaid-ready');
        box.dataset.done = '1';
      } catch (err) {
        box.innerHTML = `<div class="mermaid-error">图表解析失败：${escapeHtml(err?.message || '语法错误')}</div><pre>${escapeHtml(code)}</pre>`;
        box.dataset.done = '1';
      }
    }
  } catch (err) {
    console.warn('[SuperEditor] Mermaid 加载失败', err);
    container.querySelectorAll('.mermaid-loading').forEach((el) => {
      el.textContent = '图表引擎加载失败，请检查网络后重试';
    });
  }
}
