<template>
    <component
        :is="tag"
        v-intersection="options"
    >
        <slot :entry="entry" />
    </component>
</template>
<script lang="ts">
import { defineComponent } from 'vue'

export default defineComponent({
    props: {
        tag: { default: 'div' },
        cfg: Object as () => { root?: Element, rootMargin?: string, threshold?: readonly number[] }
    },
    data: () => {
        return {
            entry: {} as IntersectionObserverEntry | Record<string, never>
        }
    },
    computed: {
        options() {
            return {
                handler: (entry?: IntersectionObserverEntry) => { this.entry = entry || {} },
                cfg: this.cfg
            }
        }
    }
})
</script>
