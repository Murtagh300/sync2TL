<template>
    <pop-sheets :sheets="sheets" />
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import { Vault } from 'core/vault'
import PopSheets, { Sheet } from 'src/components/PopSheets.vue'
import PromptDialog, { PromptOptions } from './PromptDialog.vue'
import WalletLookDialog, { type WalletLook } from './WalletLookDialog.vue'
import { keystoreFileName, makeKeystore, MIN_KEYSTORE_PASSWORD } from 'src/utils/keystore'
import { downloadText } from 'src/utils/export'

const MAX_ADDRESS = 10

export default defineComponent({
    components: { PopSheets },
    props: {
        wallet: { type: Object as () => M.Wallet, required: true }
    },
    computed: {
        sheets(): Sheet[] {
            return [{
                label: this.$t('index.action_new_address').toString(),
                action: () => this.newAddress(),
                hidden: this.wallet.meta.addresses.length >= MAX_ADDRESS || this.wallet.meta.type !== 'hd'
            },
            {
                label: this.$t('index.action_backup').toString(),
                action: () => this.$router.push({ name: 'backup', params: { walletId: this.wallet.id.toString() } }),
                // a key wallet's backup is the key the user imported
                hidden: this.wallet.meta.type !== 'hd'
            },
            {
                label: this.$t('keystore.action_export'),
                action: () => this.exportKeystore(),
                hidden: this.wallet.meta.type !== 'hd' && this.wallet.meta.type !== 'key'
            },
            {
                label: this.$t('index.action_rename').toString(),
                action: () => this.rename()
            },
            {
                label: this.$t('walletLook.action').toString(),
                action: () => this.look()
            },
            {
                label: this.$t('common.delete').toString(),
                action: () => this.delete(),
                classes: 'text-negative',
                separator: true
            }]
        }
    },
    methods: {
        newAddress() {
            const wallet = this.wallet
            if (!wallet) {
                return
            }
            const addresses = wallet.meta.addresses
            if (addresses.length >= MAX_ADDRESS) {
                return
            }
            const vault = Vault.decode(wallet.vault)
            const newAddress = vault.derive(addresses.length).address
            const newMeta: M.Wallet.Meta = {
                ...wallet.meta,
                addresses: [...addresses, newAddress]
            }

            this.$svc.wallet.update(wallet.id, newMeta)
        },
        /** one address's key as a keystore file, for Sync2 or another VeChain wallet */
        async exportKeystore() {
            const wallet = this.wallet
            const addresses = wallet.meta.addresses
            try {
                let index = 0
                if (addresses.length > 1) {
                    index = await new Promise<number>((resolve, reject) => {
                        this.$q.dialog({
                            title: this.$t('keystore.action_export'),
                            message: this.$t('keystore.msg_which'),
                            options: { type: 'radio', model: '0', items: addresses.map((a, i) => ({ label: `#${i + 1} ${a.slice(0, 8)}…${a.slice(-6)}`, value: String(i) })) },
                            cancel: true
                        }).onOk((v: string) => resolve(Number(v))).onCancel(() => reject(new Error('cancel')))
                    })
                }
                const opts: PromptOptions = {
                    title: this.$t('keystore.title_new_password'),
                    message: this.$t('keystore.msg_new_password', { n: MIN_KEYSTORE_PASSWORD }),
                    model: '',
                    password: true,
                    action: { label: this.$t('common.continue'), color: 'primary' },
                    validate: input => input.length >= MIN_KEYSTORE_PASSWORD ? '' : this.$t('keystore.msg_too_short', { n: MIN_KEYSTORE_PASSWORD })
                }
                const password = await this.$dialog<string>({ component: PromptDialog, opts })
                const again = await this.$dialog<string>({
                    component: PromptDialog,
                    opts: { ...opts, title: this.$t('keystore.title_repeat'), message: '', validate: (input: string) => input === password ? '' : this.$t('keystore.msg_no_match') }
                })
                if (again !== password) return
                const umk = await this.$authenticate()
                const node = Vault.decode(wallet.vault).derive(index)
                const sk = node.unlock(umk)
                try {
                    const text = await this.$loading(() => makeKeystore(sk, password))
                    downloadText(keystoreFileName(node.address), text, 'application/json')
                    this.$q.notify(this.$t('keystore.msg_exported'))
                } finally {
                    sk.fill(0)
                }
            } catch { }
        },
        async rename() {
            const wallet = this.wallet
            if (!wallet) {
                return
            }
            try {
                const opts: PromptOptions = {
                    title: this.$t('index.action_rename').toString(),
                    message: '',
                    model: this.wallet.meta.name,
                    action: {
                        label: this.$t('common.ok').toString(),
                        color: 'primary'
                    },
                    validate: input => input.trim() ? '' : 'Input the name of wallet'
                }
                const newName = (await this.$dialog<string>({
                    component: PromptDialog,
                    opts
                })).trim()

                try {
                    await this.$svc.wallet.update(wallet.id, {
                        ...wallet.meta,
                        name: newName
                    })
                    this.$q.notify(this.$t('common.wallet_updated'))
                } catch (err) {
                    console.warn('rename wallet:', err)
                    this.$q.notify({
                        type: 'negative',
                        message: this.$t('common.something_wrong').toString()
                    })
                }
            } catch { }
        },
        async look() {
            const wallet = this.wallet
            try {
                const look = await this.$dialog<WalletLook>({ component: WalletLookDialog, wallet })
                await this.$svc.wallet.update(wallet.id, { ...wallet.meta, color: look.color || undefined, emoji: look.emoji || undefined })
            } catch { }
        },
        async delete() {
            const wallet = this.wallet
            if (!wallet) {
                return
            }

            try {
                const opts: PromptOptions = {
                    title: this.$t('common.delete').toString(),
                    message: this.$t('index.msg_delete').toString(),
                    model: '',
                    action: {
                        label: this.$t('common.delete').toString(),
                        color: 'negative'
                    },
                    // ask user to type 'ok' to confirm
                    validate: input => input.toLowerCase() === 'ok' ? '' : this.$t('common.invalid_input').toString()
                }

                await this.$dialog<string>({
                    component: PromptDialog,
                    opts
                })
                await this.$authenticate()
                try {
                    await this.$svc.wallet.delete(wallet.id)
                    this.$q.notify(this.$t('common.wallet_deleted').toString())
                } catch (err) {
                    console.warn('delete wallet:', err)
                    this.$q.notify({
                        type: 'negative',
                        message: this.$t('common.something_wrong').toString()
                    })
                }
            } catch { }
        }
    }
})
</script>
