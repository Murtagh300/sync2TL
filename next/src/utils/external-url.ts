import { desktop } from './desktop'

/**
 * listen external url used to start this app (blackvault:sign?... and connex:sign?... links).
 * The desktop app hands them over (src-electron); the native app (phase 6) hooks in here too.
 * In the browser the sign request arrives as a route instead (see App.vue).
 * @returns the url
 */
const queue: string[] = []
let waiting: ((url: string) => void) | null = null
let started = false

export function listen(): Promise<string> {
    if (!desktop) return new Promise(() => { }) // never resolves
    if (!started) {
        started = true
        desktop.onExternalUrl(url => {
            if (waiting) {
                const w = waiting
                waiting = null
                w(url)
            } else {
                queue.push(url)
            }
        })
    }
    const next = queue.shift()
    if (next) return Promise.resolve(next)
    return new Promise(resolve => { waiting = resolve })
}
