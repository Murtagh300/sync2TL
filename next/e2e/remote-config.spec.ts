import { test, expect, openHome } from './fixtures'

const features = { walletconnect: true, swap: false, payout: true, dust: true, consolidate: true, stargate: true, vebetter: true, launchpad: false, push: true }

test.describe('with a BlackVault server', () => {
    test.use({
        server: {
            config: { version: 3, features, notice: { level: 'warning', text: { en: 'Maintenance tonight at 22:00' } }, minVersion: '0.0.0' },
            health: { ok: false, at: new Date().toISOString(), checks: [{ name: 'node 1 (a)', ok: true }, { name: 'BetterSwap', ok: false }] }
        }
    })

    test('a notice shows, and can be closed', async ({ page }) => {
        await openHome(page)
        const bar = page.getByRole('status').filter({ hasText: 'Maintenance tonight' })
        await expect(bar).toBeVisible()
        await bar.getByRole('button', { name: 'Close' }).click()
        await expect(bar).toBeHidden()
        // then the next thing to say: a service that is down
        await expect(page.getByRole('status').filter({ hasText: 'BetterSwap' })).toBeVisible()
    })

    test('a paused feature is not offered and can not be opened', async ({ page }) => {
        await openHome(page)
        await expect(page.getByRole('navigation').getByText('Swap', { exact: true })).toHaveCount(0)
        await page.goto('/#/launchpad')
        await expect(page).toHaveURL(/#\/more\?paused=launchpad/)
        await expect(page.getByText('This part of BlackVault is paused')).toBeVisible()
    })
})

test.describe('with an old version', () => {
    test.use({ server: { config: { version: 3, features: {}, notice: null, minVersion: '999.0.0' } } })

    test('asks to update', async ({ page }) => {
        await openHome(page)
        await expect(page.getByRole('status').filter({ hasText: 'out of date' })).toBeVisible()
        await expect(page.getByRole('button', { name: 'Update' })).toBeVisible()
    })
})

test('without a server everything is on and nothing shows', async ({ page }) => {
    await openHome(page)
    await expect(page.getByRole('navigation').getByText('Swap', { exact: true })).toBeVisible()
    await expect(page.locator('.service-bar')).toHaveCount(0)
})
