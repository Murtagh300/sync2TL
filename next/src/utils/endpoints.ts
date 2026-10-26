/**
 * Where the wallet's data comes from, in one place.
 *
 * - The BlackVault server (server/): set SERVER_URL at build time ('/' when it is on the same
 *   origin, behind Caddy). In development it runs on :8787 behind the dev proxy (/srv).
 *   Without one, the wallet still works: it reads the public APIs directly.
 * - With a server, BetterSwap and BlackVeMarket's public data go through its gateway (CORS,
 *   cache, rate limits). What needs a BlackVeMarket session or a signature (sign-in, its push,
 *   fee delegation) always goes to BlackVeMarket itself.
 */

const env = import.meta.env
const dev = !!env.QUASAR_DEV

/** the server's base URL ('' is the same origin); null when there is none */
export const serverUrl: string | null = (() => {
    const v = env.SERVER_URL
    if (v === '/') return ''
    if (v) return v.replace(/\/$/, '')
    return dev ? '/srv' : null
})()

/** BlackVeMarket for what needs its session or a signature */
export const bvmDirectUrl: string = env.BVM_API_URL || (dev ? '/bvm-api' : 'https://blackvemarket.com/api')

/** BlackVeMarket's public data */
export const bvmPublicUrl: string = serverUrl !== null && !dev ? `${serverUrl}/api/bvm` : bvmDirectUrl

/** BetterSwap (prices, tokens, pools) */
export const betterswapUrl: string = env.BETTERSWAP_API_URL ||
    (serverUrl !== null && !dev ? `${serverUrl}/api/betterswap` : dev ? '/betterswap-api' : 'https://www.betterswap.io/api')
