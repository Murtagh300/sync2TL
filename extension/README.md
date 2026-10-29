# BlackVault browser extension

Puts BlackVault where VeChain sites look for a wallet, so a site's "Sync2" or "VeChain wallet"
choice opens BlackVault to sign in and to sign. The extension holds no keys and signs nothing:
each request opens the BlackVault wallet (wallet.blackvemarket.com), where the user signs or
declines, and the answer comes back through the wallet's relay (`next/public/connect.js`).

- `src/glue.js` adds `window.ConnexWalletBuddy` (dapp-kit's relay wallet) and, when no other
  wallet set one, `window.vechain.newConnexSigner(genesisId)`.
- `node build.mjs` writes `dist/`: `inject.js` (connect.js + glue.js), the manifest, popup and icons.

Try it: Chrome, `chrome://extensions`, Developer mode, Load unpacked, choose `dist/`.
Firefox (128 or later): `about:debugging`, This Firefox, Load Temporary Add-on, `dist/manifest.json`.

Publish: zip the contents of `dist/` (the manifest at the top of the zip) and upload it to the
Chrome Web Store (developer account, a one-time fee), Firefox Add-ons or Edge Add-ons (free).
