// Configuration for your app
// https://v2.quasar.dev/quasar-cli-vite/quasar-config-file

import { defineConfig } from '#q-app'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

const srcDir = (sub: string) => fileURLToPath(new URL(`./src/${sub}`, import.meta.url))
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))
const appBuild = execSync('git --no-pager log -n 1 --date=short --pretty="%ad.%h"')
    .toString('utf8')
    .replace(/-/g, '.')
    .trim()

// '' (no server), '/' (same origin) or an http(s) address. Git Bash on Windows turns a bare '/' into
// its own install folder: set MSYS_NO_PATHCONV=1 there, or the build stops here.
const serverUrl = process.env.SERVER_URL || ''
if (serverUrl && serverUrl !== '/' && !/^https?:\/\/[^\s]+$/.test(serverUrl)) {
    throw new Error(`SERVER_URL must be '/', an http(s) address or empty, not "${serverUrl}"`)
}

export default defineConfig(() => {
    return {
        boot: ['i18n', 'axios', 'misc', 'directives', 'services'],

        css: ['app.sass'],

        extras: ['material-icons', 'material-icons-outlined'],

        build: {
            target: {
                browser: ['es2022', 'firefox115', 'chrome115', 'safari14']
            },

            typescript: {
                strict: true,
                vueShim: true,
                extendTsConfig(tsConfig) {
                    // an index into an array or a record may be undefined: say so (and check)
                    tsConfig.compilerOptions!.noUncheckedIndexedAccess = true
                    tsConfig.compilerOptions!.noFallthroughCasesInSwitch = true
                    // not used by the ported Sync2 code base
                    tsConfig.compilerOptions!.exactOptionalPropertyTypes = false
                }
            },

            vueRouterMode: 'hash',

            // the ported Sync2 components use the Options API (data, methods, mixins)
            vueOptionsAPI: true,

            // the import prefixes used throughout the Sync2 code base
            alias: {
                src: srcDir(''),
                assets: srcDir('assets'),
                boot: srcDir('boot'),
                components: srcDir('components'),
                core: srcDir('core'),
                layouts: srcDir('layouts'),
                pages: srcDir('pages')
            },

            // exposed as import.meta.env.*
            defineEnv: {
                APP_VERSION: pkg.version,
                APP_BUILD: appBuild,
                DIST_TAG: process.env.DIST_TAG || '',
                // analytics only when a measurement id is supplied at build time (GA_ID=G-XXXX)
                GA_ID: process.env.GA_ID || '',
                // the BlackVeMarket API; needs CORS for the wallet's origin (see README)
                BVM_API_URL: process.env.BVM_API_URL || '',
                // BetterSwap prices; it sends no CORS headers, so a build points this at a proxy
                BETTERSWAP_API_URL: process.env.BETTERSWAP_API_URL || '',
                // WalletConnect (Reown) project id; without it the app asks for one (Meer › WalletConnect)
                WALLETCONNECT_PROJECT_ID: process.env.WALLETCONNECT_PROJECT_ID || '',
                // the BlackVault server (server/): '/' on the same origin (deploy/), empty for none;
                // with one, public BetterSwap/BlackVeMarket data goes through its gateway (utils/endpoints.ts)
                SERVER_URL: serverUrl
            },

            extendViteConf(viteConf) {
                // thor-devkit and connex expect Node's Buffer/crypto/process in the browser
                // (added here: nodePolyfills returns several plugins, vitePlugins expects one)
                viteConf.plugins = [
                    ...(viteConf.plugins || []),
                    nodePolyfills({
                        globals: { Buffer: true, global: true, process: true },
                        protocolImports: true
                    })
                ]
            }
        },

        devServer: {
            port: 8090,
            open: false,
            // BlackVeMarket and BetterSwap send no CORS headers; proxy them in development
            proxy: {
                // the BlackVault server, when it runs locally (cd server && npm run dev)
                '/srv': {
                    target: process.env.DEV_SERVER_TARGET || 'http://localhost:8787',
                    changeOrigin: true,
                    rewrite: (path: string) => path.replace(/^\/srv/, ''),
                    // same origin as far as the server knows, as behind Caddy in production
                    configure: (proxy: { on(ev: 'proxyReq', fn: (req: { removeHeader(name: string): void }) => void): void }) => {
                        proxy.on('proxyReq', req => req.removeHeader('origin'))
                    }
                },
                '/betterswap-api': {
                    target: 'https://www.betterswap.io/api',
                    changeOrigin: true,
                    rewrite: (path: string) => path.replace(/^\/betterswap-api/, '')
                },
                '/bvm-api': {
                    target: 'https://blackvemarket.com/api',
                    changeOrigin: true,
                    rewrite: (path: string) => path.replace(/^\/bvm-api/, ''),
                    // the sign-in cookie belongs to blackvemarket.com; keep it on localhost in development
                    cookieDomainRewrite: ''
                }
            }
        },

        framework: {
            config: {
                dark: true,
                loadingBar: {
                    skipHijack: true
                }
            },
            iconSet: 'material-icons',
            lang: 'en-US',
            plugins: ['Dialog', 'Notify', 'BottomSheet']
        },

        animations: [],

        pwa: {
            workboxMode: 'GenerateSW',
            extendPWAGenerateSWOptions(cfg) {
                // a new version waits until the user taps Update (src/utils/app-update.ts)
                cfg.skipWaiting = false
                // push messages from BlackVeMarket (public/push-sw.js)
                cfg.importScripts = ['push-sw.js']
                cfg.clientsClaim = true
                cfg.runtimeCaching = [{
                    urlPattern: /^https:\/\/vechain.github.io\/token-registry\/assets\//,
                    handler: 'CacheFirst',
                    options: {
                        cacheName: 'token-icons',
                        cacheableResponse: { statuses: [0, 200] }
                    }
                }]
            }
        }
    }
})
