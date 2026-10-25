<template>
    <q-dialog
        ref="dialog"
        position="bottom"
        @hide="$emit('hide')"
    >
        <q-card class="full-width look-card">
            <q-card-section class="row items-center no-wrap">
                <wallet-mark
                    :wallet="preview"
                    size="48px"
                />
                <div class="q-ml-md">
                    <div class="bvm-display look-title">{{wallet.meta.name}}</div>
                    <div class="text-muted">{{$t('walletLook.msg')}}</div>
                </div>
            </q-card-section>
            <q-card-section class="q-pt-none">
                <div class="look-label">{{$t('walletLook.label_color')}}</div>
                <div class="row q-gutter-sm">
                    <button
                        v-for="(hex, key) in colors"
                        :key="key"
                        type="button"
                        class="swatch"
                        :class="{ 'swatch--on': color === key }"
                        :style="{ background: hex }"
                        :aria-label="key"
                        :aria-pressed="color === key"
                        @click="color = color === key ? '' : key"
                    />
                </div>
                <div class="look-label q-mt-md">{{$t('walletLook.label_emoji')}}</div>
                <div class="emoji-grid">
                    <button
                        v-for="e in emojis"
                        :key="e"
                        type="button"
                        class="emoji"
                        :class="{ 'emoji--on': emoji === e }"
                        :aria-pressed="emoji === e"
                        @click="emoji = emoji === e ? '' : e"
                    >{{e}}</button>
                </div>
                <q-input
                    v-model="custom"
                    dense
                    outlined
                    maxlength="8"
                    class="q-mt-sm"
                    :label="$t('walletLook.label_custom')"
                />
            </q-card-section>
            <q-card-actions class="q-px-md q-pb-md">
                <q-btn
                    flat
                    no-caps
                    :label="$t('walletLook.action_reset')"
                    @click="color = ''; emoji = ''; custom = ''"
                />
                <q-space />
                <q-btn
                    unelevated
                    no-caps
                    color="primary"
                    :label="$t('common.ok')"
                    @click="ok()"
                />
            </q-card-actions>
        </q-card>
    </q-dialog>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import { QDialog } from 'quasar'
import WalletMark from 'components/WalletMark.vue'
import { walletColors, walletEmoji } from 'src/utils/wallet-look'

export type WalletLook = { color: string, emoji: string }

// pick a color and an emoji for a wallet
export default defineComponent({
    components: { WalletMark },
    // the Dialog plugin listens to these
    emits: ['ok', 'hide'],
    props: {
        wallet: { type: Object as () => M.Wallet, required: true }
    },
    data(vm) {
        const current = vm.wallet.meta.emoji || ''
        return {
            colors: walletColors,
            emojis: walletEmoji,
            color: vm.wallet.meta.color || '',
            emoji: walletEmoji.includes(current) ? current : '',
            custom: walletEmoji.includes(current) ? '' : current
        }
    },
    computed: {
        chosenEmoji(): string {
            // the first character (emoji can be several code units) of what was typed
            const typed = [...this.custom.trim()].slice(0, 2).join('')
            return typed || this.emoji
        },
        preview(): M.Wallet {
            return { ...this.wallet, meta: { ...this.wallet.meta, color: this.color, emoji: this.chosenEmoji } }
        }
    },
    methods: {
        // method is REQUIRED by $q.dialog
        show() { (this.$refs.dialog as QDialog).show() },
        // method is REQUIRED by $q.dialog
        hide() { (this.$refs.dialog as QDialog).hide() },
        ok() {
            this.$emit('ok', { color: this.color, emoji: this.chosenEmoji } as WalletLook)
            this.hide()
        }
    }
})
</script>
<style lang="sass" scoped>
.look-title
  font-size: 20px

.look-label
  font-size: 12px
  font-weight: 700
  color: $text-muted
  margin-bottom: 8px

.swatch
  width: 34px
  height: 34px
  border-radius: 30%
  border: 2px solid transparent
  cursor: pointer
  &--on
    border-color: #fff
    box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.25)
  &:focus-visible
    outline: 2px solid var(--q-primary)
    outline-offset: 2px

.emoji-grid
  display: grid
  grid-template-columns: repeat(8, 1fr)
  gap: 6px

.emoji
  aspect-ratio: 1
  font-size: 22px
  border-radius: 10px
  border: 1px solid transparent
  background: rgba(255, 255, 255, 0.04)
  cursor: pointer
  &--on
    border-color: var(--q-primary)
    background: var(--bv-accent-soft)
  &:focus-visible
    outline: 2px solid var(--q-primary)
</style>
