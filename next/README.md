# BlackVault – next

The BlackVault wallet being rebuilt on Quasar 2, Vue 3 and Vite.
The current app in the repository root keeps working until this folder replaces it.

Requires Node 24 (see `../.nvmrc`).

```bash
npm install
npm run dev          # http://localhost:8090
npm run build        # PWA into dist/pwa
npm run typecheck
npm test             # core tests against next/src
npm run test:legacy  # the same tests against the current app in ../src
```

## Status

| Phase | Scope | State |
| --- | --- | --- |
| 0 | Test checklist (`../docs/TEST-CHECKLIST.md`), core tests | done |
| 1 | Quasar 2 + Vite toolchain, theme, assets, i18n, `core/` | done |
| 2 | Boot files and global services | done |
| 3 | Router and stack navigation | done |
| 4 | Pages and components | – |
| 5 | Electron | – |
| 6 | Mobile (Capacitor) | – |
| 7 | Lint, CI, cleanup | – |

Until phase 4 the app only shows a toolchain check page (`src/pages/ToolchainCheck.vue`)
that runs the wallet core in the browser, plus `src/pages/ServiceCheck.vue` for the
services (live chain head, balances, tokens, reactive storage, `$dialog`, `$loading`).

## Porting notes

- **Options API** is enabled (`build.vueOptionsAPI`); app-vite 3 turns it off by default.
- **Global helpers** (`$svc`, `$state`, `$axios`, `$dialog`, `$loading`, `$backOrHome`,
  `$netDisplayName`, `$onWindowEvent`) are `app.config.globalProperties`, typed through
  `declare module 'vue' { interface ComponentCustomProperties }`. Outside components use
  `useSvc()` from `boot/services`.
- **`$dialog`** passes every option except Quasar's own to a custom `component` as props
  (Quasar 2 wants `componentProps`); call sites stay as they were.
- **asyncComputed** (vue-async-computed 4): declare each key in `data()` as
  `key: null as T | null` for typing, see `src/shims-async-computed.d.ts`.
- **Stack navigation** (`src/router/stack.ts`, replaces vue-router-stack): the depth of a
  page is vue-router's `history.state.position` minus the position the tab opened the
  app at (kept in sessionStorage, so reloads keep it). `StackedRouterView` finds its own
  route record through vue-router's `matchedRouteKey`/`viewDepthKey`; note that the
  Options API `inject` unwraps refs. Pages under `layouts/Main` get their route params
  and query as props. `pages/StackDemo.vue` (temporary) exercises push, back, replace,
  swipe-back and reload.
- **Still to come in phase 4**, with the dialogs they open: `$authenticate`, `$signTx`,
  `$signCert`, `$qrcode` and the biometric unlock (`utils/bio-pass`, phase 6 for native).

## Core tests

`test/core` pins the stored-data formats with values generated independently of the
app (ethers for HD keys, Node crypto for the cipher format, see `test/fixtures.ts`).
Run both `npm test` and `npm run test:legacy` after touching `src/core`: if either
fails, wallets saved by an earlier version may no longer open.
