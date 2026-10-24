import { openURL as defaultOpen } from 'quasar'

// the native app (phase 6) may open links in the system browser instead
export const openURL = (url: string) => {
    defaultOpen(url)
}
