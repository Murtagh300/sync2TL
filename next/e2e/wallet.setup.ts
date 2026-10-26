import { test as setup, expect } from '@playwright/test'
import { isolate, PASSWORD } from './fixtures'

/**
 * Onboarding, once: a new wallet with a test password (it only exists in this browser profile
 * and holds nothing). The other tests start from the result, IndexedDB included.
 */
setup('create a wallet', async ({ page, context }) => {
    await isolate(context)
    await page.goto('/')

    // the disclaimer comes first
    await page.getByRole('checkbox').click()
    await page.getByRole('dialog').getByRole('button', { name: 'Continue' }).click()

    await page.getByRole('button', { name: 'Create my wallet' }).click()
    await page.locator('input[type=password]').fill(PASSWORD)
    await page.getByRole('button', { name: 'Next' }).click()
    await page.locator('input[type=password]').fill(PASSWORD)
    await page.getByRole('button', { name: 'Confirm' }).click()

    // keys are derived and encrypted: this takes a few seconds
    await expect(page.getByText('Your wallet is ready.')).toBeVisible({ timeout: 45 * 1000 })
    // the backup is offered right away; later is fine for a test wallet
    await page.getByRole('dialog').getByRole('button', { name: 'close' }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await page.getByRole('button', { name: 'Next' }).click()
    await page.getByRole('button', { name: 'Skip and finish' }).click()

    await expect(page.getByText('My Wallet')).toBeVisible()
    await context.storageState({ path: 'e2e/.auth/wallet.json', indexedDB: true })
})
