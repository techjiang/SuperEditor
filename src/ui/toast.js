import { icon } from './icons.js';

const ICONS = { success: 'check', error: 'alert-circle', info: 'info', warn: 'alert-circle' };

export function toast(message, type = 'info', duration = 2800) {
  const stack = document.getElementById('toast-stack');
  if (!stack) return;
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.innerHTML = `<span class="toast-ico">${icon(ICONS[type] || 'info', 16)}</span><span class="toast-msg"></span>`;
  el.querySelector('.toast-msg').textContent = message;
  stack.appendChild(el);
  requestAnimationFrame(() => el.classList.add('in'));
  const timer = setTimeout(() => {
    el.classList.remove('in');
    setTimeout(() => el.remove(), 220);
  }, duration);
  el.addEventListener('click', () => {
    clearTimeout(timer);
    el.classList.remove('in');
    setTimeout(() => el.remove(), 220);
  });
}
