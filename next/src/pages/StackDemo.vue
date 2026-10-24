<template>
    <div class="column no-wrap q-pa-md q-gutter-y-md items-center">
        <div class="text-h5" data-test="title">Stack page {{ level }}</div>
        <div class="text-caption text-grey" data-test="info">
            depth {{ depth }} · canGoBack {{ canGoBack }} · note "{{ note }}"
        </div>
        <q-input
            v-model="memo"
            dense
            outlined
            label="Type something, push, then come back"
            style="width: min(360px, 100%)"
            data-test="memo"
        />
        <div class="row q-gutter-sm justify-center">
            <q-btn color="primary" no-caps label="Push" data-test="push" @click="push(false)" />
            <q-btn color="primary" no-caps label="Push (no transition)" data-test="push-quiet" @click="push(true)" />
            <q-btn color="primary" no-caps outline label="Replace" data-test="replace" @click="replace" />
            <q-btn color="primary" no-caps outline label="Back" data-test="back" @click="$backOrHome()" />
        </div>
        <div class="text-caption text-grey text-center" style="max-width: 360px">
            On a touch screen (or with the mouse) drag from the left to swipe back.
        </div>
    </div>
</template>

<script lang="ts">
// Phase 3 only: exercises the navigation stack. Removed when the real pages land (phase 4).
import { defineComponent } from 'vue'
import { stack } from 'src/router/stack'

export default defineComponent({
    // bound from the route params / query by StackedRouterView
    props: {
        level: { type: String, default: '1' },
        note: { type: String, default: '' }
    },
    data: () => ({
        memo: '',
        depth: stack.full[stack.full.length - 1]?.depth ?? 0
    }),
    computed: {
        canGoBack() {
            return stack.canGoBack
        }
    },
    methods: {
        push(quiet: boolean) {
            const next = String((parseInt(this.level) || 0) + 1)
            return this.$router.push({
                name: 'stack-demo',
                params: { level: next },
                query: quiet ? { note: `from ${this.level}`, 'no-transition-in': '1' } : { note: `from ${this.level}` }
            })
        },
        replace() {
            return this.$router.replace({
                name: 'stack-demo',
                params: { level: `${this.level}r` },
                query: { note: 'replaced' }
            })
        }
    }
})
</script>
