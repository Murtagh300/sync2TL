// vue-async-computed 4 runs on Vue 3 but still ships Vue 2 typings.
//
// Convention: declare every async computed key in data() with its type and
// `null` as value. The plugin replaces the value at runtime, the declaration
// gives templates and `this` the type:
//
//   data: () => ({ balance: null as string | null }),
//   asyncComputed: { balance() { return this.$svc.bc(gid).balanceOf(addr, token) } }

import type { IASyncComputedState } from 'vue-async-computed'

type AsyncComputedGetter = () => Promise<unknown> | unknown

declare module 'vue' {
    interface ComponentCustomOptions {
        asyncComputed?: Record<string, AsyncComputedGetter | {
            get: AsyncComputedGetter
            default?: unknown
            watch?: string[] | (() => void)
            shouldUpdate?: () => boolean
            lazy?: boolean
        }>
    }

    interface ComponentCustomProperties {
        $asyncComputed: Record<string, IASyncComputedState>
    }
}
