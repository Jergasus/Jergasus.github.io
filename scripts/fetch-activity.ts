/**
 * Refreshes data/activity.json from the GitHub API (spec §4).
 *
 * Run: ACTIVITY_TOKEN=<token> npm run activity
 *
 * Always exits 0, so a failed fetch never blocks a deploy. In GitHub Actions
 * its warnings become workflow annotations, and it sets two step outputs the
 * deploy workflow's activity-health job reads (ruling R18):
 *   result  updated | partial | kept-snapshot
 *   failed  true when a fetch failed (the run then fails after deploying)
 * See docs/activity-token.md.
 */
import { appendFile, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { refreshFailed, runFetchActivity } from '../src/lib/github-activity';
import { parseActivitySnapshot, type ActivitySnapshot } from '../src/lib/activity';

const DATA_PATH = resolve(process.cwd(), 'data', 'activity.json');
const inActions = process.env.GITHUB_ACTIONS === 'true';

// Same whitelist as the build's reader (src/os/apps/ActivityApp.tsx).
async function readSnapshot(): Promise<ActivitySnapshot> {
  const raw = await readFile(DATA_PATH, 'utf-8');
  return parseActivitySnapshot(JSON.parse(raw));
}

async function writeSnapshot(s: ActivitySnapshot): Promise<void> {
  await writeFile(DATA_PATH, JSON.stringify(s, null, 2) + '\n', 'utf-8');
}

// Workflow command data escapes %, CR and LF; the runner reads it from stdout.
const commandData = (text: string) =>
  text.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A');

function warn(message: string) {
  if (inActions) console.log(`::warning title=Activity refresh::${commandData(message)}`);
  else console.warn(`Warning: ${message}`);
}

const token = process.env.ACTIVITY_TOKEN || undefined;
const result = await runFetchActivity({ token, now: new Date(), readSnapshot, writeSnapshot, warn });
const failed = refreshFailed(result, token !== undefined);

console.log(
  {
    updated: 'Activity snapshot updated.',
    partial: 'Activity snapshot partly updated: see the warnings above.',
    'kept-snapshot': 'Activity snapshot unchanged.',
  }[result]
);

if (process.env.GITHUB_OUTPUT) {
  await appendFile(process.env.GITHUB_OUTPUT, `result=${result}\nfailed=${failed}\n`, 'utf-8');
}

process.exit(0);
