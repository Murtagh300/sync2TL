import { prefs } from './prefs'

/**
 * A short two-note chime when VET, a token or an NFT comes in (Settings › Sound). Made with
 * Web Audio: nothing to download, and quiet enough not to startle.
 */
let ctx: AudioContext | null = null

export function playChime() {
    if (!prefs.sound || typeof window === 'undefined' || document.visibilityState !== 'visible') {
        return
    }
    try {
        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        if (!Ctx) return
        ctx = ctx || new Ctx()
        const now = ctx.currentTime
        // E6 then A6: up, like something arriving
        for (const [i, freq] of [1318.5, 1760].entries()) {
            const osc = ctx.createOscillator()
            const gain = ctx.createGain()
            osc.type = 'sine'
            osc.frequency.value = freq
            const start = now + i * 0.11
            gain.gain.setValueAtTime(0, start)
            gain.gain.linearRampToValueAtTime(0.08, start + 0.015)
            gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.35)
            osc.connect(gain).connect(ctx.destination)
            osc.start(start)
            osc.stop(start + 0.4)
        }
    } catch {
        // no audio: a silent wallet is fine
    }
}
