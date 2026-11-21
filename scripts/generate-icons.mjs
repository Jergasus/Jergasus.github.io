/**
 * Rasterise the site icon for the browsers and devices that do not read SVG.
 *
 * Run with: npm run icons   (invokes: node scripts/generate-icons.mjs)
 *
 * Input
 *   src/app/icon.svg          — the JG-OS mark on a desk-blue tile (Next links
 *                               it as the page icon)
 *
 * Outputs (Next's metadata file conventions pick them up from src/app/)
 *   src/app/apple-icon.png    — 180×180, iOS home screen. Full bleed: iOS
 *                               rounds the corners itself and would paint the
 *                               SVG's transparent corners black, so they are
 *                               filled with the tile colour.
 *   src/app/favicon.ico       — 32×32, the /favicon.ico browsers ask for
 */
import { readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const SVG = 'src/app/icon.svg';
const APPLE = 'src/app/apple-icon.png';
const FAVICON = 'src/app/favicon.ico';

const svg = await readFile(SVG);
// The tile is the SVG's first <rect>; its fill is the background colour.
const tile = svg.toString().match(/<rect[^>]*\sfill="(#[0-9a-f]{6})"/i)?.[1];
if (!tile) throw new Error(`${SVG}: no tile <rect fill="#rrggbb"> found`);

const render = (size) => sharp(svg, { density: 72 * (size / 32) }).resize(size, size);

await writeFile(APPLE, await render(180).flatten({ background: tile }).png().toBuffer());

// An ICO file may hold a PNG image as is: a 6-byte header, one 16-byte
// directory entry, then the PNG bytes.
const image = await render(32).png().toBuffer();
const header = Buffer.alloc(22);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type: icon
header.writeUInt16LE(1, 4); // one image
header.writeUInt8(32, 6); // width
header.writeUInt8(32, 7); // height
header.writeUInt8(0, 8); // no palette
header.writeUInt8(0, 9); // reserved
header.writeUInt16LE(1, 10); // colour planes
header.writeUInt16LE(32, 12); // bits per pixel
header.writeUInt32LE(image.length, 14); // image size
header.writeUInt32LE(22, 18); // image offset
await writeFile(FAVICON, Buffer.concat([header, image]));

console.log(`wrote ${APPLE} and ${FAVICON} (tile ${tile})`);
