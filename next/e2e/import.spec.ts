import { HDNode } from 'thor-devkit'
import { test, expect, PASSWORD } from './fixtures'

// the standard BIP-39 test phrase: a wallet everyone knows, so never one with value
const WORDS = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'

// a fresh browser: no wallet yet, so the start screen shows
test.use({ storageState: { cookies: [], origins: [] } })

test('a wallet can be restored from its recovery words on the start screen', async ({ page }) => {
    const expected = HDNode.fromMnemonic(WORDS.split(' ')).derive(0).address.toLowerCase()

    await page.goto('/')
    await page.getByRole('checkbox').click()
    await page.getByRole('dialog').getByRole('button', { name: 'Continue' }).click()

    await page.getByRole('button', { name: 'I already have a wallet' }).click()
    await page.locator('textarea').fill(WORDS)
    await page.getByRole('dialog').getByRole('button', { name: 'OK' }).click()

    await page.locator('input[type=password]').fill(PASSWORD)
    await page.getByRole('button', { name: 'Next' }).click()
    await page.locator('input[type=password]').fill(PASSWORD)
    await page.getByRole('button', { name: 'Confirm' }).click()

    await expect(page.getByText('Your wallet is ready.')).toBeVisible({ timeout: 45 * 1000 })
    // a restored wallet is not asked to be backed up again
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await page.getByRole('button', { name: 'Next' }).click()
    await page.getByRole('button', { name: 'Skip and finish' }).click()

    // the home screen shows the address those words belong to
    const short = new RegExp(`${expected.slice(0, 6)}.*${expected.slice(-6)}`, 'i')
    await expect(page.getByText(short).first()).toBeVisible()
})
