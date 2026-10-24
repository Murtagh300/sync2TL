<template>
    <div
        class="fixed fullscreen column flex-center z-max no-outline"
        v-nofocusout
    >
        <delay-render :t="250">
            <transition
                name="q-transition--fade"
                appear
            >
                <q-spinner-ios
                    :size="80"
                    color="primary"
                />
            </transition>
        </delay-render>
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import { QSpinnerIos } from 'quasar'
import DelayRender from './DelayRender'
import { nofocusout } from 'boot/directives'

// mounted as its own app by $loading, so it brings its own components and directive
export default defineComponent({
    components: { QSpinnerIos, DelayRender },
    directives: { nofocusout },
    mounted() {
        (this.$el as HTMLElement).focus()
    }
})
</script>
