/**
 * Settings from the environment, checked once at start. Anything missing that a feature needs
 * turns that feature off (and says so in the log) instead of failing later.
 */

const list = (v: string | undefined) => (v || '').split(',').map(s => s.trim()).filter(Boolean)
const int = (v: string | undefined, fallback: number) => {
    const n = parseInt(v || '', 10)
    return Number.isFinite(n) && n > 0 ? n : fallback
}

export type Config = {
    port: number
    /** origins the wallet is served from; CORS answers only these */
    allowedOrigins: string[]
    /** trust X-Forwarded-For from the reverse proxy in front (Caddy) for rate limits */
    trustProxy: boolean
    betterswapUrl: string
    bvmUrl: string
    /** mainnet nodes, first one preferred */
    mainnetNodes: string[]
    dbPath: string
    flagsFile: string
    vapid: { publicKey: string, privateKey: string, subject: string } | null
    /** for reading error reports (GET /errors); empty: no reading */
    adminToken: string
    /** requests per minute per IP, for the gateway and for writes */
    rateLimit: { gateway: number, writes: number }
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
    const vapidPublic = env.VAPID_PUBLIC_KEY || ''
    const vapidPrivate = env.VAPID_PRIVATE_KEY || ''
    return {
        port: int(env.PORT, 8787),
        allowedOrigins: list(env.ALLOWED_ORIGINS || 'http://localhost:8090'),
        trustProxy: env.TRUST_PROXY === '1',
        betterswapUrl: (env.BETTERSWAP_URL || 'https://www.betterswap.io/api').replace(/\/$/, ''),
        bvmUrl: (env.BVM_URL || 'https://blackvemarket.com/api').replace(/\/$/, ''),
        mainnetNodes: list(env.MAINNET_NODES || 'https://mainnet.vechain.org,https://mainnet.vecha.in'),
        dbPath: env.DB_PATH || './data/blackvault.db',
        flagsFile: env.FLAGS_FILE || './flags.json',
        vapid: vapidPublic && vapidPrivate
            ? { publicKey: vapidPublic, privateKey: vapidPrivate, subject: env.VAPID_SUBJECT || 'mailto:support@blackvemarket.com' }
            : null,
        adminToken: env.ADMIN_TOKEN || '',
        rateLimit: { gateway: int(env.RATE_GATEWAY, 240), writes: int(env.RATE_WRITES, 30) }
    }
}
