import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end tests (e2e/): the wallet in a real browser against the dev server.
 * - onboarding, navigation, remote config and accessibility (axe) always run;
 * - screenshots only with VISUAL=1 (they depend on fonts and the platform);
 * - the testnet test only with TESTNET_MNEMONIC set, and only ever on testnet.
 * Outside services are stubbed (e2e/fixtures.ts): the tests don't depend on them.
 */
const PORT = Number(process.env.E2E_PORT || 8090)

export default defineConfig({
    testDir: 'e2e',
    timeout: 60 * 1000,
    expect: { timeout: 10 * 1000 },
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
    use: {
        baseURL: `http://127.0.0.1:${PORT}`,
        locale: 'en-US',
        trace: 'retain-on-failure',
        serviceWorkers: 'block'
    },
    projects: [
        { name: 'setup', testMatch: /wallet\.setup\.ts/ },
        {
            name: 'chromium',
            use: { ...devices['Pixel 7'], storageState: 'e2e/.auth/wallet.json' },
            dependencies: ['setup'],
            testIgnore: /wallet\.setup\.ts/
        }
    ],
    webServer: {
        command: 'npx quasar dev',
        url: `http://127.0.0.1:${PORT}`,
        reuseExistingServer: !process.env.CI,
        timeout: 180 * 1000,
        env: { BROWSER: 'none' }
    }
})
