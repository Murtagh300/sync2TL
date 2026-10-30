import { test, expect, openHome } from './fixtures'

test('the home screen shows the wallet and its address', async ({ page }) => {
    await openHome(page)
    await expect(page.getByText('My Wallet', { exact: true })).toBeVisible()
    await expect(page.getByText(/0x[0-9a-f]{4}/i).first()).toBeVisible()
})

test('the tabs lead to every main screen', async ({ page }) => {
    await openHome(page)
    for (const [tab, url] of [['NFTs', /#\/nfts/], ['Activity', /#\/activities/], ['More', /#\/more/], ['Home', /#\/$/]] as const) {
        await page.getByRole('navigation').getByText(tab, { exact: true }).click()
        await expect(page).toHaveURL(url)
    }
})

test('the wallet opens from home', async ({ page }) => {
    await openHome(page)
    await page.getByRole('button', { name: 'Open my wallet' }).click()
    await expect(page).toHaveURL(/#\/w\/1\/0$/)
    await expect(page.getByRole('tab', { name: 'Tokens' })).toBeVisible()
})

test('receive shows a QR code and the full address', async ({ page }) => {
    await openHome(page)
    await page.getByRole('button', { name: 'Open my wallet' }).click()
    await page.getByRole('button', { name: /receive/i }).first().click()
    const sheet = page.getByRole('dialog').filter({ hasText: /0x[0-9a-fA-F]{40}/ })
    await expect(sheet).toBeVisible()
    await expect(sheet.locator('svg').first()).toBeVisible()
})

test('settings: preferences stick after a reload', async ({ page }) => {
    await page.goto('/#/settings')
    const vibrate = page.getByRole('switch', { name: 'Vibrate on actions' })
    const before = await vibrate.getAttribute('aria-checked')
    await vibrate.click()
    await expect(vibrate).not.toHaveAttribute('aria-checked', before!)
    await page.reload()
    await expect(page.getByRole('switch', { name: 'Vibrate on actions' })).not.toHaveAttribute('aria-checked', before!)
})

test('storage is migrated to the current schema', async ({ page }) => {
    await openHome(page)
    expect(Number(await page.evaluate(() => localStorage.getItem('bv-schema')))).toBeGreaterThanOrEqual(2)
})
