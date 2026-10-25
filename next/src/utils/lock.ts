import { reactive } from 'vue'

/** whether the app is locked (components/AppLock.vue); lockNow() is the button in the header */
export const lockState = reactive({ locked: false })

export function lockNow() {
    lockState.locked = true
}
