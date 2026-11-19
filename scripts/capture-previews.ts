/**
 * One-time capture script for project preview screenshots.
 *
 * Run locally with:  npx tsx scripts/capture-previews.ts
 *
 * Requirements:
 *   - Playwright is installed (devDependency @playwright/test)
 *   - For the Rally Voley capture: npm run dev must succeed in ~/WEB/rally-voley
 *   - Internet access for QuestDay and SakurAI
 *
 * Output: assets/raw-previews/{questday,sakurai,rally-voley}.png
 * Then run: npm run images   to convert + resize to public/previews/
 *
 * This script is NEVER imported by src/ and must NOT run in CI or npm test.
 */
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';

const OUT = path.resolve(process.cwd(), 'assets/raw-previews');
await mkdir(OUT, { recursive: true });

const VIEWPORT = { width: 1440, height: 900 };

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Wait until a URL returns a non-error HTTP status. */
async function waitForServer(url: string, timeoutMs = 60_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2_000) });
      if (res.ok || res.status < 500) return;
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Server at ${url} did not start within ${timeoutMs}ms`);
}

// ── Launch browser ────────────────────────────────────────────────────────────

const browser = await chromium.launch({ headless: true });

// ── 1. QuestDay ───────────────────────────────────────────────────────────────

console.log('Capturing QuestDay…');
{
  const ctx = await browser.newContext({ viewport: VIEWPORT });
  const page = await ctx.newPage();

  await page.goto('https://playquestday.com', { waitUntil: 'networkidle', timeout: 60_000 });

  // Wait for fonts and any CSS animations to settle
  await page.waitForTimeout(2_000);

  // Dismiss any cookie/consent overlays by looking for common selectors and
  // pressing Escape — harmless if none are present
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  const buf = await page.screenshot({ type: 'png', fullPage: false, clip: { x: 0, y: 0, width: 1440, height: 900 } });
  await writeFile(path.join(OUT, 'questday.png'), buf);
  await ctx.close();
  console.log('  saved questday.png');
}

// ── 2. SakurAI ────────────────────────────────────────────────────────────────

console.log('Capturing SakurAI…');
{
  const ctx = await browser.newContext({ viewport: VIEWPORT });
  const page = await ctx.newPage();

  await page.goto('https://www.getsakurai.com', { waitUntil: 'networkidle', timeout: 60_000 });

  // The site uses scroll-triggered reveals; give the hero time to render fully
  await page.waitForTimeout(3_000);

  // Dismiss any overlays
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  const buf = await page.screenshot({ type: 'png', fullPage: false, clip: { x: 0, y: 0, width: 1440, height: 900 } });
  await writeFile(path.join(OUT, 'sakurai.png'), buf);
  await ctx.close();
  console.log('  saved sakurai.png');
}

// ── 3. Rally Voley ────────────────────────────────────────────────────────────

console.log('Capturing Rally Voley…');
let devServer: ChildProcess | null = null;
try {
  const rallyDir = path.resolve(process.cwd(), '../rally-voley');

  // Start the dev server
  devServer = spawn('npm', ['run', 'dev'], {
    cwd: rallyDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
  });

  devServer.stdout?.on('data', (d: Buffer) => process.stdout.write(`[rally-dev] ${d}`));
  devServer.stderr?.on('data', (d: Buffer) => process.stderr.write(`[rally-dev:err] ${d}`));

  await waitForServer('http://localhost:3000', 90_000);
  console.log('  dev server ready');

  const ctx = await browser.newContext({ viewport: VIEWPORT });
  const page = await ctx.newPage();

  await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 30_000 });
  // Wait for Dexie/IndexedDB to initialise and the empty state to render
  await page.waitForTimeout(2_000);

  // Click the demo button (shows in the empty-state card)
  const demoBtn = page.getByTestId('demo-btn');
  await demoBtn.waitFor({ state: 'visible', timeout: 15_000 });
  await demoBtn.click();

  // Wait for navigation to the report page (/informe?partido=…)
  await page.waitForURL(/\/informe/, { timeout: 15_000 });
  await page.waitForTimeout(2_000); // let animations settle

  const buf = await page.screenshot({ type: 'png', fullPage: false, clip: { x: 0, y: 0, width: 1440, height: 900 } });
  await writeFile(path.join(OUT, 'rally-voley.png'), buf);
  await ctx.close();
  console.log('  saved rally-voley.png');
} finally {
  if (devServer) {
    devServer.kill('SIGTERM');
    // Give it a moment to exit cleanly
    await new Promise((r) => setTimeout(r, 1_500));
    console.log('  dev server stopped');
  }
}

await browser.close();
console.log('All captures done. Run: npm run images');
