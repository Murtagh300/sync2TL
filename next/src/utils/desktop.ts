/**
 * The desktop app (src-electron): what its preload script adds to the page. Absent in the web app.
 */

type Desktop = {
    platform: string
    onExternalUrl(cb: (url: string) => void): void
    onUpdateReady(cb: (version: string) => void): void
    installUpdate(): Promise<void>
}

export const desktop: Desktop | null = (typeof window !== 'undefined' && (window as { blackvaultDesktop?: Desktop }).blackvaultDesktop) || null
