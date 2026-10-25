import { reactive } from 'vue'

/** whether the device is online, kept current from the browser's events */
export const network = reactive({
    online: typeof navigator === 'undefined' ? true : navigator.onLine
})

if (typeof window !== 'undefined') {
    window.addEventListener('online', () => { network.online = true })
    window.addEventListener('offline', () => { network.online = false })
}

/** resolves when the device is back online (at once when it is) */
export function whenOnline(): Promise<void> {
    if (network.online) {
        return Promise.resolve()
    }
    return new Promise(resolve => window.addEventListener('online', () => resolve(), { once: true }))
}
