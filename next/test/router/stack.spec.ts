// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { createRouter, createWebHashHistory, type Router } from 'vue-router'

const Page = defineComponent({ render: () => null })
const routes = [
    {
        path: '/',
        component: Page,
        children: [
            { path: '', name: 'index', component: Page },
            { path: 'p/:n', name: 'p', component: Page }
        ]
    },
    { path: '/outside', name: 'outside', component: Page }
]

type StackModule = typeof import('src/router/stack')
let mod: StackModule
let router: Router

/** resolves after the next navigation finished (afterEach) */
function navigated(r: Router) {
    return new Promise<void>(resolve => {
        const remove = r.afterEach(() => {
            remove()
            // let installStack's afterEach (registered first) settle
            setTimeout(resolve, 0)
        })
    })
}

async function setup(storage = new Map<string, string>()) {
    vi.resetModules()
    mod = await import('src/router/stack')
    router = createRouter({ history: createWebHashHistory(), routes })
    mod.installStack(router, {
        getItem: k => storage.get(k) ?? null,
        setItem: (k, v) => { storage.set(k, v) }
    })
    await router.push('/')
    return storage
}

const depths = () => mod.stack.full.map(e => e.depth)
const top = () => mod.stack.full[mod.stack.full.length - 1]!

beforeEach(() => setup())

describe('stack depth', () => {
    it('starts at depth 0 and grows with every push', async () => {
        expect(depths()).toEqual([0])
        expect(mod.stack.canGoBack).toBe(false)

        await router.push('/p/1')
        await router.push('/p/2')
        expect(depths()).toEqual([0, 1, 2])
        expect(top().params).toEqual({ n: '2' })
        expect(mod.stack.canGoBack).toBe(true)
        expect(mod.stack.appTriggered).toBe(true)
    })

    it('drops the top entry on router.back() and counts it as app triggered', async () => {
        await router.push('/p/1')
        await router.push('/p/2')
        const done = navigated(router)
        router.back()
        await done
        expect(depths()).toEqual([0, 1])
        expect(top().params).toEqual({ n: '1' })
        expect(mod.stack.appTriggered).toBe(true)
    })

    it('marks the browser back button as not app triggered (no animation)', async () => {
        await router.push('/p/1')
        const done = navigated(router)
        window.history.back()
        await done
        expect(depths()).toEqual([0])
        expect(mod.stack.appTriggered).toBe(false)
    })

    it('replaces the top entry in place', async () => {
        await router.push('/p/1')
        await router.replace('/p/9')
        expect(depths()).toEqual([0, 1])
        expect(top().params).toEqual({ n: '9' })
    })

    it('cuts off forward entries when pushing after going back', async () => {
        await router.push('/p/1')
        await router.push('/p/2')
        const done = navigated(router)
        router.back()
        await done
        await router.push('/p/3')
        expect(depths()).toEqual([0, 1, 2])
        expect(top().params).toEqual({ n: '3' })
    })
})

describe('stack base', () => {
    it('remembers where the app was opened, so a reload keeps the depth', async () => {
        const storage = await setup()
        await router.push('/p/1')
        await router.push('/p/2')
        // simulate a reload in the same tab: same history, same sessionStorage
        await setup(storage)
        expect(top().depth).toBe(2)
        expect(mod.stack.canGoBack).toBe(true)
    })

    it('treats the first entry of a fresh tab as depth 0, whatever came before', async () => {
        await router.push('/p/1')
        await router.push('/p/2')
        // a new tab with history of other sites before it: new sessionStorage
        await setup(new Map())
        expect(depths()).toEqual([0])
        expect(mod.stack.canGoBack).toBe(false)
    })
})

describe('scopedEntries', () => {
    it('returns the consecutive entries under the root record, newest last', async () => {
        await router.push('/p/1')
        await router.push('/p/2')
        const root = router.getRoutes().find(r => r.path === '/' && r.children.length > 0)!
        const scoped = mod.scopedEntries(root, 0, mod.stack.full)
        expect(scoped.map(e => e.depth)).toEqual([0, 1, 2])
        expect(scoped.map(e => e.record.name)).toEqual(['index', 'p', 'p'])
        expect(scoped[2]!.component).toBe(Page)
    })

    it('stops at an entry outside the scope', async () => {
        await router.push('/p/1')
        await router.push('/outside')
        await router.push('/p/2')
        await router.push('/p/3')
        const root = router.getRoutes().find(r => r.path === '/' && r.children.length > 0)!
        expect(mod.scopedEntries(root, 0, mod.stack.full).map(e => e.depth)).toEqual([3, 4])
    })

    it('is empty without a root record', () => {
        expect(mod.scopedEntries(undefined, 0, mod.stack.full)).toEqual([])
    })
})
