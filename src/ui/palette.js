import { icon } from './icons.js';

export function createPalette({ getItems }) {
  const backdrop = document.getElementById('palette-backdrop');
  const input = document.getElementById('palette-input');
  const results = document.getElementById('palette-results');
  let items = [];
  let filtered = [];
  let active = 0;
  let open = false;

  function render() {
    if (!filtered.length) {
      results.innerHTML = `<div class="palette-empty">没有匹配的命令或文档</div>`;
      return;
    }
    let lastGroup = null;
    results.innerHTML = filtered.map((it, i) => {
      let head = '';
      if (it.group && it.group !== lastGroup) {
        head = `<div class="palette-group">${it.group}</div>`;
        lastGroup = it.group;
      }
      return `${head}<button class="palette-item ${i === active ? 'active' : ''}" data-index="${i}">
        <span class="pal-ico">${icon(it.icon || 'sparkles', 16)}</span>
        <span class="pal-text"><strong></strong><small></small></span>
        ${it.shortcut ? `<kbd>${it.shortcut}</kbd>` : ''}
      </button>`;
    }).join('');
    results.querySelectorAll('.palette-item').forEach((el) => {
      const it = filtered[Number(el.dataset.index)];
      el.querySelector('strong').textContent = it.label;
      el.querySelector('small').textContent = it.desc || '';
      el.addEventListener('mouseenter', () => { active = Number(el.dataset.index); highlight(); });
      el.addEventListener('click', () => choose(Number(el.dataset.index)));
    });
  }

  function highlight() {
    results.querySelectorAll('.palette-item').forEach((el) => {
      el.classList.toggle('active', Number(el.dataset.index) === active);
    });
    const el = results.querySelector('.palette-item.active');
    if (el) el.scrollIntoView({ block: 'nearest' });
  }

  function filter() {
    const q = input.value.trim().toLowerCase();
    filtered = q
      ? items.filter((it) => `${it.label} ${it.desc || ''} ${it.keywords || ''}`.toLowerCase().includes(q))
      : items;
    active = 0;
    render();
  }

  function choose(i) {
    const item = filtered[i];
    if (!item) return;
    close();
    setTimeout(() => item.run?.(), 20);
  }

  function onKey(e) {
    if (!open) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(filtered.length - 1, active + 1); highlight(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(0, active - 1); highlight(); }
    else if (e.key === 'Enter') { e.preventDefault(); choose(active); }
  }

  function show() {
    if (open) return;
    open = true;
    backdrop.hidden = false;
    items = getItems();
    input.value = '';
    filter();
    document.addEventListener('keydown', onKey, true);
    setTimeout(() => input.focus(), 20);
  }

  function close() {
    if (!open) return;
    open = false;
    backdrop.hidden = true;
    document.removeEventListener('keydown', onKey, true);
  }

  input.addEventListener('input', filter);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });

  return { show, close, isOpen: () => open };
}
