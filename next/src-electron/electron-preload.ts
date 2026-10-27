import { contextBridge, ipcRenderer } from 'electron'

/**
 * What the desktop app adds to the page, as window.blackvaultDesktop (src/utils/desktop.ts):
 * links from dApps, updates, notifications and the tray. Nothing else of Electron or Node reaches the page.
 */
contextBridge.exposeInMainWorld('blackvaultDesktop', {
    platform: process.platform,
    /** blackvault: and connex: links; the ones that came before this call are delivered too */
    onExternalUrl(cb: (url: string) => void) {
        ipcRenderer.on('external-url', (_e, url: string) => cb(url))
        ipcRenderer.send('external-url-ready')
    },
    /** a new version is downloaded and installs on installUpdate() or the next start */
    onUpdateReady(cb: (version: string) => void) {
        ipcRenderer.on('update-ready', (_e, version: string) => cb(version))
    },
    installUpdate(): Promise<void> {
        return ipcRenderer.invoke('install-update')
    },
    /** a system notification; clicking it shows the app */
    notify(title: string, body: string) {
        ipcRenderer.send('notify', title, body)
    },
    /** the tray and starting with the computer */
    getPrefs(): Promise<{ keepInTray: boolean, openAtLogin: boolean, canTray: boolean, canLogin: boolean } | null> {
        return ipcRenderer.invoke('desktop-prefs')
    },
    setPrefs(prefs: { keepInTray?: boolean, openAtLogin?: boolean }): Promise<void> {
        return ipcRenderer.invoke('set-desktop-prefs', prefs)
    },
    /** the tray menu in the app's language */
    setLabels(labels: Record<string, string>) {
        ipcRenderer.send('tray-labels', labels)
    }
})
