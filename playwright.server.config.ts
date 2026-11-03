import { defineConfig, devices } from '@playwright/test'

const port = 3100
const apiPort = 3101
const baseURL = `http://127.0.0.1:${port}`

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: ['card.spec.ts', 'checkout.spec.ts'],
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL,
    viewport: { width: 1280, height: 900 },
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'bash scripts/e2e-server.sh',
    url: baseURL,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      E2E_APP_PORT: String(port),
      E2E_API_PORT: String(apiPort),
    },
  },
})
