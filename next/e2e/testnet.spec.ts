import { test, expect } from '@playwright/test'
import { PASSWORD } from './fixtures'

/**
 * A real transaction, on testnet only: import a funded test wallet, send 0.001 VET to itself,
 * and wait for the receipt. Runs only when TESTNET_MNEMONIC is set (a CI secret; get test VET
 * from https://faucet.vecha.in). Never mainnet:
 * - every request to a host with "mainnet" in its name is refused in this browser;
 * - the wallet is imported on the Testnet network, and the send page must say Testnet before
 *   anything is signed.
 */
const words = process.env.TESTNET_MNEMONIC || ''
test.skip(!words, 'needs TESTNET_MNEMONIC (a funded testnet wallet)')
test.setTimeout(3 * 60 * 1000)

test('send 0.001 VET to itself on testnet', async ({ page, context }) => {
    await context.route(/mainnet/i, route => route.abort('blockedbyclient'))
    await context.route(/\/(srv|bvm-api|betterswap-api)\//, route => route.fulfill({ status: 503, json: {} }))

    // import on testnet
    await page.goto('/#/new-wallet')
    await page.getByRole('button', { name: 'More options' }).click()
    await page.getByText('Testnet', { exact: true }).click()
    await page.getByLabel('Wallet name').fill('E2E testnet')
    await page.getByText('Import recovery words').click()
    await page.locator('textarea').fill(words)
    await page.getByRole('dialog').getByRole('button', { name: 'OK' }).click()
    await page.locator('input[type=password]').fill(PASSWORD)
    await page.getByRole('dialog').getByRole('button', { name: 'Unlock' }).click()
    await page.waitForURL(/#\/$/)

    // the new wallet is the second one (the setup made the first)
    await page.goto('/#/w/2/0')
    await page.getByRole('button', { name: 'Receive' }).first().click()
    const sheet = page.getByRole('dialog').filter({ hasText: /0x[0-9a-fA-F]{40}/ })
    const me = (await sheet.innerText()).match(/0x[0-9a-fA-F]{40}/)![0]
    await page.keyboard.press('Escape')

    await page.goto(`/#/send?wid=2&i=0&symbol=VET&to=${me}&amount=0.001`)
    await expect(page.getByText('Testnet', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Send', exact: true }).click()

    // the transaction dialog: once more, this is testnet, then sign with the password
    const tx = page.getByRole('dialog').last()
    await expect(tx).toContainText(/testnet/i)
    await tx.getByRole('button', { name: 'Sign', exact: true }).click()
    const unlock = page.getByRole('dialog').filter({ has: page.locator('input[type=password]') })
    await unlock.locator('input[type=password]').fill(PASSWORD)
    await unlock.getByRole('button', { name: 'Unlock' }).click()

    // sent; the activity has it, then the chain confirms it
    await expect(page.getByText(/sent|submitted/i).first()).toBeVisible({ timeout: 60 * 1000 })
    await page.goto('/#/activities')
    await expect(page.getByText(/confirmed|0\.001/i).first()).toBeVisible({ timeout: 90 * 1000 })
})
