/**
 * Updating the installed app: the service worker of the new version waits (src-pwa/register-sw.ts)
 * until this tells it to take over, then the page reloads once on the new version.
 */
export async function applyUpdate() {
    const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration().catch(() => undefined) : undefined
    const waiting = reg?.waiting
    if (!waiting) {
        window.location.reload()
        return
    }
    let reloaded = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloaded) return
        reloaded = true
        window.location.reload()
    })
    // understood by the Workbox service worker
    waiting.postMessage({ type: 'SKIP_WAITING' })
    // if it doesn't take over (an old worker), reload anyway
    setTimeout(() => {
        if (!reloaded) window.location.reload()
    }, 4000)
}
