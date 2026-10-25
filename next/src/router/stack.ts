// The navigation stack behind StackedRouterView: every history entry the app
// visits gets a depth, and the pages of the entries below the current one stay
// mounted so they can slide back in (button or swipe), like a native app.
//
// Replaces vue-router-stack (Vue 2 only). vue-router 4+ keeps a position per
// history entry in history.state, so the depth comes from there instead of
// wrapping history.pushState/replaceState.
import { markRaw, shallowReactive, type Component } from 'vue'
import type { RouteLocationNormalized, RouteRecordNormalized, Router } from 'vue-router'

export interface StackEntry extends RouteLocationNormalized {
    /** 0 for the first entry the app was opened with */
    depth: number
}

export interface ScopedEntry extends StackEntry {
    /** the route record rendered directly under the stacked view */
    record: RouteRecordNormalized
    component: Component
}

/** set to skip the slide of the next push (another animation is running) */
let skipTransition = false

export function skipNextTransition() {
    skipTransition = true
}

/** whether the next push slides; resets the skip */
export function takeSkipTransition() {
    const skip = skipTransition
    skipTransition = false
    return skip
}

const state = shallowReactive({
    entries: [] as StackEntry[],
    /** false when the last navigation came from the browser (back button, typed url) */
    appTriggered: false
})

export const stack = {
    /** whether there's an entry of this app to go back to */
    get canGoBack() {
        const top = state.entries[state.entries.length - 1]
        return !!top && top.depth > 0
    },
    get full(): readonly StackEntry[] {
        return state.entries
    },
    get appTriggered() {
        return state.appTriggered
    }
}

/** sessionStorage key for the history position the app was opened at (per tab, survives reloads) */
export const BASE_KEY = 'blackvault:stack-base'

function historyPosition() {
    const s = window.history.state as { position?: unknown } | null
    return typeof s?.position === 'number' ? s.position : 0
}

export function installStack(router: Router, storage: Pick<Storage, 'getItem' | 'setItem'> = window.sessionStorage) {
    const saved = storage.getItem(BASE_KEY)
    let base = saved === null ? NaN : Number(saved)
    if (!Number.isFinite(base)) {
        base = historyPosition()
        storage.setItem(BASE_KEY, String(base))
    }

    // pops (browser back/forward, typed url) go through the history listener;
    // router.go/back/forward are pops the app asked for
    let popPending = false
    let appGo = false
    router.options.history.listen(() => { popPending = true })
    for (const name of ['go', 'back', 'forward'] as const) {
        const original = router[name] as (...args: unknown[]) => unknown
        (router as unknown as Record<string, unknown>)[name] = (...args: unknown[]) => {
            appGo = true
            return original.apply(router, args)
        }
    }

    router.afterEach((to, _from, failure) => {
        const appTriggered = !popPending || appGo
        popPending = false
        appGo = false
        if (failure) {
            return
        }
        // history.state is already updated when afterEach runs
        const depth = Math.max(0, historyPosition() - base)
        state.entries = [
            ...state.entries.filter(e => e.depth < depth),
            markRaw({ ...to, depth })
        ]
        state.appTriggered = appTriggered
    })
}

/**
 * the entries rendered by a stacked view: the topmost run of consecutive entries
 * that share the view's own route record and have a child route below it
 * @param root the route record of the component holding the stacked view
 * @param rootIndex the index of that record in `matched`
 */
export function scopedEntries(root: RouteRecordNormalized | undefined, rootIndex: number, entries: readonly StackEntry[]): ScopedEntry[] {
    if (!root) {
        return []
    }
    const inScope = (e: StackEntry) => e.matched[rootIndex] === root && !!e.matched[rootIndex + 1]

    const result: ScopedEntry[] = []
    for (let i = entries.length - 1; i >= 0; i--) {
        const e = entries[i]!
        if (!inScope(e)) {
            if (result.length > 0) {
                break
            }
            continue
        }
        const record = e.matched[rootIndex + 1]!
        result.unshift(markRaw({
            ...e,
            record,
            component: record.components!.default as Component
        }))
    }
    return result
}
