import { parseSlides } from '../core/slides.js';
import { renderMarkdown, enhancePreview } from '../core/markdown.js';
import { BRAND, logoSvg } from '../core/brand.js';

export function createPresenter({ getSource, getTheme, onToast }) {
  const overlay = document.getElementById('slides-overlay');
  const stage = document.getElementById('slides-stage');
  const indexLabel = document.getElementById('slide-index');
  const progress = document.getElementById('slides-progress-bar');

  let slides = [];
  let index = 0;
  let active = false;
  let blank = false;

  function setBlank(on) {
    blank = on;
    stage.classList.toggle('is-blank', on);
  }

  async function show(i) {
    if (!slides.length) return;
    index = Math.max(0, Math.min(slides.length - 1, i));
    const slide = slides[index];
    stage.innerHTML = `<div class="slide-card"><div class="slide-brand">${logoSvg({ size: 14 })} ${BRAND.name}</div><article class="markdown-body">${renderMarkdown(slide.content, { breaks: false })}</article><div class="slide-foot"><span>${slides[index].title || ''}</span><span>${index + 1}</span></div></div>`;
    indexLabel.textContent = `${index + 1} / ${slides.length}`;
    progress.style.width = `${((index + 1) / slides.length) * 100}%`;
    await enhancePreview(stage, { theme: 'light' });
  }

  function next() { if (index < slides.length - 1) show(index + 1); }
  function prev() { if (index > 0) show(index - 1); }

  function onKey(e) {
    if (!active) return;
    const k = e.key;
    if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'].includes(k)) { e.preventDefault(); e.stopPropagation(); next(); }
    else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(k)) { e.preventDefault(); e.stopPropagation(); prev(); }
    else if (k === 'Home') { e.preventDefault(); show(0); }
    else if (k === 'End') { e.preventDefault(); show(slides.length - 1); }
    else if (k === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
    else if (k.toLowerCase() === 'f') { e.preventDefault(); toggleFullscreen(); }
    else if (k.toLowerCase() === 'b') { e.preventDefault(); setBlank(!blank); }
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else overlay.requestFullscreen?.().catch(() => onToast?.('浏览器拒绝了全屏请求', 'warn'));
  }

  async function open() {
    slides = parseSlides(getSource());
    if (!slides.length) { onToast?.('文档内容为空，无法开始演示', 'warn'); return; }
    active = true;
    overlay.hidden = false;
    document.body.classList.add('presenting');
    document.addEventListener('keydown', onKey, true);
    setBlank(false);
    await show(0);
  }

  function close() {
    if (!active) return;
    active = false;
    overlay.hidden = true;
    stage.innerHTML = '';
    document.body.classList.remove('presenting');
    document.removeEventListener('keydown', onKey, true);
    if (document.fullscreenElement) document.exitFullscreen?.();
  }

  document.getElementById('slide-prev').addEventListener('click', prev);
  document.getElementById('slide-next').addEventListener('click', next);
  document.getElementById('slide-exit').addEventListener('click', close);
  document.getElementById('slide-fullscreen').addEventListener('click', toggleFullscreen);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  return { open, close, next, prev, show, isActive: () => active, getSlides: () => slides, getTheme };
}
