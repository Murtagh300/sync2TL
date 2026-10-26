# Deploy and incidents

## The host, once

A small Linux server (1 vCPU, 1 GB is enough) with Docker and the compose plugin, ports 80 and 443 open,
and a DNS record (`wallet.<domain>`) pointing at it.

The layout on the host, which the deploy workflow keeps:

```
/opt/blackvault/
  deploy/          Caddyfile, docker-compose.yml, .env, flags.json, wallet/ (the built wallet)
  server/          the server's source (built into an image by compose)
```

```bash
sudo mkdir -p /opt/blackvault/deploy && sudo chown -R "$USER" /opt/blackvault
# from your machine: the deploy files, then make the .env on the host
rsync -az deploy/ host:/opt/blackvault/deploy/
ssh host 'cd /opt/blackvault/deploy && cp .env.example .env'
```

Fill in `/opt/blackvault/deploy/.env`:

- `WALLET_DOMAIN`: the domain; Caddy gets the certificate by itself.
- `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`: make them once with `cd server && npm run vapid`. Keep the private
  key secret and never change it: every push subscription is tied to it.
- `ADMIN_TOKEN`: a long random string (`openssl rand -hex 32`), to read error reports.
- Optional, more than one domain: `WALLET_SITES=bvwallet.xyz, wallet.blackvemarket.com` and
  `WALLET_ORIGINS=https://bvwallet.xyz,https://wallet.blackvemarket.com`. Every domain needs an A record to the
  host. Each domain is its own origin for the browser: wallets saved on one are not on the other.

`deploy/flags.json` is the remote config; edit it on the host (see below).

## Deploying

**With GitHub Actions** (recommended): Actions › Deploy › Run workflow. It builds the wallet with
`SERVER_URL=/`, copies it and the server to the host over SSH, runs `docker compose up -d --build` and checks
`/config`. The secrets it needs are listed at the top of `.github/workflows/deploy.yml`; put them in an
environment named `production` (Settings › Environments), so a deploy can require an approval.

**By hand**:

```bash
cd next && SERVER_URL=/ NODE_OPTIONS=--openssl-legacy-provider npm run build
rsync -az --delete dist/pwa/ host:/opt/blackvault/deploy/wallet/
rsync -az --exclude .env --exclude flags.json --exclude wallet ../deploy/ host:/opt/blackvault/deploy/
rsync -az --delete --exclude node_modules --exclude data ../server/ host:/opt/blackvault/server/
ssh host 'cd /opt/blackvault/deploy && docker compose up -d --build'
```

After a deploy: open the wallet, check `https://<domain>/status`, and look at the version in Meer.

**Rolling back**: the previous wallet is kept as `deploy/wallet.old`:

```bash
cd /opt/blackvault/deploy && mv wallet wallet.bad && mv wallet.old wallet
```

For the server, deploy the previous commit with the workflow (`ref` input).

## Releasing a version

1. Raise `version` in `next/package.json`.
2. Add the release to `next/src/changelog.ts` (all five languages) and to `CHANGELOG.md`.
3. Merge, wait for CI, run Deploy. Users get "Update" in the app; after updating they see "What's new".

## Remote config (`deploy/flags.json`)

Read again within 30 seconds of a change, no restart needed.

```json
{
  "version": 2,
  "features": { "swap": false },
  "notice": { "level": "warning", "text": { "en": "Swapping is paused while BetterSwap is down.", "nl": "Swappen staat uit zolang BetterSwap plat ligt." } },
  "minVersion": "2.1.0"
}
```

- `features`: `walletconnect`, `swap`, `payout`, `dust`, `consolidate`, `stargate`, `vebetter`, `launchpad`,
  `push`. Only `false` does something: the feature disappears and its pages can't be opened.
- `notice`: up to 280 characters per language; users can close it.
- `minVersion`: older apps are asked to update.

## Watching it

- `https://<domain>/status`: every dependency, refreshed every minute. Point an uptime monitor at `/health`
  (200 when the wallet can work, 503 when no VeChain node answers).
- Logs: `docker compose logs -f server` (no IP addresses, no query strings).
- Error reports: `curl -H "Authorization: Bearer $ADMIN_TOKEN" https://<domain>/errors?limit=50`.

## Incidents

Start by saying what is going on: a `notice` in `flags.json` reaches every open wallet within minutes.

| What | Do |
| --- | --- |
| A feature misbehaves (swap quotes wrong, a contract changed) | switch it off in `flags.json`, post a notice, fix, deploy, switch it on |
| A release is broken | roll back the wallet (above); if old versions are unsafe, raise `minVersion` after the fix |
| BetterSwap or BlackVeMarket down | nothing to do: the gateway serves stale data, the banner says what is down |
| All VeChain nodes down | `/health` is 503; the wallet shows its last known balances; add a node to `MAINNET_NODES` if one works |
| Push stopped | `docker compose logs server | grep push`; `[push] on` must be there (VAPID keys set); the watcher catches up by itself |
| Server down | the wallet keeps working (no push, no config); `docker compose up -d`, check disk space for `/data` |
| Suspected compromise of the host | take it offline; the wallet's keys are not there, but the host serves the wallet's code: rebuild the host, rotate `ADMIN_TOKEN` and SSH keys, redeploy from a trusted commit, tell users |
| VAPID private key leaked | make new keys; every device has to turn push on again (say so in a notice) |

Afterwards, write down what happened, when, what was done and what changes, next to this file.

## Backups

- `server_data` (the SQLite database): subscriptions and reports. Losing it means users turn push on again;
  `docker compose exec server sh -c 'cp /data/blackvault.db /data/backup.db'` before risky changes.
- `deploy/.env`: keep a copy somewhere safe (the VAPID private key is in it).
