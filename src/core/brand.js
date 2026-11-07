// Logo 的唯一几何来源：SVG、favicon、PNG、ICO、演示页与导出网页全部由此生成。
// 坐标基于 32x32 视框；每个元素为 [x, y, width, height] 的实心矩形，无背景。
export const BRAND = {
  name: 'SuperEditor',
  version: '1.2.0',
  color: '#2b62a8',
  darkColor: '#dfe3e8',
};

// 作者信息的唯一来源：关于页、README、发布元数据均以此为准。
export const AUTHOR = {
  name: '科技酱',
  slogan: '同一个世界，同一个互联网！',
  site: 'https://www.asoe.cn',
  docs: 'https://docs.asoe.cn',
  github: 'https://github.com/techjiang/',
  bilibili: 'https://space.bilibili.com/1768832152',
  forum: 'https://forums.asoe.cn/',
  email: 'official@tech.asoe.cn',
  qqGroups: ['291974598', '474819022', '631167288'],
  repository: 'https://github.com/techjiang/SuperEditor.git',
  copyright: 'Copyright © 2026 科技酱',
};

export const LOGO_VIEWBOX = 32;

export const LOGO_RECTS = [
  [2, 5, 28, 1.6], [2, 25.4, 28, 1.6], [2, 5, 1.6, 22], [28.4, 5, 1.6, 22],
  [15.2, 5, 1.6, 22],
  [6.2, 10.7, 6.2, 1.5], [6.2, 14.8, 6.2, 1.5], [6.2, 18.9, 4.2, 1.5],
  [19.8, 10.5, 6.4, 2.4], [19.8, 15.6, 6.4, 1.5], [19.8, 19.6, 4.4, 1.5],
];

// 小尺寸图标用更少的线与更粗的笔画，保证 16px 下仍清晰。
export const LOGO_RECTS_SIMPLE = [
  [1.6, 4.6, 28.8, 2], [1.6, 25.4, 28.8, 2], [1.6, 4.6, 2, 22.8], [28.4, 4.6, 2, 22.8],
  [15, 4.6, 2, 22.8],
  [5.6, 11.4, 6.4, 2.2], [5.6, 18.4, 6.4, 2.2],
  [19.6, 11, 6.8, 3], [19.6, 18.4, 4.8, 2.2],
];

export function logoMarkup({ simple = false } = {}) {
  const rects = simple ? LOGO_RECTS_SIMPLE : LOGO_RECTS;
  return rects.map(([x, y, w, h]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}"/>`).join('');
}

export function logoSvg({ size = 18, color = 'currentColor', simple = false, className = 'app-logo' } = {}) {
  return `<svg class="${className}" width="${size}" height="${size}" viewBox="0 0 ${LOGO_VIEWBOX} ${LOGO_VIEWBOX}" fill="${color}" aria-hidden="true">${logoMarkup({ simple })}</svg>`;
}

export function logoSvgFile({ color = BRAND.color, simple = false } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${LOGO_VIEWBOX} ${LOGO_VIEWBOX}" fill="${color}">${logoMarkup({ simple })}</svg>`;
}
