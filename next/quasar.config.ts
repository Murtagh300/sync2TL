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

export default defineConfig(() => {
    return {
        boot: ['i18n'],

        css: ['app.sass'],

        extras: ['roboto-font', 'material-icons'],

        build: {
            target: {
                browser: ['es2022', 'firefox115', 'chrome115', 'safari14']
            },

            typescript: {
                strict: true,
                vueShim: true,
                extendTsConfig(tsConfig) {
                    // not used by the ported Sync2 code base; revisit once phase 4 is done
                    tsConfig.compilerOptions!.exactOptionalPropertyTypes = false
                    tsConfig.compilerOptions!.noUncheckedIndexedAccess = false
                }
            },

            vueRouterMode: 'hash',

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
                GA_ID: process.env.GA_ID || ''
            },

            vitePlugins: [
                // thor-devkit and connex expect Node's Buffer/crypto/process in the browser
                [nodePolyfills, {
                    globals: { Buffer: true, global: true, process: true },
                    protocolImports: true
                }]
            ]
        },

        devServer: {
            port: 8090,
            open: false
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
            plugins: ['Dialog', 'Notify']
        },

        animations: [],

        pwa: {
            workboxMode: 'GenerateSW',
            extendPWAGenerateSWOptions(cfg) {
                cfg.skipWaiting = true
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
