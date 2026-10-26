# Contributing

## Set up

Node 24 (`nvm use`), then:

```bash
cd next && npm install && npm run dev        # the wallet on http://localhost:8090
cd server && npm install && npm run dev      # optional: the server on :8787 (the wallet reaches it as /srv)
```

VS Code: the recommended extensions (`.vscode/extensions.json`) are ESLint, Vue (Volar) and i18n Ally.

Use a test wallet. Create one in the app, or import one on Testnet (Add a wallet › ⋯ › Testnet); test VET comes
from https://faucet.vecha.in. Never test sending with a wallet that holds real value.

## Before a pull request

```bash
cd next
npm run typecheck   # strict TypeScript, noUncheckedIndexedAccess
npm run lint        # ESLint (eslint.config.js)
npm test            # unit tests
npm run e2e         # Playwright: onboarding, screens, remote config, axe accessibility
cd ../server
npm run typecheck && npm test
```

CI runs the same, plus a production build, `npm audit` (high and up) and a lockfile check. A testnet
transaction test runs in CI only when the `TESTNET_MNEMONIC` secret is set; locally:

```bash
TESTNET_MNEMONIC="twelve words of a funded testnet wallet" npm run e2e -- e2e/testnet.spec.ts
```

It refuses every request to a mainnet host and checks for "Testnet" before it signs.

Screenshots (`e2e/visual.spec.ts`) only run with `VISUAL=1`; make the references with
`VISUAL=1 npx playwright test e2e/visual.spec.ts --update-snapshots` on the machine that checks them.

## How the code is written

- **Vue 3 Options API**, as the rest of the app; one component per file, the template first.
- **Texts** go in `src/i18n/en-us/index.ts` and the same key in `nl-nl`, `de-de`, `fr-fr` and `zh-cn`; a test keeps
  them in step. Write for users: plain verbs, what a button does, errors that say what to do.
- **Comments** say why, briefly; names say what.
- **Network**: make HTTP clients with `createClient` (`src/utils/net.ts`) and take base URLs from
  `src/utils/endpoints.ts`. Never send keys, recovery words or anything signed to the BlackVault server.
- **Stored settings**: a new shape for something in localStorage gets a migration in `src/utils/migrations.ts`
  (and a test). Something worth keeping across devices goes into the settings back-up lists
  (`src/utils/settings-backup.ts`), never key material.
- **New features that can go wrong in production** get a switch: add the name to `FEATURES` in both
  `server/src/flags.ts` and `src/utils/remote-config.ts`, and its route to `routeFeature`.
- **Accessibility**: icon-only buttons get an `aria-label`, form fields a label, toggles a name; `npm run e2e`
  checks the main screens with axe.
- **Big files**: split a component when it passes ~600 lines; see `pages/Address/Nft*.vue` and
  `pages/Nft/Nft*.vue` for how.

## The server

TypeScript run directly by Node 24 (type stripping): only erasable syntax (no enums, no namespaces, no
parameter properties), imports with `.ts`. Every new gateway path is added to `RULES` in `src/proxy.ts`
with its cache time; nothing that needs a user's session goes through the gateway.

## Releasing

See [DEPLOY.md](DEPLOY.md#releasing-a-version).
