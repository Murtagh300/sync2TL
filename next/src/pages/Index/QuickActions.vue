<template>
    <div class="quick-actions">
        <button
            v-for="a in actions"
            :key="a.key"
            type="button"
            class="quick-action"
            @click="run(a.key)"
        >
            <span class="quick-icon flex flex-center">
                <q-icon
                    :name="a.icon"
                    size="24px"
                />
            </span>
            <span class="quick-label">{{a.label}}</span>
        </button>
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import ReceiveDialog from 'pages/Address/ReceiveDialog.vue'
import QrScannerDialog from 'pages/QrScannerDialog'
import { parsePaymentRequest } from 'src/utils/payment-request'
import { haptic } from 'src/utils/prefs'

type Key = 'send' | 'receive' | 'swap' | 'scan'

// the four things people do most, one tap from home
export default defineComponent({
    props: {
        wallet: { type: Object as () => M.Wallet, required: true }
    },
    computed: {
        actions(): { key: Key, icon: string, label: string }[] {
            // a watch-only wallet can't send or swap: receiving is what is left
            if (this.wallet.meta.type === 'watch') {
                return [{ key: 'receive', icon: 'o_south_west', label: this.$t('address.action_receive') }]
            }
            return [
                { key: 'send', icon: 'o_north_east', label: this.$t('send.action_send') },
                { key: 'receive', icon: 'o_south_west', label: this.$t('address.action_receive') },
                { key: 'swap', icon: 'o_swap_vert', label: this.$t('swap.title') },
                { key: 'scan', icon: 'o_qr_code_scanner', label: this.$t('home.action_scan') }
            ]
        }
    },
    watch: {
        // opened from an app icon shortcut (src-pwa/manifest.json), fresh or already running: run it once
        '$route.query.do': {
            handler(value: unknown) {
                const key = String(value || '') as Key
                if (['send', 'receive', 'scan'].includes(key)) {
                    void this.$router.replace({ query: {} }).then(() => this.run(key))
                }
            },
            immediate: true
        }
    },
    methods: {
        async run(key: Key) {
            haptic()
            const wid = String(this.wallet.id)
            switch (key) {
                case 'send':
                    void this.$router.push({ name: 'send', query: { wid, i: '0' } })
                    break
                case 'receive':
                    this.$dialog({ component: ReceiveDialog, address: this.wallet.meta.addresses[0] }).catch(() => { })
                    break
                case 'swap':
                    void this.$router.push({ name: 'swap', query: { wid, i: '0' } })
                    break
                case 'scan':
                    try {
                        const text = await this.$dialog<string>({ component: QrScannerDialog })
                        const req = parsePaymentRequest(text)
                        if (req) {
                            void this.$router.push({ name: 'send', query: { wid, i: '0', ...req } })
                        } else if (/[#/]sign\?src=/.test(text)) {
                            void this.$router.push({ name: 'sign', query: { src: new URLSearchParams(text.slice(text.indexOf('?'))).get('src') || '' } })
                        } else {
                            this.$q.notify(this.$t('home.msg_unknown_qr'))
                        }
                    } catch { }
                    break
            }
        }
    }
})
</script>
<style lang="sass" scoped>
.quick-actions
  display: grid
  grid-template-columns: repeat(4, 1fr)
  gap: 8px

.quick-action
  display: flex
  flex-direction: column
  align-items: center
  gap: 6px
  padding: 0
  border: 0
  background: none
  color: inherit
  font: inherit
  cursor: pointer
  &:active .quick-icon
    transform: scale(0.94)

.quick-icon
  width: 56px
  height: 56px
  border-radius: 18px
  background: var(--q-primary)
  color: $on-primary
  transition: transform 0.12s ease-out

.quick-label
  font-size: 13px
  font-weight: 700
</style>
