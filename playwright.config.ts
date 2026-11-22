import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

/** Kiểm thử E2E chạy trên bản build thật (có CSP), với camera giả của Chromium. */
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}/lup-machine/`,
    trace: 'retain-on-failure',
    permissions: ['camera'],
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
        },
      },
    },
  ],
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/lup-machine/`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
