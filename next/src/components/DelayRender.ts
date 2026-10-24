import { defineComponent, h } from 'vue'

/* example:
<delay-render :t="100">
  <!-- content rendering will be delayed in 100ms -->
</delay-render>
*/
export default defineComponent({
    props: {
        tag: String,
        t: Number
    },
    data: () => {
        return {
            timeUp: false,
            timer: undefined as ReturnType<typeof setTimeout> | undefined
        }
    },
    created() {
        this.timer = setTimeout(() => {
            this.timeUp = true
        }, this.t)
    },
    beforeUnmount() {
        clearTimeout(this.timer)
    },
    render() {
        if (this.timeUp) {
            const slots = this.$slots.default?.() || []
            if (this.tag) {
                return h(this.tag, slots)
            }
            // Vue 3 renders multiple roots without a wrapper
            return slots
        }
        return null
    }
})
