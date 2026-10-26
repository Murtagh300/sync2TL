import { test, expect } from './fixtures'

/**
 * Screenshots of the main screens, compared with the ones in e2e/visual.spec.ts-snapshots/.
 * Only with VISUAL=1: fonts render differently per platform, so the references are made on
 * one machine (npm run e2e:visual -- --update-snapshots) and checked there.
 */
test.skip(!process.env.VISUAL, 'screenshots only with VISUAL=1')

for (const [name, url] of [['home', '/#/'], ['more', '/#/more'], ['settings', '/#/settings']] as const) {
    test(`looks the same: ${name}`, async ({ page }) => {
        await page.goto(url)
        await page.waitForLoadState('networkidle')
        await page.waitForTimeout(800)
        await expect(page).toHaveScreenshot(`${name}.png`, {
            fullPage: true,
            animations: 'disabled',
            // balances, addresses and times differ per run
            mask: [page.locator('.bvm-amount'), page.getByText(/0x[0-9a-f]{4}/i)],
            maxDiffPixelRatio: 0.01
        })
    })
}
