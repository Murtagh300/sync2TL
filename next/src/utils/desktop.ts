/**
 * The desktop app (src-electron): what its preload script adds to the page. Absent in the web app.
 */

type Desktop = {
    platform: string
    onExternalUrl(cb: (url: string) => void): void
    onUpdateReady(cb: (version: string) => void): void
    installUpdate(): Promise<void>
    notify(title: string, body: string): void
    getPrefs(): Promise<DesktopPrefs | null>
    setPrefs(prefs: Partial<Pick<DesktopPrefs, 'keepInTray' | 'openAtLogin'>>): Promise<void>
    setLabels(labels: Record<string, string>): void
}

/** the tray and starting with the computer (what this system has of them) */
export type DesktopPrefs = { keepInTray: boolean, openAtLogin: boolean, canTray: boolean, canLogin: boolean }

export const desktop: Desktop | null = (typeof window !== 'undefined' && (window as { blackvaultDesktop?: Desktop }).blackvaultDesktop) || null

/** where the desktop app is downloaded: the latest release, with the installer for each system */
export const DESKTOP_DOWNLOAD = 'https://github.com/Murtagh300/sync2TL/releases/latest'
