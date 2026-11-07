import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { BRAND, LOGO_RECTS, LOGO_RECTS_SIMPLE, logoMarkup, LOGO_VIEWBOX, logoSvgFile } from '../src/core/brand.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = join(ROOT, 'public');
const ICONS = join(PUBLIC, 'icons');
mkdirSync(ICONS, { recursive: true });

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePng(size, rgba) {
  const stride = size * 4 + 1;
  const raw = Buffer.alloc(stride * size);
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0;
    rgba.copy(raw, y * stride + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function hexToRgb(hex) {
  const v = hex.replace('#', '');
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}

function rasterizeRgba(size, rects, rgb, scale = 4, inset = 0) {
  const ss = size * scale;
  const mask = new Uint8Array(ss * ss);
  const unit = ss / LOGO_VIEWBOX;
  const padding = inset * unit;
  const shrink = (LOGO_VIEWBOX - inset * 2) / LOGO_VIEWBOX;
  for (const [x, y, w, h] of rects) {
    const x0 = Math.max(0, Math.round((x * shrink) * unit + padding));
    const y0 = Math.max(0, Math.round((y * shrink) * unit + padding));
    const x1 = Math.min(ss, Math.round(((x + w) * shrink) * unit + padding));
    const y1 = Math.min(ss, Math.round(((y + h) * shrink) * unit + padding));
    for (let py = y0; py < y1; py++) {
      for (let px = x0; px < x1; px++) mask[py * ss + px] = 255;
    }
  }
  const rgba = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let sum = 0;
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) sum += mask[(y * scale + dy) * ss + x * scale + dx];
      }
      const o = (y * size + x) * 4;
      rgba[o] = rgb[0];
      rgba[o + 1] = rgb[1];
      rgba[o + 2] = rgb[2];
      rgba[o + 3] = Math.round(sum / (scale * scale));
    }
  }
  return rgba;
}

// Windows 图标资源（exe / 快捷方式 / 任务栏）要求标准 DIB(BMP) 条目。
// PNG 条目虽然 NSIS 能读，但资源管理器、.NET、rcedit 常无法解析，
// 会导致桌面与 exe 显示回退成 Electron 默认图标。
function dibEntry(size, rgba) {
  const header = Buffer.alloc(40);
  header.writeUInt32LE(40, 0);        // biSize
  header.writeInt32LE(size, 4);       // biWidth
  header.writeInt32LE(size * 2, 8);   // biHeight = XOR + AND mask
  header.writeUInt16LE(1, 12);        // biPlanes
  header.writeUInt16LE(32, 14);       // biBitCount
  header.writeUInt32LE(0, 16);        // BI_RGB
  header.writeUInt32LE(0, 20);        // biSizeImage
  header.writeInt32LE(0, 24);
  header.writeInt32LE(0, 28);
  header.writeUInt32LE(0, 32);
  header.writeUInt32LE(0, 36);

  const xor = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const s = ((size - 1 - y) * size + x) * 4; // DIB 自下而上
      const d = (y * size + x) * 4;
      xor[d] = rgba[s + 2];       // B
      xor[d + 1] = rgba[s + 1];   // G
      xor[d + 2] = rgba[s];       // R
      xor[d + 3] = rgba[s + 3];   // A
    }
  }
  const maskRow = Math.ceil(size / 32) * 4; // 1bpp AND mask，每行 4 字节对齐
  const andMask = Buffer.alloc(maskRow * size); // 全 0：透明度由 alpha 通道决定
  return Buffer.concat([header, xor, andMask]);
}

function buildIco(sizes, rgbaOf) {
  const entries = sizes.map((size) => ({ size, data: dibEntry(size, rgbaOf.get(size)) }));
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(entries.length, 4);
  let offset = 6 + 16 * entries.length;
  const dir = [];
  for (const { size, data } of entries) {
    const d = Buffer.alloc(16);
    d[0] = size >= 256 ? 0 : size;
    d[1] = size >= 256 ? 0 : size;
    d[2] = 0;
    d[3] = 0;
    d.writeUInt16LE(1, 4);
    d.writeUInt16LE(32, 6);
    d.writeUInt32LE(data.length, 8);
    d.writeUInt32LE(offset, 12);
    offset += data.length;
    dir.push(d);
  }
  return Buffer.concat([header, ...dir, ...entries.map((e) => e.data)]);
}

const rgb = hexToRgb(BRAND.color);
const SIZES = [16, 24, 32, 48, 64, 96, 128, 180, 192, 256, 512];
const rgbaOf = new Map();

for (const size of SIZES) {
  const rects = size <= 32 ? LOGO_RECTS_SIMPLE : LOGO_RECTS;
  const rgba = rasterizeRgba(size, rects, rgb, 4);
  rgbaOf.set(size, rgba);
  writeFileSync(join(ICONS, `icon-${size}.png`), encodePng(size, rgba));
}

writeFileSync(join(ICONS, 'icon-maskable-512.png'), encodePng(512, rasterizeRgba(512, LOGO_RECTS, rgb, 4, 5)));
// exe、快捷方式、任务栏、资源管理器分别使用不同尺寸，全部提供独立位图
writeFileSync(join(ICONS, 'app.ico'), buildIco([16, 24, 32, 48, 64, 128, 256], rgbaOf));
writeFileSync(join(PUBLIC, 'favicon.ico'), buildIco([16, 32, 48], rgbaOf));
writeFileSync(join(PUBLIC, 'favicon.svg'), logoSvgFile({ color: BRAND.color }));
writeFileSync(join(ICONS, 'logo.svg'), logoSvgFile({ color: BRAND.color }));
writeFileSync(join(ICONS, 'logo-light.svg'), logoSvgFile({ color: BRAND.darkColor }));

const manifest = {
  id: 'supereditor',
  name: 'SuperEditor - Markdown 文档编辑器',
  short_name: 'SuperEditor',
  description: '本地优先的 Markdown 文档编辑器，支持 PPT / PDF / Word 导入导出',
  start_url: './',
  scope: './',
  display: 'standalone',
  background_color: '#ffffff',
  theme_color: '#f3f4f6',
  orientation: 'any',
  categories: ['productivity', 'utilities'],
  icons: [96, 128, 192, 256, 512].map((size) => ({
    src: `./icons/icon-${size}.png`, sizes: `${size}x${size}`, type: 'image/png', purpose: 'any',
  })).concat([{ src: './icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }]),
};
writeFileSync(join(PUBLIC, 'manifest.webmanifest'), `${JSON.stringify(manifest, null, 2)}\n`);
writeFileSync(join(ICONS, 'logo-markup.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${LOGO_VIEWBOX} ${LOGO_VIEWBOX}" fill="currentColor">${logoMarkup()}</svg>`);

console.log(`Generated ${SIZES.length} PNG icons, DIB-format app.ico / favicon.ico, SVGs and manifest.webmanifest`);
