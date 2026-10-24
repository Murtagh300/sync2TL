import { reactive, type App } from 'vue'

type State = {
    app: {
        updateAvailable: boolean
    }
}

declare module 'vue' {
    interface ComponentCustomProperties {
        $state: State
    }
}

declare global {
    interface Window {
        readonly AppState: State['app']
    }
}

export function boot(app: App) {
    const state = reactive<State>({
        app: {
            updateAvailable: false
        }
    })

    app.config.globalProperties.$state = state

    Object.defineProperty(window, 'AppState', {
        get() { return state.app }
    })
}
