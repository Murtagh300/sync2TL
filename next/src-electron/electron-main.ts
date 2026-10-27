import { app, BrowserWindow, ipcMain, Menu, net, session, shell, type IpcMainEvent, type IpcMainInvokeEvent } from 'electron'
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import electronUpdater from 'electron-updater'

/**
 * BlackVault's desktop app.
 *
 * The app runs as https://wallet.blackvemarket.com: requests to that host are answered from the
 * files inside the app, except the server's paths (/api, /relay, …), which go to the network. So
 * it has the same origin as the web wallet for the server, WalletConnect and BlackVeMarket, while
 * its code never comes from the network. Its storage is its own (Electron's profile), apart from
 * any browser.
 *
 * dApps reach it with blackvault: links (connect.js), and with connex: links like Sync2's desktop
 * app when no other app has those.
 */

const HOST = 'wallet.blackvemarket.com'
const ORIGIN = `https://${HOST}`
// the paths Caddy sends to the server (deploy/Caddyfile)
const SERVER_PATH = /^\/(api|push|relay)\/|^\/(health|status|config|errors)$/
const SCHEMES = ['blackvault', 'connex']
// as deploy/Caddyfile
const CSP = "default-src 'self'; script-src 'self'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; media-src 'self' blob: https:; font-src 'self' data:; connect-src 'self' https: wss:; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none'; frame-ancestors 'none'"
const MIME: Record<string, string> = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
    '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.gif': 'image/gif',
    '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.wasm': 'application/wasm', '.txt': 'text/plain'
}

const dev = !!import.meta.env.QUASAR_DEV
const debug = !!import.meta.env.QUASAR_DEBUG
const appUrl = dev ? new URL(import.meta.env.QUASAR_APP_URL) : new URL(`${ORIGIN}/index.html`)

let win: BrowserWindow | null = null
// links that arrive before the page listens
let pending: string[] = []
let listening = false

const linkIn = (argv: string[]) => argv.find(a => SCHEMES.some(s => a.toLowerCase().startsWith(`${s}:`)))

function deliver(url: string | undefined) {
    if (!url || url.length > 4096) return
    if (listening && win) win.webContents.send('external-url', url)
    else pending.push(url)
    showWindow()
}

function showWindow() {
    if (!win) return
    if (win.isMinimized()) win.restore()
    win.show()
    win.focus()
}

/** only web pages leave the app, in the user's browser */
function openExternal(url: string) {
    try {
        const u = new URL(url)
        if (u.protocol === 'https:' || u.protocol === 'http:') void shell.openExternal(u.href)
    } catch { }
}

const fromApp = (url: string | undefined) => {
    try {
        return !!url && new URL(url).origin === appUrl.origin
    } catch {
        return false
    }
}
const senderOk = (e: IpcMainEvent | IpcMainInvokeEvent) => fromApp(e.senderFrame?.url)

/** the app's files for its own host, the network for everything else */
function serveApp() {
    const root = app.getAppPath()
    session.defaultSession.protocol.handle('https', async req => {
        const url = new URL(req.url)
        if (url.host !== HOST) {
            return net.fetch(req, { bypassCustomProtocolHandlers: true })
        }
        if (SERVER_PATH.test(url.pathname)) {
            // the page's Origin is lost on the way through here; these come from the app's own page,
            // so they carry its origin, as a browser sends it (the relay shows it, CORS checks it)
            const headers = new Headers(req.headers)
            headers.set('origin', ORIGIN)
            const hasBody = req.method !== 'GET' && req.method !== 'HEAD'
            return net.fetch(req.url, {
                method: req.method,
                headers,
                body: hasBody ? await req.arrayBuffer() : undefined,
                bypassCustomProtocolHandlers: true
            })
        }
        let rel = decodeURIComponent(url.pathname)
        if (rel === '/') rel = '/index.html'
        const file = path.join(root, path.normalize(rel))
        if (!file.startsWith(root + path.sep) || !existsSync(file) || !statSync(file).isFile()) {
            return new Response('not found', { status: 404, headers: { 'content-type': 'text/plain' } })
        }
        const res = await net.fetch(pathToFileURL(file).href)
        return new Response(res.body, {
            status: 200,
            headers: {
                'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
                'content-security-policy': CSP,
                'x-content-type-options': 'nosniff',
                'cache-control': 'no-cache'
            }
        })
    })
}

/** camera (QR codes), the clipboard and notifications, for the app only */
function permissions() {
    const allowed = ['media', 'clipboard-sanitized-write', 'notifications', 'fullscreen']
    session.defaultSession.setPermissionRequestHandler((_wc, permission, callback, details) => {
        const media = details as { mediaTypes?: string[] }
        callback(allowed.includes(permission) && fromApp(details.requestingUrl) && !media.mediaTypes?.includes('audio'))
    })
    session.defaultSession.setPermissionCheckHandler((_wc, permission, origin) => allowed.includes(permission) && fromApp(origin))
}

const boundsFile = () => path.join(app.getPath('userData'), 'window.json')
function savedBounds(): { width: number, height: number, x?: number, y?: number } {
    try {
        const b = JSON.parse(readFileSync(boundsFile(), 'utf8'))
        if (b.width >= 380 && b.height >= 600) return b
    } catch { }
    return { width: 1100, height: 780 }
}

async function createWindow() {
    win = new BrowserWindow({
        ...savedBounds(),
        minWidth: 380,
        minHeight: 600,
        show: false,
        title: 'BlackVault',
        backgroundColor: '#0b0b0c',
        autoHideMenuBar: true,
        icon: path.join(app.getAppPath(), dev ? '../../../src-electron/electron-assets' : 'electron-assets', 'icons/icon.png'),
        webPreferences: {
            preload: path.join(import.meta.dirname, 'electron-preload.cjs'),
            contextIsolation: true,
            sandbox: true,
            nodeIntegration: false,
            webSecurity: true,
            spellcheck: false,
            devTools: dev || debug
        }
    })
    win.once('ready-to-show', () => win?.show())
    win.on('close', () => {
        try {
            if (win && !win.isMaximized() && !win.isMinimized()) writeFileSync(boundsFile(), JSON.stringify(win.getBounds()))
        } catch { }
    })
    win.on('closed', () => {
        win = null
        listening = false
    })
    await win.loadURL(appUrl.href)
    if (dev || debug) win.webContents.openDevTools({ mode: 'detach' })
}

function guardContents() {
    app.on('web-contents-created', (_e, wc) => {
        // the app never navigates away or opens windows: links go to the browser
        wc.on('will-navigate', (e, url) => {
            if (!fromApp(url)) {
                e.preventDefault()
                openExternal(url)
            }
        })
        wc.setWindowOpenHandler(({ url }) => {
            openExternal(url)
            return { action: 'deny' }
        })
        wc.on('will-attach-webview', e => e.preventDefault())
    })
}

function registerSchemes() {
    // the installed app only: in development this would register Electron itself
    if (!app.isPackaged) return
    for (const scheme of SCHEMES) {
        // connex: belongs to Sync2's desktop app when that is installed: leave it
        const owner = app.getApplicationNameForProtocol(`${scheme}://`)
        if (scheme === 'connex' && owner && !app.isDefaultProtocolClient(scheme)) continue
        app.setAsDefaultProtocolClient(scheme)
    }
}

/** updates from GitHub Releases, downloaded in the background; installed when the user says so */
function updates() {
    if (!app.isPackaged) return
    const { autoUpdater } = electronUpdater
    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = true
    autoUpdater.on('update-downloaded', info => win?.webContents.send('update-ready', info.version))
    autoUpdater.on('error', err => console.warn('[update]', err?.message || err))
    const check = () => void autoUpdater.checkForUpdates().catch(err => console.warn('[update]', err?.message || err))
    setTimeout(check, 10 * 1000)
    setInterval(check, 6 * 60 * 60 * 1000)
    ipcMain.handle('install-update', e => {
        if (senderOk(e)) autoUpdater.quitAndInstall()
    })
}

function ipc() {
    ipcMain.on('external-url-ready', e => {
        if (!senderOk(e)) return
        listening = true
        const urls = pending
        pending = []
        for (const url of urls) e.sender.send('external-url', url)
    })
}

function menu() {
    // macOS needs a menu for copy and paste; elsewhere the app has none
    Menu.setApplicationMenu(process.platform === 'darwin'
        ? Menu.buildFromTemplate([{ role: 'appMenu' }, { role: 'editMenu' }, { role: 'windowMenu' }])
        : null)
}

if (!app.requestSingleInstanceLock()) {
    // a link opened a second copy: the first one gets it (second-instance) and this one ends
    app.quit()
} else {
    app.on('second-instance', (_e, argv) => {
        const url = linkIn(argv)
        if (url) deliver(url)
        else showWindow()
    })
    // macOS hands links over this way
    app.on('open-url', (e, url) => {
        e.preventDefault()
        deliver(url)
    })
    const first = linkIn(process.argv)
    if (first) pending.push(first)

    guardContents()
    void app.whenReady().then(async () => {
        if (!dev) serveApp()
        permissions()
        menu()
        ipc()
        registerSchemes()
        await createWindow()
        updates()
        app.on('activate', () => {
            if (!win) void createWindow()
        })
    })

    app.on('window-all-closed', () => {
        if (process.platform !== 'darwin') app.quit()
    })
}
