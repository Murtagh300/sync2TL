import { test as base, expect, type Page, type BrowserContext } from '@playwright/test'

/** what the BlackVault server answers in a test; null: there is no server */
export type ServerStub = {
    config?: Record<string, unknown> | null
    health?: Record<string, unknown> | null
}

/**
 * Nothing leaves the machine: outside hosts are refused, and the dev proxies to BlackVeMarket,
 * BetterSwap and the BlackVault server get canned answers. The wallet has to cope with services
 * being away anyway; the tests check that it does.
 */
export async function isolate(context: BrowserContext, server: ServerStub = {}) {
    await context.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, route => route.abort('blockedbyclient'))
    await context.route(/\/(bvm-api|betterswap-api)\//, route => route.fulfill({ status: 503, json: { error: 'stubbed' } }))
    await context.route(/\/srv\//, route => {
        const path = new URL(route.request().url()).pathname.replace(/^\/srv/, '')
        if (path === '/config' && server.config) return route.fulfill({ json: server.config })
        if (path === '/health' && server.health) return route.fulfill({ json: server.health })
        return route.fulfill({ status: 404, json: { error: 'no server' } })
    })
}

export const test = base.extend<{ server: ServerStub }>({
    server: [{}, { option: true }],
    context: async ({ context, server }, use) => {
        await isolate(context, server)
        await use(context)
    }
})

export { expect }

/** the wallet is ready: the home screen shows */
export async function openHome(page: Page) {
    await page.goto('/#/')
    await expect(page.getByRole('button', { name: /send/i }).first()).toBeVisible()
}

export const PASSWORD = 'e2e-only-password-1'
