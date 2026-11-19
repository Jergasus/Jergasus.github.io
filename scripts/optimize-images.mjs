/**
 * Optimise project-preview screenshots and the about photo into
 * AVIF + WebP files ready for public/.
 *
 * Run with: npm run images   (invokes: node scripts/optimize-images.mjs)
 *
 *   npm run images -- /path/to/portrait.jpg     previews + about photo
 *   ABOUT_SRC=/path/to/portrait.jpg npm run images   same, from the environment
 *   npm run images                              previews only
 *
 * Inputs
 *   assets/raw-previews/{questday,sakurai,rally-voley}.png  — 1440×900 screenshots
 *   portrait     — full-resolution portrait JPEG, from the first argument or
 *                  ABOUT_SRC (it lives outside the repo; without it the about
 *                  photo is left as it is)
 *
 * Outputs
 *   public/previews/{questday,sakurai,rally-voley}.{avif,webp}  — 1600×1000 each
 *   public/about/jesus-garcia.{avif,webp}                       — 800×1000
 *
 * Size targets (brief § task-7)
 *   Preview AVIF ≤ 250 KB   Preview WebP ≤ 400 KB
 *   About   AVIF ≤ 120 KB
 */
import { mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

// ── Config ────────────────────────────────────────────────────────────────────

const RAW_DIR   = 'assets/raw-previews';
const PREV_DIR  = 'public/previews';
const ABOUT_DIR = 'public/about';

// The portrait's source is a local file outside the repo, so its path is
// never written down here.
const aboutArg = process.argv[2] ?? process.env.ABOUT_SRC;
const ABOUT_SRC = aboutArg ? path.resolve(aboutArg) : null;

const PREVIEW_SLUGS = ['questday', 'sakurai', 'rally-voley'];

const PREV_W = 1600;
const PREV_H = 1000;

const ABOUT_W = 800;
const ABOUT_H = 1000;

// Size limits in bytes
const PREV_AVIF_LIMIT = 250 * 1024;
const PREV_WEBP_LIMIT = 400 * 1024;
const ABOUT_AVIF_LIMIT = 120 * 1024;

// ── Helpers ───────────────────────────────────────────────────────────────────

async function fileSize(p) {
  return (await stat(p)).size;
}

function kb(bytes) {
  return (bytes / 1024).toFixed(1) + ' KB';
}

function checkLimit(actual, limit, label) {
  if (actual > limit) {
    console.error(`  ✗ ${label}: ${kb(actual)} > ${kb(limit)} — EXCEEDS LIMIT`);
    process.exitCode = 1;
  } else {
    console.log(`  ✓ ${label}: ${kb(actual)}`);
  }
}

// ── Setup dirs ────────────────────────────────────────────────────────────────

await mkdir(PREV_DIR,  { recursive: true });
await mkdir(ABOUT_DIR, { recursive: true });

// ── Project previews ──────────────────────────────────────────────────────────

for (const slug of PREVIEW_SLUGS) {
  const src = path.join(RAW_DIR, `${slug}.png`);

  // Check source exists
  try { await stat(src); } catch {
    console.error(`Missing raw capture: ${src}`);
    console.error('Run: npx tsx scripts/capture-previews.ts   first');
    process.exitCode = 1;
    continue;
  }

  console.log(`optimising preview: ${slug}`);

  // Resize to 1600×1000 (cover, centre — raw screenshots are already 1440×900, same ratio)
  const pipeline = sharp(src).resize({
    width: PREV_W,
    height: PREV_H,
    fit: 'cover',
    position: 'centre',
  });

  const avifPath = path.join(PREV_DIR, `${slug}.avif`);
  const webpPath = path.join(PREV_DIR, `${slug}.webp`);

  await pipeline.clone().avif({ quality: 55, effort: 6 }).toFile(avifPath);
  await pipeline.clone().webp({ quality: 78 }).toFile(webpPath);

  const avifSize = await fileSize(avifPath);
  const webpSize = await fileSize(webpPath);
  checkLimit(avifSize, PREV_AVIF_LIMIT, `${slug}.avif`);
  checkLimit(webpSize, PREV_WEBP_LIMIT, `${slug}.webp`);
}

// ── About photo ───────────────────────────────────────────────────────────────

if (!ABOUT_SRC) {
  console.log('about photo: no portrait given (argument or ABOUT_SRC), left as it is');
} else {
  console.log('optimising about photo');

  // Source is 764×1028 (portrait, 4:3-ish). We need 800×1000 (4:5).
  // cover + position:top keeps the top of the image (face/shoulders).
  const aboutPipeline = sharp(ABOUT_SRC).resize({
    width: ABOUT_W,
    height: ABOUT_H,
    fit: 'cover',
    position: 'top',
  });

  const avifAbout = path.join(ABOUT_DIR, 'jesus-garcia.avif');
  const webpAbout = path.join(ABOUT_DIR, 'jesus-garcia.webp');

  await aboutPipeline.clone().avif({ quality: 58, effort: 7 }).toFile(avifAbout);
  await aboutPipeline.clone().webp({ quality: 82 }).toFile(webpAbout);

  const avifAboutSize = await fileSize(avifAbout);
  const webpAboutSize = await fileSize(webpAbout);
  checkLimit(avifAboutSize, ABOUT_AVIF_LIMIT, 'jesus-garcia.avif');
  console.log(`  ✓ jesus-garcia.webp: ${kb(webpAboutSize)}`);
}

console.log('\nDone.');
