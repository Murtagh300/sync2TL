<template>
    <div
        @mousedown.capture="testTouchPan"
        @touchstart.capture="testTouchPan"
        v-touch-pan.right.mouse.prevent="handleTouchPan"
        :class="{'stack--disable-pointer-events': transiting}"
    >
        <div
            v-for="(entry, i) in stack"
            :key="entry.depth"
            class="absolute-full bg-page"
            :class="viewClasses(i)"
        >
            <component
                class="stack-page"
                :is="entry.component"
                v-bind="entryToBinds(entry)"
            />
        </div>
        <div
            ref="backdrop"
            class="absolute-full stack-backdrop"
            v-show="panning||transiting"
        />
        <q-resize-observer @resize="onResize" />
    </div>
</template>
<script lang="ts">
import { defineComponent, markRaw, unref, type ComputedRef, type Ref } from 'vue'
import { matchedRouteKey, viewDepthKey, type RouteRecordNormalized } from 'vue-router'
import { newVelometer, newPipeline, transitionEnd } from 'src/utils/transit'
import { scopedEntries, stack, type ScopedEntry } from 'src/router/stack'

export default defineComponent({
    // the record of the route component this view lives in, and its depth
    inject: {
        matchedRoute: { from: matchedRouteKey, default: undefined },
        viewDepth: { from: viewDepthKey, default: 0 }
    },
    data: () => {
        return {
            stack: [] as ScopedEntry[],
            width: 0,
            panning: false,
            transiting: false,
            panRatio: 0,
            transitionMul: 1,
            shouldHandlePan: false,
            velometer: markRaw(newVelometer()),
            pipeline: markRaw(newPipeline()),
            touchPanInitOffset: 0
        }
    },
    computed: {
        scoped(): ScopedEntry[] {
            // options-API inject drops the InjectionKey types and unwraps refs (Vue 3.3+)
            const root = unref(this.matchedRoute as ComputedRef<RouteRecordNormalized | undefined> | RouteRecordNormalized | undefined)
            const depth = unref(this.viewDepth as Ref<number> | number)
            // views rendered by the router-view at depth d sit at matched[d - 1]
            return scopedEntries(root, depth - 1, stack.full)
        }
    },
    created() {
        this.stack = this.scoped
    },
    methods: {
        animatedViews() {
            // the top two pages (see viewClasses) and the backdrop
            const el = this.$el as HTMLElement
            return [
                el.querySelector<HTMLElement>(':scope > .stack-v1'),
                el.querySelector<HTMLElement>(':scope > .stack-v2'),
                this.$refs.backdrop as HTMLElement
            ].filter((v): v is HTMLElement => !!v)
        },
        async transit(ratios: { r1?: number, r2?: number, r3?: number }) {
            this.transiting = true
            if (ratios.r1 !== undefined) {
                this.panRatio = ratios.r1
            }
            await this.$nextTick()

            document.body.classList.add('stack-body--prevent-scroll')
            const views = this.animatedViews()
            views.forEach(v => v.classList.add('stack-transition'))

            if (ratios.r2 !== undefined) {
                this.panRatio = ratios.r2
            }

            await Promise.all(views.map(v => transitionEnd(v)))

            views.forEach(v => v.classList.remove('stack-transition'))

            document.body.classList.remove('stack-body--prevent-scroll')
            this.transitionMul = 1
            if (ratios.r3 !== undefined) {
                this.panRatio = ratios.r3
            }
            this.transiting = false
        },
        onResize(size: { width: number }) {
            if (size.width > 0) {
                this.width = size.width
            }
        },
        viewClasses(i: number) {
            const classes: Record<string, boolean> = {}
            if (i === this.stack.length - 1) {
                classes['stack-v1'] = true
            } else if (i === this.stack.length - 2) {
                classes['stack-v2'] = true
                classes.hidden = !this.panning && !this.transiting
            } else {
                classes.hidden = true
            }
            return classes
        },
        testTouchPan(ev: TouchEvent | MouseEvent) {
            const rect = (this.$el as HTMLElement).getBoundingClientRect()
            const x = ('targetTouches' in ev ? ev.targetTouches[0]!.clientX : ev.clientX) - rect.x
            const stack = this.stack
            this.shouldHandlePan = x >= 0 && x < rect.width /* / 2 */ &&
                (stack.length > 1 || (!!stack[0] && stack[0].depth > 0))
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        handleTouchPan(ev: any) {
            if (!this.shouldHandlePan && !this.panning) {
                // nothing to go back to: let the gesture go (Quasar 2 needs a handler at all times)
                return false
            }
            if (ev.isFirst) {
                document.body.classList.add('stack-body--prevent-scroll')
                this.panning = true
                this.touchPanInitOffset = ev.offset.x
            }

            const offset = Math.max(0, ev.offset.x - this.touchPanInitOffset)
            const width = Math.max(1, this.width)

            if (ev.isFinal) {
                this.panning = false
                const v = this.velometer.velocity
                const triggered = (offset > width / 2 && v >= 0) || v > 0.3
                if (triggered) {
                    this.transitionMul = 0.4
                    void this.pipeline.run(() => this.transit({ r2: 1, r3: 0 }))
                        .then(() => {
                            this.stack.pop()
                            this.$router.back()
                        })
                } else {
                    if (offset) {
                        this.transitionMul = 0.6
                        void this.pipeline.run(() => this.transit({ r2: 0 }))
                    }
                }
            } else {
                const ratio = offset / width
                this.panRatio = ratio
            }
            this.velometer.update(ev.duration, ev.delta.x)
        },
        entryToBinds(entry: ScopedEntry) {
            const binds: Record<string, string> = {}
            const varNameRegExp = /^[a-z][a-z0-9]*$/i
            for (const e of Object.entries(entry.query)) {
                if (varNameRegExp.test(e[0])) {
                    binds[e[0]] = (e[1] || '').toString()
                }
            }
            for (const e of Object.entries(entry.params)) {
                if (varNameRegExp.test(e[0])) {
                    binds[e[0]] = e[1].toString()
                }
            }
            return binds
        }
    },
    watch: {
        width(newVal: number) {
            (this.$el as HTMLElement).style.setProperty('--stack-container-width', `${newVal}`)
        },
        panRatio(newVal: number) {
            (this.$el as HTMLElement).style.setProperty('--stack-pan-ratio', `${newVal}`)
        },
        transitionMul(newVal: number) {
            (this.$el as HTMLElement).style.setProperty('--stack-transition-mul', `${newVal}`)
        },
        scoped(newVal: ScopedEntry[], oldVal: ScopedEntry[]) {
            // TODO more accurate transition judgement
            void this.pipeline.run(async () => {
                if (!stack.appTriggered) {
                    this.stack = newVal
                    return
                }
                if (newVal.length > oldVal.length && newVal.length > 1) {
                    // push in
                    this.stack = newVal
                    const v1 = newVal[newVal.length - 1]!

                    if (!v1.query['no-transition-in'] && !v1.meta.noTransitionIn) {
                        await this.transit({ r1: 1, r2: 0 })
                    }
                } else if (newVal.length < oldVal.length && newVal.length > 0) {
                    // pop out
                    const v1 = this.stack[this.stack.length - 1]!
                    if (!v1.query['no-transition-out'] && !v1.meta.noTransitionOut) {
                        await this.transit({ r2: 1, r3: 0 })
                    }
                    this.stack = newVal
                } else {
                    this.stack = newVal
                }
            })
        }
    }
})
</script>
<style >
:root {
    --stack-pan-ratio: 0;
    --stack-container-width: 0;
    --stack-transition-mul: 1;
}

.stack-v1 {
    transform: translateX(
        calc(var(--stack-container-width) * var(--stack-pan-ratio) * 1px)
    );
}
.stack-v2 {
    transform: translateX(
        calc(
            var(--stack-container-width) * (var(--stack-pan-ratio) - 1) * 0.3 *
                1px
        )
    );
}
.stack-backdrop {
    background: black;
    opacity: calc((1 - var(--stack-pan-ratio)) * 0.2);
    transform: translateX(
        calc(var(--stack-container-width) * (var(--stack-pan-ratio) - 1) * 1px)
    );
}
.stack-transition {
    transition: all calc(0.35s * var(--stack-transition-mul));
}
.stack-body--prevent-scroll {
    position: fixed !important;
}
.stack--disable-pointer-events,
.stack--disable-pointer-events * {
    pointer-events: none !important;
}
</style>
