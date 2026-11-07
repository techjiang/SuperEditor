const P = {
  'panel-left': '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/>',
  'panel-right': '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M15 3v18"/>',
  'search': '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  'plus': '<path d="M12 5v14M5 12h14"/>',
  'upload': '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5M12 3v12"/>',
  'archive': '<rect x="2" y="3" width="20" height="5" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8M10 12h4"/>',
  'rotate-ccw': '<path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5"/>',
  'chevron-down': '<path d="m6 9 6 6 6-6"/>',
  'chevron-up': '<path d="m18 15-6-6-6 6"/>',
  'chevron-left': '<path d="m15 18-6-6 6-6"/>',
  'chevron-right': '<path d="m9 18 6-6-6-6"/>',
  'x': '<path d="M18 6 6 18M6 6l12 12"/>',
  'maximize': '<path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/>',
  'sun': '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
  'moon': '<path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z"/>',
  'settings': '<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2" fill="var(--bg-1)" stroke="currentColor"/><circle cx="16" cy="12" r="2" fill="var(--bg-1)" stroke="currentColor"/><circle cx="8" cy="18" r="2" fill="var(--bg-1)" stroke="currentColor"/>',
  'list-tree': '<path d="M21 12h-8M21 6h-8M21 18h-8M3 5h1v5M3 14h1v5M6 8h2M6 16h2"/>',
  'presentation': '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4M7 8l3 3-3 3M13 14h4"/>',
  'download': '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  'pencil': '<path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  'columns': '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M12 3v18"/>',
  'eye': '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  'bold': '<path d="M6 4h8a4 4 0 0 1 0 8H6zM6 12h9a4 4 0 0 1 0 8H6z"/>',
  'italic': '<path d="M19 4h-9M14 20H5M15 4 9 20"/>',
  'strikethrough': '<path d="M16 4H9a3 3 0 0 0-2.8 4M14 12a4 4 0 0 1 0 8H6M4 12h16"/>',
  'heading1': '<path d="M4 5v14M12 5v14M4 12h8M17 10h4l-4 8h4"/>',
  'heading2': '<path d="M4 5v14M12 5v14M4 12h8M17 10a2 2 0 1 1 3 2l-3 4h4"/>',
  'heading3': '<path d="M4 5v14M12 5v14M4 12h8M17 10h4l-3 3a2 2 0 1 1-1 3"/>',
  'quote': '<path d="M6 5v14M10 8h10M10 12h10M10 16h6"/>',
  'code': '<path d="m16 18 6-6-6-6M8 6l-6 6 6 6"/>',
  'code-block': '<rect x="2" y="3" width="20" height="18" rx="2"/><path d="m9 10-3 2 3 2M15 10l3 2-3 2"/>',
  'link': '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  'image': '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',
  'list': '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  'list-ordered': '<path d="M10 6h11M10 12h11M10 18h11M4 5h1v4M3.5 14.5A1.5 1.5 0 1 1 6 15c0 1-2.5 2-2.5 3.5H6"/>',
  'check-square': '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="m8 12 3 3 5-6"/>',
  'table': '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/>',
  'minus': '<path d="M5 12h14"/>',
  'undo': '<path d="M3 7v6h6M3.5 13a8.5 8.5 0 1 0 2.6-6.2L3 9"/>',
  'redo': '<path d="M21 7v6h-6M20.5 13a8.5 8.5 0 1 1-2.6-6.2L21 9"/>',
  'file-text': '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h8"/>',
  'file-plus': '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M12 12v6M9 15h6"/>',
  'file-md': '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6"/><text x="7" y="19" font-size="8" font-weight="700" fill="currentColor" stroke="none" font-family="monospace">MD</text>',
  'file-html': '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6"/><text x="6.5" y="19" font-size="7" font-weight="700" fill="currentColor" stroke="none" font-family="monospace">HTML</text>',
  'file-pdf': '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6"/><text x="7" y="19" font-size="7.5" font-weight="700" fill="currentColor" stroke="none" font-family="monospace">PDF</text>',
  'file-ppt': '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6"/><text x="7" y="19" font-size="7.5" font-weight="700" fill="currentColor" stroke="none" font-family="monospace">PPT</text>',
  'file-word': '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6"/><text x="6.5" y="19" font-size="7" font-weight="700" fill="currentColor" stroke="none" font-family="monospace">DOC</text>',
  'file-image': '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6"/><circle cx="10" cy="13.5" r="1"/><path d="m8 19 3.5-3.5 2 2 1.5-1.5 2 2"/>',
  'copy': '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  'trash': '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/>',
  'more-horizontal': '<circle cx="5" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="19" cy="12" r="1.4" fill="currentColor"/>',
  'printer': '<path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z"/>',
  'sparkles': '<path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>',
  'keyboard': '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 13h.01M10 13h.01M14 13h.01M18 13h.01M8 16h8"/>',
  'save': '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2zM17 21v-8H7v8M7 3v5h8"/>',
  'check': '<path d="m20 6-11 11-5-5"/>',
  'alert-circle': '<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>',
  'info': '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  'hash': '<path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18"/>',
  'sigma': '<path d="M18 4H6l7 8-7 8h12"/>',
  'git-branch': '<circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="7" r="2"/><path d="M6 7v10M18 9a6 6 0 0 1-6 6H6"/>',
  'play': '<path d="m7 4 12 8-12 8z"/>',
  'wrap-text': '<path d="M3 6h18M3 18h11a3 3 0 0 0 0-6H9M11 10 9 12l2 2"/>',
  'type': '<path d="M4 7V4h16v3M9 20h6M12 4v16"/>',
  'align-left': '<path d="M3 6h18M3 10h12M3 14h18M3 18h12"/>',
  'help-circle': '<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01"/>',
  'external-link': '<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  'refresh-cw': '<path d="M21 12a9 9 0 0 0-15-6.7L3 8M3 3v5h5M3 12a9 9 0 0 0 15 6.7L21 16M21 21v-5h-5"/>',
  'folder-open': '<path d="M3 7V5a2 2 0 0 1 2-2h4l2 3h8a2 2 0 0 1 2 2v2M3 7l2 12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2l1-9H3z"/>',
  'clock': '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  'book-open': '<path d="M2 4h7a3 3 0 0 1 3 3v13a3 3 0 0 0-3-3H2zM22 4h-7a3 3 0 0 0-3 3v13a3 3 0 0 1 3-3h7z"/>',
  'arrow-right': '<path d="M5 12h14M13 6l6 6-6 6"/>',
  'layers': '<path d="m12 2 9 5-9 5-9-5zM3 12l9 5 9-5M3 17l9 5 9-5"/>',
  'palette': '<path d="M12 3a9 9 0 0 0 0 18h1.5a2 2 0 0 0 1.5-3.3 2 2 0 0 1 1.5-3.3H19a2 2 0 0 0 2-2 9 9 0 0 0-9-9z"/><circle cx="7.5" cy="11.5" r="1" fill="currentColor"/><circle cx="10" cy="7.5" r="1" fill="currentColor"/><circle cx="15" cy="7.5" r="1" fill="currentColor"/>',
  'folder': '<path d="M3 6a2 2 0 0 1 2-2h4l2 3h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  'hard-drive': '<rect x="2" y="5" width="20" height="14" rx="1"/><path d="M2 14h20M6 17h.01M10 17h.01"/>',
  'monitor': '<rect x="2" y="3" width="20" height="14" rx="1"/><path d="M8 21h8M12 17v4"/>',
  'check-circle': '<circle cx="12" cy="12" r="10"/><path d="m8 12 3 3 5-6"/>',
  'alert-triangle': '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01"/>',
  'square': '<rect x="4" y="4" width="16" height="16"/>',
};

export function icon(name, size = 18) {
  const body = P[name] || P['file-text'];
  return `<svg class="ico" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

export function hydrateIcons(root = document) {
  const nodes = [];
  if (root.nodeType === 1 && root.hasAttribute('data-icon')) nodes.push(root);
  root.querySelectorAll?.('[data-icon]').forEach((el) => nodes.push(el));
  nodes.forEach((el) => {
    if (el.dataset.iconDone === '1') return;
    const size = Number(el.dataset.iconSize) || (el.classList.contains('sm') ? 15 : 17);
    const hasOwnContent = el.textContent.trim().length > 0 || el.children.length > 0;
    const svg = icon(el.dataset.icon, size);
    if (hasOwnContent) el.insertAdjacentHTML('afterbegin', svg);
    else el.innerHTML = svg;
    el.dataset.iconDone = '1';
  });
}

export function setIcon(el, name) {
  el.querySelectorAll(':scope > .ico').forEach((node) => node.remove());
  el.dataset.icon = name;
  el.dataset.iconDone = '0';
  hydrateIcons(el);
}
