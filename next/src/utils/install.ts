import { reactive } from 'vue'
import { desktop } from './desktop'

/**
 * Installing BlackVault as an app (PWA): on a PC in Chrome or Edge it gets its own window, a Start
 * menu / Launchpad entry and a taskbar icon; on a phone it goes on the home screen. Chrome and Edge
 * offer an install prompt the app can show itself; Safari and others are installed by hand
 * (`installHelp` says how).
 */

type PromptEvent = Event & { prompt(): Promise<void>, userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

export const install = reactive({
    /** the browser's own install prompt, when it offers one */
    prompt: null as PromptEvent | null,
    /** running as the installed app */
    installed: false
})

export function runningInstalled(): boolean {
    if (typeof window === 'undefined') return false
    // the desktop app is installed already
    if (desktop) return true
    return window.matchMedia?.('(display-mode: standalone)').matches ||
        window.matchMedia?.('(display-mode: window-controls-overlay)').matches ||
        (navigator as { standalone?: boolean }).standalone === true
}

let started = false
/** listen for the prompt from the start: the browser fires it once, early */
export function startInstallWatch() {
    if (started || typeof window === 'undefined') return
    started = true
    install.installed = runningInstalled()
    window.addEventListener('beforeinstallprompt', e => {
        e.preventDefault()
        install.prompt = e as PromptEvent
    })
    window.addEventListener('appinstalled', () => {
        install.prompt = null
        install.installed = true
    })
}

/** show the browser's prompt; true when the user installed */
export async function promptInstall(): Promise<boolean> {
    const p = install.prompt
    if (!p) return false
    await p.prompt()
    const { outcome } = await p.userChoice
    install.prompt = null
    return outcome === 'accepted'
}

export type InstallHelp = 'ios' | 'safari-mac' | 'firefox' | 'other'

/** which manual steps fit this browser, when there is no prompt */
export function installHelp(ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''): InstallHelp {
    if (/iPhone|iPad|iPod/i.test(ua)) return 'ios'
    if (/Firefox\//i.test(ua)) return 'firefox'
    if (/Macintosh/i.test(ua) && /Safari\//i.test(ua) && !/Chrome|Chromium|Edg\//i.test(ua)) return 'safari-mac'
    return 'other'
}
