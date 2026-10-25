import { watch } from 'vue'
import { haptic, prefs } from './prefs'

/**
 * Privacy mode: hide every balance with a shake of the phone (when turned on in settings).
 * Two hard jolts within ~0.8 s count as a shake; walking or turning the phone doesn't.
 */

const THRESHOLD = 22 // m/s², gravity included

/** feed it accelerations; true when they add up to a shake */
export function shakeDetector() {
    let jolts: number[] = []
    let quietUntil = 0
    return (x: number, y: number, z: number, now: number): boolean => {
        if (now < quietUntil || Math.hypot(x, y, z) < THRESHOLD) {
            return false
        }
        jolts = [...jolts.filter(t => now - t < 800), now]
        if (jolts.length < 2) {
            return false
        }
        jolts = []
        quietUntil = now + 1500
        return true
    }
}

const isShake = shakeDetector()

function onMotion(e: DeviceMotionEvent) {
    const a = e.accelerationIncludingGravity
    if (!a || a.x == null || a.y == null || a.z == null) {
        return
    }
    if (isShake(a.x, a.y, a.z, Date.now())) {
        prefs.hideBalances = !prefs.hideBalances
        haptic('success')
    }
}

/** iOS asks for motion access, and only from a tap: call this from the settings toggle */
export async function requestMotion(): Promise<boolean> {
    const Motion = (globalThis as { DeviceMotionEvent?: { requestPermission?: () => Promise<string> } }).DeviceMotionEvent
    if (!Motion) {
        return false
    }
    if (typeof Motion.requestPermission === 'function') {
        try {
            return (await Motion.requestPermission()) === 'granted'
        } catch {
            return false
        }
    }
    return true
}

export function motionSupported() {
    return typeof window !== 'undefined' && 'DeviceMotionEvent' in window
}

/** start or stop listening as the setting changes */
export function setupShake() {
    const apply = (on: boolean) => {
        window.removeEventListener('devicemotion', onMotion)
        if (on) {
            window.addEventListener('devicemotion', onMotion)
        }
    }
    apply(prefs.shakeToHide)
    watch(() => prefs.shakeToHide, on => apply(on))
}

/** amounts that don't go through AmountLabel or money() are blurred by this class (app.sass) */
export function setupPrivacyClass() {
    const apply = (on: boolean) => document.body.classList.toggle('bv-private', on)
    apply(prefs.hideBalances)
    watch(() => prefs.hideBalances, on => apply(on))
}
