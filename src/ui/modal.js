import { icon } from './icons.js';

let closeCurrent = null;

export function showDialog({ title, icon: iconName = 'sparkles', html = '', width = 460, actions = [], onMount, onAction } = {}) {
  const backdrop = document.getElementById('modal-backdrop');
  const dialog = document.getElementById('dialog');
  closeDialog();

  return new Promise((resolve) => {
    const finish = (value) => {
      if (closeCurrent === finish) closeCurrent = null;
      backdrop.hidden = true;
      dialog.innerHTML = '';
      document.removeEventListener('keydown', onKey, true);
      resolve(value);
    };
    closeCurrent = finish;

    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        finish(null);
      } else if (e.key === 'Enter' && e.target.tagName === 'INPUT' && actions.length) {
        e.preventDefault();
        const primary = actions.find((a) => a.primary) || actions[actions.length - 1];
        const val = onAction ? onAction(primary, dialog) : primary.value;
        finish(val);
      }
    };

    dialog.style.width = `${width}px`;
    dialog.innerHTML = `
      <div class="dialog-head"><span class="dialog-ico">${icon(iconName, 18)}</span><h3></h3><button class="icon-btn sm dialog-close" aria-label="关闭">${icon('x', 16)}</button></div>
      <div class="dialog-body">${html}</div>
      <div class="dialog-foot"></div>`;
    dialog.querySelector('h3').textContent = title;
    const foot = dialog.querySelector('.dialog-foot');
    actions.forEach((a) => {
      const btn = document.createElement('button');
      btn.className = `btn ${a.primary ? 'btn-primary' : ''} ${a.danger ? 'btn-danger' : ''}`;
      btn.textContent = a.label;
      btn.addEventListener('click', () => finish(onAction ? onAction(a, dialog) : a.value));
      foot.appendChild(btn);
    });

    backdrop.hidden = false;
    backdrop.onclick = (e) => { if (e.target === backdrop) finish(null); };
    dialog.querySelector('.dialog-close').onclick = () => finish(null);
    document.addEventListener('keydown', onKey, true);
    if (onMount) onMount(dialog, finish);
    const focusable = dialog.querySelector('input, textarea, [autofocus], .btn-primary');
    if (focusable) setTimeout(() => focusable.focus(), 30);
  });
}

export function closeDialog() {
  if (closeCurrent) closeCurrent(null);
}

export function confirmDialog(title, message, { danger = false, okLabel = '确定' } = {}) {
  return showDialog({
    title,
    icon: danger ? 'alert-circle' : 'help-circle',
    html: `<p class="dialog-text"></p>`,
    actions: [
      { label: '取消', value: false },
      { label: okLabel, value: true, primary: !danger, danger },
    ],
    onMount(root) { root.querySelector('.dialog-text').textContent = message; },
  });
}

export function promptDialog(title, label, value = '', placeholder = '') {
  return showDialog({
    title,
    icon: 'pencil',
    html: `<label class="field-label">${label}</label><input class="field-input" id="dlg-input" value="" placeholder="${placeholder}" />`,
    actions: [
      { label: '取消', value: null },
      { label: '确定', value: '', primary: true },
    ],
    onMount(root) { root.querySelector('#dlg-input').value = value; },
    onAction(action, root) {
      if (action.primary) return root.querySelector('#dlg-input').value.trim() || null;
      return null;
    },
  });
}
