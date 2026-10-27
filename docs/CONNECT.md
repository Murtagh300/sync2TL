# Connecting a dApp to BlackVault

A dApp (BlackVeMarket, say) uses BlackVault directly: no extension, no WalletConnect link to copy. The user
clicks "Connect", BlackVault opens in a window of its own (a tab on a phone), the user signs there, the window
closes and the dApp has the answer.

How it works: `connect.js` posts the request to the wallet's relay (`/relay/`, see `server/src/relay.ts`),
opens `https://<wallet>/#/sign?src=<relay url>&close=1`, and waits for the answer on the relay. The wallet
checks the request against its id (its sha-256), shows the dApp's origin (set by the browser, not the page)
and signs through its usual dialogs. It is VeChain's standard relay protocol, so the signer has the shape dApps already know.

## Load it

```html
<script src="https://wallet.blackvemarket.com/connect.js"></script>
```

or copy `next/public/connect.js` into the dApp (then pass `{ wallet: 'https://wallet.blackvemarket.com' }`).
A dApp with a Content-Security-Policy allows the wallet's origin in `script-src` (when loaded from there) and
`connect-src`.

## Without dapp-kit

```js
const { address, certificate } = await BlackVault.connect()          // sign-in: the user picks an address
const bv = BlackVault.signer()
const { txid } = await bv.signTx([{ to, value: '0x0', data }], { signer: address, comment: 'Buy NFT' })
```

The certificate proves the address (verify it on the server as for any VeChain certificate). A refusal or a
closed window rejects with `user decline`.

## With VeChain dapp-kit

dapp-kit's relay wallet (its id is `'sync2'`) loads a helper script; `BlackVault.dappKit()` replaces that helper, so dapp-kit's
own connect, `signer` and `requestTransaction` go to BlackVault:

```js
BlackVault.dappKit()                       // once, before connecting
// dapp-kit options: allowedWallets includes 'sync2'
// a "BlackVault" button:
setSource('sync2'); await connect()
```

dapp-kit still loads the helper from unpkg.com (it is then ignored), so a CSP must allow that script.

## The desktop app

With BlackVault's desktop app installed (docs/DESKTOP.md), the bar has a "Desktop app" button: it opens the
request in the app with a `blackvault:` link (the browser asks once whether to open BlackVault). The choice is
remembered in that browser, so the next request goes to the app at once, with "Web wallet" to go back.
`{ app: 'desktop' }` or `{ app: 'web' }` fixes it for a dApp.

## Limits

- Each wallet domain is its own origin: the window opens the wallet the dApp names, with the wallets saved
  there.
- On iPhone an installed BlackVault (home screen) keeps its own storage, apart from Safari: the window opens
  in Safari, where the wallet has to be there too.
- A blocked popup: a bar at the bottom of the dApp offers "Open BlackVault".
