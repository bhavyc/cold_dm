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

  // Generate an elegant gradient rounded-square icon with a glowing sparkle/star
  const center = size / 2;
  const radius = size * 0.46;
  const cornerRadius = size * 0.22;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (size * y + x) << 2;

      // Rounded rectangle check
      const dx = Math.max(Math.abs(x - center) - (center - cornerRadius), 0);
      const dy = Math.max(Math.abs(y - center) - (center - cornerRadius), 0);
      const distToCorner = Math.sqrt(dx * dx + dy * dy);

      if (distToCorner > cornerRadius) {
        // Transparent outside rounded box
        png.data[idx] = 0;
        png.data[idx + 1] = 0;
        png.data[idx + 2] = 0;
        png.data[idx + 3] = 0;
        continue;
      }

      // Smooth antialiasing on outer edge
      let alpha = 255;
      if (distToCorner > cornerRadius - 1) {
        alpha = Math.floor(255 * (cornerRadius - distToCorner));
      }

      // Gradient from Indigo (#4f46e5) to Violet (#7c3aed) to Electric Sky (#0284c7)
      const t = (x + y) / (size * 2);
      const r = Math.floor(79 * (1 - t) + 124 * t);
      const g = Math.floor(70 * (1 - t) + 58 * t);
      const b = Math.floor(229 * (1 - t) + 237 * t);

      // Draw a 4-point sparkle / star in the center
      const sx = (x - center) / (size * 0.32);
      const sy = (y - center) / (size * 0.32);
      const starDist = Math.abs(sx) * Math.abs(sy) + Math.sqrt(sx * sx + sy * sy) * 0.35;

      // Inner chat bubble + star motif
      if (starDist < 0.42) {
        // Bright White Sparkle with slight glow
        const glow = Math.min(1, (0.42 - starDist) / 0.15);
        png.data[idx] = Math.floor(255 * glow + r * (1 - glow));
        png.data[idx + 1] = Math.floor(255 * glow + g * (1 - glow));
        png.data[idx + 2] = Math.floor(255 * glow + b * (1 - glow));
        png.data[idx + 3] = alpha;
      } else {
        // Gradient background
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
console.log('All icons generated successfully!');

