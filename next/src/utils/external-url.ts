/**
 * listen external url used to start this app (connex:sign?... links).
 * The desktop app (phase 5) and the native app (phase 6) hook in here; in the
 * browser the sign request arrives as a route instead (see App.vue).
 * @returns the url
 */
export function listen(): Promise<string> {
    return new Promise(() => { }) // never resolves
}
