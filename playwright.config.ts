import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  use: { baseURL: 'http://localhost:4173' },
  webServer: {
    // Ruling R4: e2e runs on a production build that also exposes
    // window.__motionDebug (src/components/motion/debug.ts). The deploy build
    // never sets NEXT_PUBLIC_E2E, so the hook is compiled out there.
    command: 'NEXT_PUBLIC_E2E=1 npm run build && npm run serve',
    url: 'http://localhost:4173/',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
