import { copyToClipboard } from 'quasar'
import { haptic } from './prefs'
import { noteCopied } from './clipboard-guard'

// the native app (phase 6) may swap this for a Capacitor clipboard call
export function copyText(text: string): Promise<void> {
    haptic()
    noteCopied(text)
    return copyToClipboard(text)
}
