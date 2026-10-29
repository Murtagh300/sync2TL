/*
 * What the extension adds to connect.js: every VeChain site finds BlackVault where wallets are
 * looked for, without loading anything itself.
 *
 * - window.ConnexWalletBuddy: VeChain dapp-kit's relay wallet (the "Sync2" choice) opens BlackVault.
 * - window.vechain (only when no other wallet put one there): newConnexSigner(genesisId), the signer
 *   shape dapp-kit asks an injected wallet for.
 *
 * Nothing here holds keys or signs: each request opens BlackVault, where the user signs or declines.
 */
;(function (root) {
    'use strict'
    var bv = root.BlackVault
    if (!bv) return
    var WALLET = 'https://wallet.blackvemarket.com'
    bv.dappKit({ wallet: WALLET })
    if (!root.vechain) {
        var provider = {
            isBlackVault: true,
            newConnexSigner: function (genesisId) { return bv.signer({ wallet: WALLET, genesisId: genesisId }) }
        }
        Object.defineProperty(root, 'vechain', { configurable: true, value: provider })
    }
    root.dispatchEvent(new Event('blackvault#initialized'))
})(window)
