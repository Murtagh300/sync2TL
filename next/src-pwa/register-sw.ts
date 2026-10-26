import { register } from 'register-service-worker'

/*
 * Updates: a new version is downloaded in the background and waits until the user chooses
 * "Update" (src/utils/app-update.ts). Taking over a running page halfway would mix old and
 * new code: a screen opened later could ask for a file the new version no longer has.
 */
register(import.meta.env.QUASAR_SERVICE_WORKER_FILE, {
    registered(registration) {
        // look for a new version every hour, and when the app comes back to the front
        setInterval(() => void registration.update().catch(() => { }), 60 * 60 * 1000)
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') void registration.update().catch(() => { })
        })
    },
    updated() {
        // a new version is installed and waiting: shows the update tip (pages/Index/UpgradeTip.vue)
        window.AppState.updateAvailable = true
    },
    offline() {
        console.log('No internet connection found. App is running in offline mode.')
    },
    error(err) {
        console.error('Error during service worker registration:', err)
    }
})
