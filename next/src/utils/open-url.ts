import { openURL as defaultOpen } from 'quasar'
import { desktop } from './desktop'

// the native app (phase 6) may open links in the system browser instead
export const openURL = (url: string) => {
    // links can come from APIs and dApps: only web pages, never javascript: or data: URLs
    let parsed: URL
    try {
        parsed = new URL(url, window.location.href)
    } catch {
        return
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        console.warn('refused to open', parsed.protocol, 'link')
        return
    }
    defaultOpen(parsed.href, undefined, { noopener: true, noreferrer: true })
}

/** a dApp: in the desktop app, in a window of its own (its wallet links come to BlackVault); elsewhere as a link */
export const openDapp = (url: string) => {
    let parsed: URL
    try {
        parsed = new URL(url, window.location.href)
    } catch {
        return
    }
    if (desktop?.openDapp && parsed.protocol === 'https:') {
        desktop.openDapp(parsed.href)
        return
    }
    openURL(parsed.href)
}
