/*
 * BlackVault connect: a dApp uses BlackVault directly, with no extension and no WalletConnect link.
 *
 * A request goes to the wallet's relay, BlackVault opens in a window of its own (a tab on a phone),
 * the user signs there, the window closes, and the answer comes back through the relay. It is the
 * protocol of VeChain's Sync2, so the signer has the same shape as Sync2's:
 *
 *   const bv = BlackVault.signer()               // mainnet, the wallet this file was loaded from
 *   const cert = await bv.signCert({ purpose: 'identification', payload: { type: 'text', content: 'Sign in' } })
 *   const tx = await bv.signTx([{ to, value, data }], { signer: cert.annex.signer, comment: 'Buy' })
 *
 *   BlackVault.connect()                         // the above sign-in: { address, certificate }
 *   BlackVault.dappKit()                         // VeChain dapp-kit's "sync2" wallet becomes BlackVault
 *
 * Options for each: { wallet: 'https://wallet.blackvemarket.com', genesisId, labels }.
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
        cancel: 'Cancel'
    }

    var current = null // one request at a time, like Sync2

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
    function bar(labels, blocked, openWallet, cancel) {
        var el = document.createElement('div')
        var s = el.style
        s.position = 'fixed'; s.left = '50%'; s.bottom = '16px'; s.transform = 'translateX(-50%)'
        s.zIndex = '2147483647'; s.display = 'flex'; s.alignItems = 'center'; s.gap = '12px'
        s.padding = '10px 12px 10px 16px'; s.borderRadius = '12px'; s.maxWidth = 'calc(100vw - 32px)'
        s.background = '#121212'; s.color = '#fff'; s.boxShadow = '0 6px 24px rgba(0,0,0,.35)'
        s.font = '14px/1.3 system-ui, sans-serif'
        var text = document.createElement('span')
        text.textContent = blocked ? labels.blocked : labels.waiting
        var open = document.createElement('button')
        open.type = 'button'
        open.textContent = labels.open
        var no = document.createElement('button')
        no.type = 'button'
        no.textContent = labels.cancel
        ;[open, no].forEach(function (b) {
            b.style.font = 'inherit'; b.style.cursor = 'pointer'; b.style.borderRadius = '8px'; b.style.padding = '6px 12px'
            b.style.border = '1px solid rgba(255,255,255,.3)'; b.style.background = 'transparent'; b.style.color = '#fff'
        })
        if (blocked) { open.style.background = '#fff'; open.style.color = '#121212' }
        open.onclick = openWallet
        no.onclick = cancel
        el.appendChild(text); el.appendChild(open); el.appendChild(no)
        document.body.appendChild(el)
        return function () { el.remove() }
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
        var opened = openWallet()
        var hide = bar(labels, !opened, openWallet, me.cancel)
        try {
            var until = Date.now() + 10 * 60 * 1000
            read(src + '.accepted', until, aborted).then(function () { onAccepted && onAccepted() }, function () { })
            var resp = JSON.parse(await read(src + '.resp', until, aborted))
            if (resp.error) throw new Error(resp.error)
            return resp.payload
        } finally {
            cancelled = true
            if (current === me) current = null
            hide()
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
         * VeChain dapp-kit loads Sync2's helper (window.ConnexWalletBuddy) for its "sync2" wallet;
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
