import { register } from 'register-service-worker'

register(import.meta.env.QUASAR_SERVICE_WORKER_FILE, {
    ready() {
        console.log('Service worker is active.')
    },
    registered() {
        console.log('Service worker has been registered.')
    },
    cached() {
        console.log('Content has been cached for offline use.')
    },
    updatefound(registration) {
        console.log('New content is downloading.')
        const installing = registration.installing
        registration.active && installing && installing.addEventListener('statechange', () => {
            if (installing.state === 'installed') {
                console.log('New content is installed')
                // shows the upgrade tip (pages/Index/UpgradeTip.vue)
                window.AppState.updateAvailable = true
            }
        })
    },
    updated() {
        console.log('New content is available')
    },
    offline() {
        console.log('No internet connection found. App is running in offline mode.')
    },
    error(err) {
        console.error('Error during service worker registration:', err)
    }
})
