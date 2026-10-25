# BlackVault security review

Internal review of `next/` (the BlackVault PWA), 2026-10-25. Not a substitute for an
external audit: see "What this review does not cover".

## Scope

- Keys: vault format, unlock, where private keys live and for how long.
- Signing: the transaction and certificate dialogs, what they show, risk levels.
- Clauses the wallet builds itself: BlackVeMarket trading, swaps, liquidity, messages.
- Data from outside: BlackVeMarket API, BetterSwap and VeTrade APIs, vet.domains, the
  chain itself (token symbols, clause data), push messages.
- Web surface: HTML rendering, links, exports, the page's Content-Security-Policy.
- Dependencies (`npm audit`).

Ledger support was removed in the same change: fewer code paths that sign, and three
fewer dependencies (`@ledgerhq/hw-transport`, `@ledgerhq/hw-transport-webhid`,
`@vechain/hw-app-vet`).

## What holds up

- **Keys stay local and encrypted.** The vault format is Sync2's: the password goes through
  PBKDF2-HMAC-SHA256 in a web worker (with iterations tuned to the device), and the
  recovery words are AES-encrypted with the derived key. A private key is derived only
  inside a signing call and is never stored or sent.
- **Every signature goes through one dialog**, which decodes the clauses into readable
  actions, gives each a risk level, and shows the balance changes of a dry run before
  you confirm.
- **Swap routes from a service are checked.** They may only approve the input token to
  a known router, call known routers and send at most the input amount of VET.
- **Delegation (VIP-191)** only goes to the URL the dApp names in the request, and the
  dialog shows that a sponsor pays the fee.
- **Encrypted messages**: the recipient's public key is recovered from a transaction and
  checked against the address before anything is encrypted to it.
- HTML that the wallet writes itself (the printable export, the emergency letter) escapes
  every value; the QR code SVG holds only shapes.

## Findings and fixes

| # | Finding | Severity | Status |
|---|---------|----------|--------|
| 1 | A swap route from VeTrade's service could pay the output to another address: the routers are known, but the recipient is a parameter inside the calldata. | High | Fixed |
| 2 | Marketplace contracts were trusted because the BlackVeMarket API named them. A tampered or compromised API response could get a "BlackVeMarket" label, and an "OK" risk level, for any contract. | High | Fixed |
| 3 | Encrypted messages: the sender's ephemeral public key was not checked to be on the curve. A crafted message could leak bits of the reader's private key through the shared secret (invalid-curve attack). | High | Fixed |
| 4 | Incoming-transfer notifications rendered the token symbol as HTML. A token chooses its own symbol, so a spam token could inject HTML or script. | Medium | Fixed |
| 5 | No Content-Security-Policy, and an inline script in `index.html`. | Medium | Fixed |
| 6 | Links from APIs and dApps were opened without checking the scheme (`javascript:` and `data:` would be opened). | Medium | Fixed |
| 7 | A .vet name was shown instead of the address. Anyone can register a look-alike name. | Medium | Fixed |
| 8 | CSV export: a note or a name starting with `=`, `+`, `-` or `@` runs as a formula in spreadsheet apps. | Low | Fixed |
| 9 | `elliptic` (used by thor-devkit and Connex) has a low-severity advisory, GHSA-848j-6mx2-7j84; no fixed version exists. | Low | Accepted |

### How each was fixed

1. `src/utils/swap.ts`: a service quote is dry-run as the user's account, and is only
   accepted when that dry run pays the account at least the minimum out
   (`receivedInDryRun`). When it doesn't, the wallet falls back to a route it builds
   itself on BetterSwap's aggregator, with the account as the recipient.
2. `src/utils/known-markets.ts`: the 161 marketplace contracts of BlackVeMarket's
   collections ship with the wallet. Only these are named "BlackVeMarket". A market
   action on any other contract is a warning, with the address, in the sign dialog
   (`describe-action.ts`), and an approval for it shows as unknown. Refresh the list with
   `npm run markets` when collections are added, and review the diff before committing.
3. `src/utils/message-crypto.ts`: the key must be a 65-byte uncompressed point that
   passes `elliptic`'s validation, or decryption stops.
4. `src/pages/TransferNotifier.vue`: the symbol is escaped.
5. `index.html` (production builds): `script-src 'self'`, `object-src 'none'`,
   `base-uri 'none'`, `form-action 'none'`, `frame-src 'none'` and `no-referrer`. Images
   and media may come from any https host (NFTs), and connections may go to any https/wss
   host (custom nodes). The forwarding script moved to `public/forward.js`. Checked
   in the browser on a production build: no violations.
6. `src/utils/open-url.ts`: only http(s), with `noopener` and `noreferrer`.
7. `src/components/AddressLabel.vue`: a .vet name is followed by its short address.
   Contact names are your own and stay as they are.
8. `src/utils/export.ts`: such cells get a leading `'`; plain negative numbers stay
   numbers.
9. The wallet only signs 32-byte hashes with it, which the advisory does not
   affect. Watch for a fixed release of `elliptic` or thor-devkit.

Tests were added for 1, 2, 3 and 8.

## What hosting has to add

These cannot be set from inside the page:

- `Content-Security-Policy: frame-ancestors 'none'` (or `X-Frame-Options: DENY`). This
  stops another site from framing the wallet (clickjacking).
- `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: no-referrer`.
- Serve the wallet from its own origin, not a path that shares cookies and scripts with
  blackvemarket.com. A bug in the website must not be able to run in the wallet's origin,
  where the encrypted vault lives.
- A BetterSwap proxy (its API sends no CORS headers), on the same origin or on a
  BlackVeMarket domain.
- Deploy only from a clean, reviewed build (lockfile, `npm ci`). Whoever controls the
  hosting controls the code that handles the keys.

## What this review does not cover

- **An external audit.** This review was done by the people who wrote the code. Before
  promoting the wallet widely, have the vault, signing and the clauses it builds
  reviewed by an independent firm.
- **The supply chain.** Every npm package runs with access to the keys at unlock time.
  Keep dependencies few and pinned (`package-lock.json`), and review updates.
- **The services.** BlackVeMarket, BetterSwap, VeTrade and the node are trusted for prices,
  names and listings. Signing does not depend on them (dry runs run against the node),
  but a compromised node could lie in a dry run.
- **The device.** Malware or a malicious browser extension on the device can read the
  page, including the password as it is typed.
- **Legal.** There is no privacy policy or terms yet, although the app talks to
  BlackVeMarket (push, sessions) and third-party APIs.
