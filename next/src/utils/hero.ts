import { nextTick } from 'vue'
import type { RouteLocationRaw, Router } from 'vue-router'
import { skipNextTransition } from 'src/router/stack'

/**
 * A picture that travels from a list to its detail page (an NFT card growing into the
 * NFT page), with the View Transitions API where the browser has it. The detail page
 * shows the hinted picture at once, so there is something to travel to.
 */

type Hint = { key: string, image: string }
let hint: Hint | null = null

export const HERO_NAME = 'bv-hero'

/** the picture to show for this key until the page has its own data */
export function heroHint(key: string): string {
    return hint && hint.key === key ? hint.image : ''
}

function supported() {
    return typeof (document as Document & { startViewTransition?: unknown }).startViewTransition === 'function' &&
        !window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export async function navigateWithHero(router: Router, to: RouteLocationRaw, key: string, image: string, from: HTMLElement | null) {
    hint = { key, image }
    if (!supported() || !from) {
        await router.push(to)
        return
    }
    from.style.viewTransitionName = HERO_NAME
    // the stack's own slide would fight the morph
    skipNextTransition()
    const vt = (document as Document & { startViewTransition: (cb: () => Promise<void>) => { finished: Promise<void> } })
        .startViewTransition(async () => {
            from.style.viewTransitionName = ''
            await router.push(to)
            await nextTick()
            await new Promise(resolve => requestAnimationFrame(resolve))
        })
    await vt.finished.catch(() => { })
}
