/*
 * BlackVault connect: a dApp uses BlackVault directly, with no extension and no WalletConnect link.
 *
 * A request goes to the wallet's relay, BlackVault opens in a window of its own (a tab on a phone),
 * the user signs there, the window closes, and the answer comes back through the relay. It is the
 * VeChain's standard relay protocol, so the signer has the shape dApps already know:
 *
 *   const bv = BlackVault.signer()               // mainnet, the wallet this file was loaded from
 *   const cert = await bv.signCert({ purpose: 'identification', payload: { type: 'text', content: 'Sign in' } })
 *   const tx = await bv.signTx([{ to, value, data }], { signer: cert.annex.signer, comment: 'Buy' })
 *
 *   BlackVault.connect()                         // the above sign-in: { address, certificate }
 *   BlackVault.dappKit()                         // VeChain dapp-kit's relay wallet becomes BlackVault
 *
 * Options for each: { wallet: 'https://wallet.blackvemarket.com', genesisId, labels, app }.
 *
 * With BlackVault's desktop app installed, a blackvault: link opens the app instead of a window.
 * The bar offers it ("Desktop app"); once chosen, this browser remembers it and uses the app first,
 * with "Web wallet" as the way back. `app: 'web' | 'desktop'` fixes the choice.
 */
(function (root) {
    'use strict'
    var MAINNET = '0x00000000851caf3cfdb6e899cf5958bfb1ac3413d346d43539627e6be7ec1b4a'
    var script = document.currentScript && document.currentScript.src
    var WALLET = script ? new URL(script).origin : 'https://wallet.blackvemarket.com'
    var LABELS = {
        waiting: 'Confirm in BlackVault',
        blocked: 'Open BlackVault to confirm',
        open: 'Open BlackVault',
        desktop: 'Desktop app',
        inDesktop: 'Confirm in the BlackVault app',
        web: 'Web wallet',
        cancel: 'Cancel'
    }
    var PREF = 'blackvault-app'
    function preferred(cfg) {
        if (cfg.app === 'web' || cfg.app === 'desktop') return cfg.app
        try { return localStorage.getItem(PREF) === 'desktop' ? 'desktop' : 'web' } catch (e) { return 'web' }
    }
    function remember(choice) {
        try { choice === 'desktop' ? localStorage.setItem(PREF, 'desktop') : localStorage.removeItem(PREF) } catch (e) { }
    }

    var current = null // one request at a time

    function hex(buf) {
        return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2) }).join('')
    }
    function sleep(ms) {
        return new Promise(function (r) { setTimeout(r, ms) })
    }

    /** reads a relay key until it has a value (the relay holds each GET up to 20 s) */
    async function read(url, until, aborted) {
        var fails = 0
        while (Date.now() < until && !aborted()) {
            try {
                var res = await fetch(url + '?wait=1', { cache: 'no-store' })
                if (!res.ok) throw new Error('relay ' + res.status)
                var text = await res.text()
                if (text) return text
                fails = 0
            } catch (err) {
                if (++fails > 3) throw new Error('BlackVault can\'t be reached')
                await sleep(2000)
            }
        }
        throw new Error(aborted() ? 'cancelled' : 'BlackVault did not answer in time')
    }

    /** a small bar at the bottom of the dApp while BlackVault is open; it opens it again when asked */
    function bar(labels, text0, primary, other, cancel) {
        var el = document.createElement('div')
        var s = el.style
        s.position = 'fixed'; s.left = '50%'; s.bottom = '16px'; s.transform = 'translateX(-50%)'
        s.zIndex = '2147483647'; s.display = 'flex'; s.alignItems = 'center'; s.gap = '12px'
        s.padding = '10px 12px 10px 16px'; s.borderRadius = '12px'; s.maxWidth = 'calc(100vw - 32px)'
        s.background = '#121212'; s.color = '#fff'; s.boxShadow = '0 6px 24px rgba(0,0,0,.35)'
        s.font = '14px/1.3 system-ui, sans-serif'
        var text = document.createElement('span')
        el.appendChild(text)
        var buttons = []
        // [label, onclick, highlighted]
        var render = function (t, actions) {
            text.textContent = t
            buttons.forEach(function (b) { b.remove() })
            buttons = actions.concat([[labels.cancel, cancel]]).map(function (a) {
                var b = document.createElement('button')
                b.type = 'button'
                b.textContent = a[0]
                b.style.font = 'inherit'; b.style.cursor = 'pointer'; b.style.borderRadius = '8px'; b.style.padding = '6px 12px'
                b.style.border = '1px solid rgba(255,255,255,.3)'; b.style.background = a[2] ? '#fff' : 'transparent'; b.style.color = a[2] ? '#121212' : '#fff'
                b.onclick = a[1]
                el.appendChild(b)
                return b
            })
        }
        render(text0, [primary, other])
        document.body.appendChild(el)
        return { render: render, hide: function () { el.remove() } }
    }

    async function request(type, message, options, cfg) {
        if (current) current.cancel()
        options = Object.assign({}, options || {})
        var onAccepted = options.onAccepted
        delete options.onAccepted
        var wallet = (cfg.wallet || WALLET).replace(/\/$/, '')
        var relay = wallet + '/relay/'
        var labels = Object.assign({}, LABELS, cfg.labels || {})
        var nonce = new Uint8Array(16)
        crypto.getRandomValues(nonce)
        var body = JSON.stringify({ type: type, gid: cfg.genesisId || MAINNET, payload: { message: message, options: options }, nonce: hex(nonce) })
        // the wallet checks the request against this name, so the relay can't change it
        var id = hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body)))
        var src = relay + id

        var cancelled = false
        var me = { cancel: function () { cancelled = true } }
        current = me
        var aborted = function () { return cancelled }

        var res = await fetch(src, { method: 'POST', body: body, headers: { 'Content-Type': 'text/plain' } })
        if (!res.ok) throw new Error('BlackVault relay: ' + res.status)

        var url = wallet + '/#/sign?src=' + encodeURIComponent(src) + '&close=1'
        var openWallet = function () {
            var w = 420, h = 720
            var left = Math.max(0, (screen.width - w) / 2), top = Math.max(0, (screen.height - h) / 2)
            return window.open(url, 'blackvault', 'popup,width=' + w + ',height=' + h + ',left=' + left + ',top=' + top)
        }
        // the desktop app takes blackvault: links; the page stays (no app: nothing happens)
        var openApp = function () { location.href = 'blackvault:sign?src=' + encodeURIComponent(src) }

        var ui
        var useWeb = function () {
            remember('web')
            var opened = openWallet()
            ui.render(opened ? labels.waiting : labels.blocked, [[labels.open, openWallet, !opened], [labels.desktop, useApp]])
        }
        var useApp = function () {
            remember('desktop')
            openApp()
            ui.render(labels.inDesktop, [[labels.desktop, openApp], [labels.web, useWeb]])
        }
        if (preferred(cfg) === 'desktop') {
            openApp()
            ui = bar(labels, labels.inDesktop, [labels.desktop, openApp], [labels.web, useWeb], me.cancel)
        } else {
            var opened = openWallet()
            ui = bar(labels, opened ? labels.waiting : labels.blocked, [labels.open, openWallet, !opened], [labels.desktop, useApp], me.cancel)
        }
        try {
            var until = Date.now() + 10 * 60 * 1000
            read(src + '.accepted', until, aborted).then(function () { onAccepted && onAccepted() }, function () { })
            var resp = JSON.parse(await read(src + '.resp', until, aborted))
            if (resp.error) throw new Error(resp.error)
            return resp.payload
        } finally {
            cancelled = true
            if (current === me) current = null
            ui.hide()
        }
    }

    function signer(cfg) {
        cfg = cfg || {}
        return {
            signTx: function (message, options) { return request('tx', message, options, cfg) },
            signCert: function (message, options) { return request('cert', message, options, cfg) }
        }
    }

    root.BlackVault = {
        signer: signer,
        /** signs in: the user picks an address in BlackVault and signs a certificate with it */
        connect: async function (cfg) {
            cfg = cfg || {}
            var certificate = await signer(cfg).signCert({
                purpose: 'identification',
                payload: { type: 'text', content: cfg.message || 'Sign in to ' + location.host }
            })
            return { address: certificate.annex.signer, certificate: certificate }
        },
        /**
         * VeChain dapp-kit loads a helper (window.ConnexWalletBuddy) for its relay wallet ('sync2');
         * after this call that helper is BlackVault, so dapp-kit's own connect and signing use it.
         * Call it before dapp-kit connects.
         */
        dappKit: function (cfg) {
            cfg = cfg || {}
            var buddy = {
                create: function (genesisId) { return signer(Object.assign({}, cfg, { genesisId: genesisId })) }
            }
            Object.defineProperty(root, 'ConnexWalletBuddy', { configurable: true, get: function () { return buddy }, set: function () { } })
        }
    }
})(window)
