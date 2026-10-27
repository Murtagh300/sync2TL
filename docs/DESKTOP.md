# The desktop app

BlackVault for Windows, macOS and Linux, built with Electron from the same code as the web wallet
(`next/src`), plus `next/src-electron`:

- `electron-main.ts`: the window, links from dApps, updates, and what the page may do.
- `electron-preload.ts`: the only bridge to the page (`window.blackvaultDesktop`: links and updates).

## How it works

- **Origin.** The app runs as `https://wallet.blackvemarket.com`. Requests to that host are answered from the
  files inside the app; the server's paths (`/api`, `/push`, `/relay`, `/health`, `/status`, `/config`,
  `/errors`) go to the network. So the server, WalletConnect (the Reown project's domains) and BlackVeMarket
  treat it as the web wallet, while its code never comes from the network. Other hosts pass through.
- **Storage.** The app's own (Electron's profile folder), apart from any browser: a wallet is restored or
  imported once in the app. Uninstalling leaves it in place (`%APPDATA%\BlackVault` on Windows).
- **Links.** dApps open `blackvault:sign?src=<relay url>` (`connect.js`, docs/CONNECT.md). The app also takes
  `connex:` links, like Sync2's desktop app, unless Sync2 is installed and has them. One copy runs at a time;
  a link reaches the running copy.
- **Safety.** The page is sandboxed with context isolation and no Node; it can't navigate elsewhere or open
  windows (links go to the browser); only the camera (QR codes), clipboard writes and notifications are
  allowed; developer tools are off in a release build.
- **Updates.** `electron-updater` looks at this repository's GitHub Releases at start and every 6 hours,
  downloads in the background, and the app shows its usual Update tip; Update restarts on the new version
  (or it installs at the next start).

## Developing

```bash
cd next
npm ci && npm ci --prefix src-electron
npm run dev:desktop
```

## Releasing

1. Raise the version and the changelog as for any release (docs/DEPLOY.md, "Releasing a version").
2. Actions › Desktop › Run workflow (or push a tag `v2.2.0`). It builds on Windows, macOS and Linux and
   uploads the installers to a **draft** release named after the version.
3. Check the draft (download, install, open), then **Publish release**. From then on every installed app
   updates to it. Nothing reaches users before you publish.

A local Windows build: `MSYS_NO_PATHCONV=1 SERVER_URL=/ NODE_OPTIONS=--openssl-legacy-provider npm run build:desktop`
→ `dist/electron/Packaged/BlackVault-<version>-win-x64.exe`.

## Code signing (not set up yet)

Without a certificate the installers work, but:

- **Windows** shows SmartScreen ("Windows protected your PC" › More info › Run anyway) until the app has a
  reputation, or it is signed with a code-signing certificate (an EV or Azure Trusted Signing certificate
  removes the warning at once). Add it as `CSC_LINK` / `CSC_KEY_PASSWORD` secrets and drop
  `CSC_IDENTITY_AUTO_DISCOVERY` from `.github/workflows/desktop.yml`.
- **macOS** won't open an unsigned download by double-click (right-click › Open, or System Settings ›
  Privacy & Security › Open Anyway), and updates on macOS need a signed app. That takes an Apple Developer
  account ($99/year): `CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`,
  `APPLE_TEAM_ID`, and `notarize: true` under `mac` in `quasar.config.ts`.
- **Linux** (AppImage) needs nothing.
