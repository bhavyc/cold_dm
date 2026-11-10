import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PNG } from 'pngjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputDir = path.join(__dirname);

function generatePromoSmall() {
  const width = 440;
  const height = 280;
  const png = new PNG({ width, height });

  // Sleek gradient: Slate navy (#0f172a to #1e293b) with LinkedIn blue accent (#0a66c2)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (width * y + x) << 2;
      const t = (x + y) / (width + height);

      // Deep studio navy background
      const r = Math.floor(15 * (1 - t) + 10 * t);
      const g = Math.floor(23 * (1 - t) + 65 * t);
      const b = Math.floor(42 * (1 - t) + 140 * t);

      // Subtle border
      const isBorder = x === 0 || x === width - 1 || y === 0 || y === height - 1;
      if (isBorder) {
        png.data[idx] = 30;
        png.data[idx + 1] = 41;
        png.data[idx + 2] = 59;
        png.data[idx + 3] = 255;
        continue;
      }

      // Draw a subtle preview card in the center
      const inCard = x >= 40 && x <= 400 && y >= 60 && y <= 230;
      if (inCard) {
        const isCardBorder = x === 40 || x === 400 || y === 60 || y === 230;
        if (isCardBorder) {
          png.data[idx] = 51;
          png.data[idx + 1] = 65;
          png.data[idx + 2] = 85;
        } else {
          png.data[idx] = 248;
          png.data[idx + 1] = 250;
          png.data[idx + 2] = 252;
        }
        png.data[idx + 3] = 255;
      } else {
        png.data[idx] = r;
        png.data[idx + 1] = g;
        png.data[idx + 2] = b;
        png.data[idx + 3] = 255;
      }
    }
  }

  const outPath = path.join(outputDir, 'promo-small-440x280.png');
  fs.writeFileSync(outPath, PNG.sync.write(png));
  console.log(`Generated: ${outPath} (440x280)`);
}

function generateMarqueeLarge() {
  const width = 1280;
  const height = 800;
  const png = new PNG({ width, height });

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (width * y + x) << 2;
      const t = (x + y * 0.5) / (width + height * 0.5);

      // Professional canvas gradient
      const r = Math.floor(248 * (1 - t) + 241 * t);
      const g = Math.floor(250 * (1 - t) + 245 * t);
      const b = Math.floor(252 * (1 - t) + 249 * t);

      // Center container shadow & card
      const inMockup = x >= 180 && x <= 1100 && y >= 100 && y <= 700;
      if (inMockup) {
        const isMockupBorder = x === 180 || x === 1100 || y === 100 || y === 700;
        if (isMockupBorder) {
          png.data[idx] = 203;
          png.data[idx + 1] = 213;
          png.data[idx + 2] = 225;
        } else {
          // Inside mockup
          const inHeader = y <= 160;
          if (inHeader) {
            png.data[idx] = 10;
            png.data[idx + 1] = 102;
            png.data[idx + 2] = 194;
          } else {
            png.data[idx] = 255;
            png.data[idx + 1] = 255;
            png.data[idx + 2] = 255;
          }
        }
        png.data[idx + 3] = 255;
      } else {
        png.data[idx] = r;
        png.data[idx + 1] = g;
        png.data[idx + 2] = b;
        png.data[idx + 3] = 255;
      }
    }
  }

  const outPath = path.join(outputDir, 'marquee-1280x800.png');
  fs.writeFileSync(outPath, PNG.sync.write(png));
  console.log(`Generated: ${outPath} (1280x800)`);
}

generatePromoSmall();
generateMarqueeLarge();
console.log('Store promotional graphic assets ready!');

