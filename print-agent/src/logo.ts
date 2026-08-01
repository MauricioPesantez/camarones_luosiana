import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { PNG } from 'pngjs';

const GS = 0x1d;
const DEFAULT_LOGO_PATH = fileURLToPath(
  new URL('../assets/logo-camarones-louisiana.png', import.meta.url),
);

let cachedLogo: Buffer | null = null;

export function encodeEscPosRaster(
  width: number,
  height: number,
  rgba: Uint8Array,
): Buffer {
  if (!Number.isInteger(width) || width <= 0 || width > 576) {
    throw new Error('El ancho del logo debe estar entre 1 y 576 pixeles');
  }
  if (!Number.isInteger(height) || height <= 0 || height > 2047) {
    throw new Error('El alto del logo debe estar entre 1 y 2047 pixeles');
  }
  if (rgba.length !== width * height * 4) {
    throw new Error('Los datos RGBA del logo no coinciden con sus dimensiones');
  }

  const bytesPerRow = Math.ceil(width / 8);
  const raster = Buffer.alloc(bytesPerRow * height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixel = (y * width + x) * 4;
      const alpha = rgba[pixel + 3] / 255;
      const red = 255 + (rgba[pixel] - 255) * alpha;
      const green = 255 + (rgba[pixel + 1] - 255) * alpha;
      const blue = 255 + (rgba[pixel + 2] - 255) * alpha;
      const grayscale = 0.2126 * red + 0.7152 * green + 0.0722 * blue;

      // Igualar el umbral que usa node-thermal-printer en la impresion directa.
      if (grayscale < 128) {
        const byteIndex = y * bytesPerRow + Math.floor(x / 8);
        raster[byteIndex] |= 0x80 >> (x % 8);
      }
    }
  }

  const header = Buffer.from([
    GS,
    0x76,
    0x30,
    0x00,
    bytesPerRow & 0xff,
    (bytesPerRow >> 8) & 0xff,
    height & 0xff,
    (height >> 8) & 0xff,
  ]);

  return Buffer.concat([header, raster]);
}

export function loadLogoRaster(): Buffer {
  if (cachedLogo) return cachedLogo;

  const logoPath = process.env.PRINT_LOGO_PATH || DEFAULT_LOGO_PATH;
  const png = PNG.sync.read(readFileSync(logoPath));
  cachedLogo = encodeEscPosRaster(png.width, png.height, png.data);
  return cachedLogo;
}
