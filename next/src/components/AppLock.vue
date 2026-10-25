<template>
    <transition name="lock">
        <div
            v-if="locked"
            class="app-lock column flex-center"
            role="dialog"
            aria-modal="true"
        >
            <img
                src="~assets/bvm-logo.png"
                alt="BVM"
                class="lock-logo"
            >
            <div class="bvm-display lock-title q-mt-lg">{{$t('lock.title')}}</div>
            <p class="text-soft q-mt-sm">{{$t('lock.msg')}}</p>
            <q-btn
                unelevated
                no-caps
                size="lg"
                color="primary"
                icon="o_lock_open"
                class="q-mt-md lock-btn"
                :label="$t('authenticationDialog.action_unlock')"
                @click="unlock()"
            />
        </div>
    </transition>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import { prefs } from 'src/utils/prefs'
import { lockState } from 'src/utils/lock'

/**
 * Locks the app after it was in the background a while (Settings › Auto-lock), and
 * blurs it in the app switcher meanwhile. Unlocking asks the password.
 */
export default defineComponent({
    data: () => ({
        hiddenAt: 0,
        prefs
    }),
    computed: {
        locked(): boolean {
            return lockState.locked
        }
    },
    created() {
        document.addEventListener('visibilitychange', this.onVisibility)
    },
    beforeUnmount() {
        document.removeEventListener('visibilitychange', this.onVisibility)
    },
    methods: {
        onVisibility() {
            const minutes = prefs.autoLockMinutes
            if (document.visibilityState === 'hidden') {
                this.hiddenAt = Date.now()
                // the app switcher shows a blurred snapshot
                minutes >= 0 && document.body.classList.add('bv-privacy-blur')
                return
            }
            document.body.classList.remove('bv-privacy-blur')
            if (minutes >= 0 && this.hiddenAt && Date.now() - this.hiddenAt >= minutes * 60 * 1000) {
                lockState.locked = true
            }
            this.hiddenAt = 0
        },
        async unlock() {
            try {
                await this.$authenticate()
                lockState.locked = false
            } catch { }
        }
    }
})
</script>
<style lang="sass" scoped>
.app-lock
  position: fixed
  inset: 0
  z-index: 6000
  padding: 24px
  text-align: center
  background: rgba(8, 10, 9, 0.98)
  backdrop-filter: blur(16px)

.lock-logo
  height: 28px

.lock-title
  font-size: 32px

.lock-btn
  min-width: 220px

.lock-enter-active, .lock-leave-active
  transition: opacity 0.2s

.lock-enter-from, .lock-leave-to
  opacity: 0
</style>
