import { defineComponent, h } from 'vue'

/*
<async-resolve tag="div" :promise="promiseObject" v-slot="{data, state}">
    <!-- go go go -->
</async-resolve>
*/
export default defineComponent({
    props: {
        tag: String,
        promise: Promise as unknown as () => (Promise<unknown> | null)
    },
    data: () => ({
        // async computed (see src/shims-async-computed.d.ts)
        data: null as unknown
    }),
    asyncComputed: {
        data(): Promise<unknown> {
            if (!this.promise) {
                return Promise.resolve(this.data)
            }
            return this.promise
        }
    },
    render() {
        const children = this.$slots.default?.({
            data: this.data,
            state: this.$asyncComputed.data
        }) || []

        if (this.tag) {
            return h(this.tag, children)
        }
        // Vue 3 renders multiple roots without a wrapper
        return children
    }
})
