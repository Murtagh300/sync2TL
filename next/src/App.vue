<template>
    <router-view class="fit" />
</template>

<script lang="ts">
import { defineComponent } from 'vue'
// Geist, the typeface of blackvemarket.com, bundled (no font CDN for a wallet)
import '@fontsource-variable/geist'
import { listen } from 'src/utils/external-url'
import { checkAlerts, notifySystem } from 'src/utils/alerts'
import dayjs from 'dayjs'
// import more locales here
import 'dayjs/locale/zh-cn'

/**
 * parse connex request url and return the request src
 * the incoming url looks like connex:sign?src=xxx, or https://<wallet host>/#/sign?src=xxx
 */
function parseConnexURL(urlStr: string) {
    try {
        // normalize for easily parsing
        if (urlStr.startsWith('https')) {
            urlStr = urlStr.replace('/#', '')
        }
        const url = new URL(urlStr)
        if ((url.protocol === 'connex:' && url.pathname === 'sign') ||
            (url.protocol === 'https:' && url.pathname === '/sign')
        ) {
            return url.searchParams.get('src')
        }
    } catch (err) {
        console.warn(err)
    }
    return null
}

export default defineComponent({
    data: () => ({
        destroyed: false,
        alertTimer: 0 as ReturnType<typeof setInterval> | 0,
        // async computed (see src/shims-async-computed.d.ts)
        lang: null as string | null
    }),
    asyncComputed: {
        lang(): Promise<string> {
            return this.$svc.config.getLanguage()
        }
    },
    watch: {
        // watch the language setting change
        lang(newVal: string | null) {
            // if language not set (auto), use the navigator lang when there is a translation for it
            const wanted = (newVal || navigator.language).toLowerCase()
            const lang = this.$i18n.availableLocales.includes(wanted)
                ? wanted
                : wanted.startsWith('zh') ? 'zh-cn' : 'en-us'
            this.$i18n.locale = lang

            // should set to default first
            dayjs.locale('en')
            dayjs.locale(lang)
        }
    },
    methods: {
        async runAlerts() {
            try {
                const fired = await checkAlerts(this.$svc, (key, params) => this.$t(key, params ?? {}))
                for (const m of fired) {
                    this.$q.notify({
                        message: m.text,
                        icon: 'o_notifications',
                        timeout: 8000,
                        actions: [{ label: this.$t('watchlist.title'), color: 'primary', handler: () => { void this.$router.push({ name: 'watchlist' }) } }]
                    })
                    notifySystem(m.text)
                }
            } catch (err) {
                console.warn('alerts:', err)
            }
        },
        async externalSignHandlerLoop() {
            // eslint-disable-next-line no-unmodified-loop-condition
            while (!this.destroyed) {
                const src = parseConnexURL(await listen())
                if (src) {
                    if (this.$route.name === 'sign') {
                        void this.$router.replace({ name: 'sign', query: { src } })
                    } else {
                        void this.$router.push({ name: 'sign', query: { src } })
                    }
                }
            }
        }
    },
    created() {
        console.log(`[BlackVault] v${import.meta.env.APP_VERSION} (${import.meta.env.APP_BUILD})`)
        void this.externalSignHandlerLoop()
        // price alerts and new offers, while BlackVault is open
        setTimeout(() => void this.runAlerts(), 15 * 1000)
        this.alertTimer = setInterval(() => void this.runAlerts(), 5 * 60 * 1000)
        // the desktop (phase 5) and native (phase 6) apps report updates and style
        // the status bar here; the PWA reports updates from src-pwa/register-sw.ts
    },
    beforeUnmount() {
        this.destroyed = true
        this.alertTimer && clearInterval(this.alertTimer)
    }
})
</script>
