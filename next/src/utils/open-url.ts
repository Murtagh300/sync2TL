import { openURL as defaultOpen } from 'quasar'

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
