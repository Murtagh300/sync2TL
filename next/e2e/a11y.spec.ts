import AxeBuilder from '@axe-core/playwright'
import { test, expect } from './fixtures'

/**
 * Accessibility: axe on the main screens. Serious and critical problems fail the test; the rest
 * is printed. Color contrast is checked too: the dark theme has to stay readable.
 */
const screens = ['/#/', '/#/nfts', '/#/activities', '/#/more', '/#/settings', '/#/contacts', '/#/notifications', '/#/security', '/#/swap', '/#/send?wid=1&i=0', '/#/watchlist', '/#/payments']

for (const url of screens) {
    test(`no serious accessibility problems on ${url}`, async ({ page }) => {
        await page.goto(url)
        // let the screen settle (transitions, lazy parts)
        await page.waitForLoadState('networkidle')
        await page.waitForTimeout(800)
        const results = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
            .analyze()
        const bad = results.violations.filter(v => v.impact === 'serious' || v.impact === 'critical')
        for (const v of results.violations) {
            console.log(`[${v.impact}] ${url} ${v.id}: ${v.help} (${v.nodes.length}) ${v.nodes.slice(0, 2).map(n => n.target.join(' ')).join(' | ')}`)
        }
        expect(bad.map(v => `${v.id}: ${v.help}`)).toEqual([])
    })
}
