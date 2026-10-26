# BlackVault

The VeChain wallet by [BlackVeMarket](https://blackvemarket.com): VET, VTHO, tokens and NFTs, trading on
BlackVeMarket, WalletConnect, and signing for every VeChain dApp. Keys stay on the device, encrypted with the
user's password. It started as a fork of VeChain Sync2 and has been rebuilt since.

| Folder | What |
| --- | --- |
| [`next/`](next/README.md) | the wallet: Quasar 2, Vue 3, Vite, a PWA |
| [`server/`](server/) | the BlackVault server: API gateway, push for incoming transfers, health, remote config, error reports |
| [`deploy/`](deploy/) | hosting: Caddy (HTTPS, security headers) and the server with Docker Compose |
| [`docs/`](docs/) | [architecture](docs/ARCHITECTURE.md), [deploy and incidents](docs/DEPLOY.md), [contributing](docs/CONTRIBUTING.md), [manual test checklist](docs/TEST-CHECKLIST.md) |

## Quick start

Node 24 (`.nvmrc`).

```bash
cd next && npm install && npm run dev
```

The wallet opens on http://localhost:8090. It works without the server; to run that too:

```bash
cd server && npm install && npm run dev
```

## Checks

```bash
cd next && npm run typecheck && npm run lint && npm test && npm run e2e
cd server && npm run typecheck && npm test
```

GitHub Actions runs all of them on every push and pull request (`.github/workflows/ci.yml`);
deploying is a manual workflow (`.github/workflows/deploy.yml`, see [docs/DEPLOY.md](docs/DEPLOY.md)).

## Security

The wallet's own review: [next/SECURITY-AUDIT.md](next/SECURITY-AUDIT.md). Found something? Report it to
BlackVeMarket privately (a GitHub security advisory on this repository) rather than in a public issue.

## License

[LGPL-3.0](LICENSE), as VeChain Sync2 it is based on. What changed: [CHANGELOG.md](CHANGELOG.md).
