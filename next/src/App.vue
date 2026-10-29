<template>
    <router-view class="fit" />
</template>

<script lang="ts">
// first: stored settings are brought up to date before anything reads them
import 'src/utils/migrate-on-load'
import { defineComponent } from 'vue'
// Geist, the typeface of blackvemarket.com, bundled (no font CDN for a wallet)
import '@fontsource-variable/geist'
import { listen } from 'src/utils/external-url'
import { desktop } from 'src/utils/desktop'
import { checkAlerts, notifySystem } from 'src/utils/alerts'
import { notify as addNotification } from 'src/utils/notifications'
import { buyRoute, dueBuys, dueScheduled, payments, reachedLimits } from 'src/utils/payments'
import { dueReminders } from 'src/utils/launch-calendar'
import { genesises } from 'src/consts'
import { money } from 'src/utils/prefs'
import dayjs from 'dayjs'
import { setNumberLocale } from 'src/utils/format'
// import more locales here
import 'dayjs/locale/zh-cn'
import 'dayjs/locale/nl'
import 'dayjs/locale/de'
import 'dayjs/locale/fr'
import 'dayjs/locale/es'
import 'dayjs/locale/it'
import 'dayjs/locale/ja'
import 'dayjs/locale/ko'
import { nodeHealth, startNodeHealth } from 'src/utils/node-health'

/**
 * parse connex request url and return the request src
 * the incoming url looks like blackvault:sign?src=xxx, connex:sign?src=xxx, or https://<wallet host>/#/sign?src=xxx
 */
function parseConnexURL(urlStr: string) {
    try {
        // normalize for easily parsing
        if (urlStr.startsWith('https')) {
            urlStr = urlStr.replace('/#', '')
        }
        const url = new URL(urlStr)
        if (((url.protocol === 'connex:' || url.protocol === 'blackvault:') && url.pathname === 'sign') ||
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
                : wanted.startsWith('zh') ? 'zh-cn'
                    : wanted.startsWith('nl') ? 'nl-nl'
                        : wanted.startsWith('de') ? 'de-de'
                            : wanted.startsWith('fr') ? 'fr-fr'
                                : wanted.startsWith('es') ? 'es-es'
                                    : wanted.startsWith('it') ? 'it-it'
                                        : wanted.startsWith('ja') ? 'ja-jp'
                                            : wanted.startsWith('ko') ? 'ko-kr' : 'en-us'
            this.$i18n.locale = lang
            setNumberLocale(lang)
            desktop?.setLabels({
                open: this.$t('desktopApp.tray_open'),
                login: this.$t('desktopApp.label_login'),
                keep: this.$t('desktopApp.label_tray'),
                quit: this.$t('desktopApp.tray_quit'),
                inTray: this.$t('desktopApp.msg_in_tray')
            })

            // should set to default first
            dayjs.locale('en')
            // dayjs names these by language only
            dayjs.locale(({ 'nl-nl': 'nl', 'de-de': 'de', 'fr-fr': 'fr', 'es-es': 'es', 'it-it': 'it', 'ja-jp': 'ja', 'ko-kr': 'ko' } as Record<string, string>)[lang] || lang)
        }
    },
    methods: {
        async runAlerts() {
            for (const e of dueReminders()) {
                const text = this.$t('calendar.msg_starting', { name: e.name, phase: e.phase })
                addNotification({ id: `launch:${e.id}`, kind: 'alert', title: text, route: { name: 'launch', params: { slug: e.slug } } })
                this.$q.notify({ message: text, icon: 'o_rocket_launch', timeout: 10000 })
                notifySystem(text)
            }
            // recurring buys that are due, and limit buys whose price came
            for (const b of dueBuys()) {
                const text = this.$t('buys.msg_due', { amount: `${b.amount} ${b.from}`, symbol: b.to })
                addNotification({ id: `buy:${b.id}:${b.next}`, kind: 'alert', title: text, route: buyRoute(b) })
            }
            await this.checkLimitBuys()
            for (const s of dueScheduled()) {
                addNotification({
                    id: `due:${s.id}:${s.next}`,
                    kind: 'out',
                    title: this.$t('payments.msg_due', { amount: `${s.amount} ${s.symbol}`, note: s.note || s.to.slice(0, 10) }),
                    route: { name: 'send', query: { wid: String(s.walletId), i: String(s.addressIndex), to: s.to, amount: s.amount, symbol: s.symbol, schedule: s.id } }
                })
            }
            try {
                const fired = await checkAlerts(this.$svc, (key, params) => this.$t(key, params ?? {}))
                for (const m of fired) {
                    addNotification({
                        id: `alert:${m.text}:${new Date().toDateString()}`,
                        kind: m.slug ? 'alert' : 'offer',
                        title: m.text,
                        route: m.slug ? { name: 'collection', params: { slug: m.slug } } : { name: 'nfts' }
                    })
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
        async checkLimitBuys() {
            const limits = payments.buys.filter(b => b.below !== null && !b.fired)
            if (!limits.length) return
            try {
                const specs = (await this.$svc.config.token.all()).filter(t => t.gid === genesises.main.id)
                const addr = (symbol: string) => symbol === 'VET' ? '0x0000000000000000000000000000000000000000' : (specs.find(t => t.symbol === symbol)?.address || '').toLowerCase()
                const [stats, eur, usd] = await Promise.all([
                    this.$svc.prices.stats(limits.map(b => addr(b.to))),
                    this.$svc.prices.fx('EUR'),
                    this.$svc.prices.fx('USD')
                ])
                for (const b of reachedLimits((symbol, currency) => (stats[addr(symbol)]?.price || 0) * (currency === 'EUR' ? eur : usd))) {
                    b.fired = true
                    const text = this.$t('buys.msg_limit', { symbol: b.to, price: money(b.below || 0), amount: `${b.amount} ${b.from}` })
                    addNotification({ id: `buy-limit:${b.id}`, kind: 'alert', title: text, route: buyRoute(b) })
                    this.$q.notify({ message: text, icon: 'o_trending_down', timeout: 10000, actions: [{ label: this.$t('buys.action_buy_now'), color: 'primary', handler: () => { void this.$router.push(buyRoute(b)) } }] })
                    notifySystem(text)
                }
            } catch (err) {
                console.warn('limit buys:', err)
            }
        },
        async externalSignHandlerLoop() {
             
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
        startNodeHealth(this.$svc)
        this.$watch(() => nodeHealth.switchedTo, url => {
            if (url) this.$q.notify({ message: this.$t('nodeHealth.switched', { host: new URL(url).host }), icon: 'o_cell_tower' })
        })
        console.log(`[BlackVault] v${import.meta.env.APP_VERSION} (${import.meta.env.APP_BUILD})`)
        void this.externalSignHandlerLoop()
        // price alerts and new offers, while BlackVault is open
        setTimeout(() => void this.runAlerts(), 15 * 1000)
        this.alertTimer = setInterval(() => void this.runAlerts(), 5 * 60 * 1000)
        // the desktop app reports a downloaded update here (the PWA from src-pwa/register-sw.ts);
        // the native app (phase 6) will report updates and style the status bar here
        desktop?.onUpdateReady(() => { window.AppState.updateAvailable = true })
    },
    beforeUnmount() {
        this.destroyed = true
        this.alertTimer && clearInterval(this.alertTimer)
    }
})
</script>
