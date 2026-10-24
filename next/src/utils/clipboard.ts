import { copyToClipboard } from 'quasar'

// the native app (phase 6) may swap this for a Capacitor clipboard call
export function copyText(text: string): Promise<void> {
    return copyToClipboard(text)
}
