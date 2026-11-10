import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PNG } from 'pngjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputDir = path.join(__dirname, '..', 'extension', 'icons');

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

function createIcon(size) {
  const png = new PNG({ width: size, height: size });

  const center = size / 2;
  const cornerRadius = size * 0.22;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (size * y + x) << 2;

      // Rounded rectangle check
      const dx = Math.max(Math.abs(x - center) - (center - cornerRadius), 0);
      const dy = Math.max(Math.abs(y - center) - (center - cornerRadius), 0);
      const distToCorner = Math.sqrt(dx * dx + dy * dy);

      if (distToCorner > cornerRadius) {
        png.data[idx] = 0;
        png.data[idx + 1] = 0;
        png.data[idx + 2] = 0;
        png.data[idx + 3] = 0;
        continue;
      }

      let alpha = 255;
      if (distToCorner > cornerRadius - 1) {
        alpha = Math.floor(255 * (cornerRadius - distToCorner));
      }

      // LinkedIn Blue base (#0a66c2 to #004182)
      const t = (x + y) / (size * 2);
      const r = Math.floor(10 * (1 - t) + 0 * t);
      const g = Math.floor(102 * (1 - t) + 65 * t);
      const b = Math.floor(194 * (1 - t) + 130 * t);

      // Clean Quill / Pen Motif (Centered)
      const nx = (x - center) / (size * 0.35);
      const ny = (y - center) / (size * 0.35);

      // Slanted line for pen body
      const distToPenLine = Math.abs(nx - ny) / Math.SQRT2;
      const isAlongPen = (nx + ny) > -0.65 && (nx + ny) < 0.65;

      let isPen = false;
      if (isAlongPen && distToPenLine < 0.18) {
        isPen = true;
      }
      // Nib
      if ((nx + ny) < -0.55 && (nx + ny) > -0.9 && Math.abs(nx - ny) < 0.25) {
        isPen = true;
      }

      if (isPen) {
        // Pure White
        png.data[idx] = 255;
        png.data[idx + 1] = 255;
        png.data[idx + 2] = 255;
        png.data[idx + 3] = alpha;
      } else {
        // Professional blue background
        png.data[idx] = r;
        png.data[idx + 1] = g;
        png.data[idx + 2] = b;
        png.data[idx + 3] = alpha;
      }
    }
  }

  const outPath = path.join(outputDir, `icon${size}.png`);
  const buffer = PNG.sync.write(png);
  fs.writeFileSync(outPath, buffer);
  console.log(`Generated: ${outPath} (${size}x${size})`);
}

[16, 32, 48, 128].forEach(createIcon);
console.log('Icons refreshed with LinkedIn-native styling!');
