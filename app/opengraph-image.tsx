import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { cacheLife } from 'next/cache';
import { ImageResponse } from 'next/og';
import { wide } from './_components/ascii-title';

// Social preview: the wide ASCII title in ink on bg (DESIGN.md §9.4)
export const alt = 'Connor dot works';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Cached so the image is generated once at build time rather than on every request
async function loadFont() {
  'use cache';
  cacheLife('max');
  return readFile(path.join(process.cwd(), 'assets/fonts/GeistMono-Regular.ttf'));
}

export default async function Image() {
  const geistMono = await loadFont();

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#C4C4C4', // bg
      }}
    >
      <div
        style={{
          display: 'flex',
          whiteSpace: 'pre',
          fontFamily: 'Geist Mono',
          fontSize: 24, // 73 columns × 0.6em ≈ 1050px
          lineHeight: 1.1,
          color: '#1A1A1A', // ink
        }}
      >
        {wide}
      </div>
    </div>,
    { ...size, fonts: [{ name: 'Geist Mono', data: geistMono, weight: 400, style: 'normal' }] },
  );
}
