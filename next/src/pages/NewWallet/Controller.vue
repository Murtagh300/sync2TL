<template>
    <div class="fit column no-wrap">
        <page-toolbar
            :title="$t('newWallet.title')"
            :gid="gid"
        >
            <q-btn
                :aria-label="$t('a11y.more')"
                flat
                icon="more_horiz"
                round
            >
                <pop-sheets :sheets="optionSheets" />
            </q-btn>
        </page-toolbar>
        <page-content
            padding
            class="col"
            innerClass="fit column"
        >
            <!-- the label stays on top: the suggested name arrives a moment later -->
            <q-input
                bottom-slots
                outlined
                stack-label
                :label="$t('newWallet.label_wallet_name')"
                v-model="name"
                :error="!!error"
                :error-message="error"
                no-error-icon
            />
            <div class="column q-gutter-y-sm q-mt-sm">
                <button
                    type="button"
                    class="bvm-tile choice choice--primary row no-wrap items-center"
                    @click="newWallet('generate')"
                >
                    <q-icon
                        name="o_auto_awesome"
                        size="24px"
                        color="primary"
                    />
                    <div class="col q-ml-md">
                        <div class="choice-title">{{$t('newWallet.action_generate')}}</div>
                        <div class="choice-body">{{$t('newWallet.msg_generate')}}</div>
                    </div>
                    <q-icon
                        name="o_chevron_right"
                        class="text-muted"
                    />
                    <!-- long press: word count options -->
                    <pop-sheets
                        :sheets="generationOptionSheets"
                        context-menu
                    />
                </button>
                <button
                    type="button"
                    class="bvm-tile choice row no-wrap items-center"
                    @click="newWallet('import')"
                >
                    <q-icon
                        name="o_key"
                        size="24px"
                        color="primary"
                    />
                    <div class="col q-ml-md">
                        <div class="choice-title">{{$t('newWallet.action_import')}}</div>
                        <div class="choice-body">{{$t('newWallet.msg_import')}}</div>
                    </div>
                    <q-icon
                        name="o_chevron_right"
                        class="text-muted"
                    />
                </button>
                <button
                    type="button"
                    class="bvm-tile choice row no-wrap items-center"
                    @click="importKey()"
                >
                    <q-icon
                        name="o_vpn_key"
                        size="24px"
                        color="primary"
                    />
                    <div class="col q-ml-md">
                        <div class="choice-title">{{$t('privateKey.action')}}</div>
                        <div class="choice-body">{{$t('privateKey.msg')}}</div>
                    </div>
                    <q-icon
                        name="o_chevron_right"
                        class="text-muted"
                    />
                </button>
                <button
                    type="button"
                    class="bvm-tile choice row no-wrap items-center"
                    @click="watchAddress()"
                >
                    <q-icon
                        name="o_visibility"
                        size="24px"
                        color="primary"
                    />
                    <div class="col q-ml-md">
                        <div class="choice-title">{{$t('newWallet.action_watch')}}</div>
                        <div class="choice-body">{{$t('newWallet.msg_watch')}}</div>
                    </div>
                    <q-icon
                        name="o_chevron_right"
                        class="text-muted"
                    />
                </button>
                <router-link
                    :to="{ name: 'switch-guide' }"
                    class="text-primary text-center q-mt-md switch-link"
                >{{$t('switchGuide.link')}}</router-link>
            </div>
        </page-content>
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import PageToolbar from 'components/PageToolbar.vue'
import { genesises } from 'src/consts'
import { unique } from 'src/utils/array'
import { Vault } from 'src/core/vault'
import MnemonicInputDialog from './MnemonicInputDialog.vue'
import PopSheets, { Sheet } from 'components/PopSheets.vue'
import PageContent from 'components/PageContent.vue'
import { BackupDialog } from '../Backup'
import PromptDialog, { type PromptOptions } from 'pages/Index/PromptDialog.vue'
import { address as addressUtil } from 'thor-devkit'
import { isVetName, resolveVetName } from 'src/utils/names'

const defaultGid = genesises.main.id

// the order of secp256k1: a private key is a number between 1 and it
const CURVE_N = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141')
const validKey = (hex: string) => /^[0-9a-f]{64}$/i.test(hex) && BigInt('0x' + hex) > 0n && BigInt('0x' + hex) < CURVE_N

export default defineComponent({
    components: { PageToolbar, PopSheets, PageContent },
    props: {
        defaultGid: String
    },
    data() {
        return {
            name: '',
            gid: this.defaultGid || defaultGid,
            error: '',
            importState: { words: '', path: '' },
            // async computed (see src/shims-async-computed.d.ts)
            suggestedName: '' as string,
            gids: [] as string[]
        }
    },
    computed: {
        optionSheets(): Sheet[] {
            return this.gids.map<Sheet>(gid => {
                return {
                    label: this.$netDisplayName(gid) + (gid === this.gid ? ' ✓' : ''),
                    action: () => { this.gid = gid }
                }
            })
        },
        generationOptionSheets(): Sheet[] {
            return [{
                label: this.$t('newWallet.mnemonic_words_count').toString(),
                header: true
            },
            ...[12, 24].map<Sheet>(n => {
                return {
                    label: `${n}`,
                    action: () => this.newWallet('generate', n)
                }
            })]
        }
    },
    asyncComputed: {
        suggestedName: {
            async get(): Promise<string> {
                const wallets = await this.$svc.wallet.all()
                // the first free 'Wallet 2', 'Wallet 3' … (the first wallet is 'My Wallet', in the app's language)
                for (let i = wallets.length + 1; ; i++) {
                    const name = this.$t('newWallet.default_name', { n: i })
                    if (!wallets.find(w => w.meta.name === name)) {
                        return name
                    }
                }
            },
            default: ''
        },
        gids: {
            async get(): Promise<string[]> {
                const nodes = await this.$svc.config.node.all()
                return unique(nodes.map(n => n.genesis.id))
            },
            default: []
        }
    },
    watch: {
        suggestedName(newVal: string) {
            this.name = newVal
        },
        name() {
            this.error = ''
        }
    },
    methods: {
        /** a wallet from one private key (VeWorld can make those); it has one address */
        async importKey() {
            this.error = ''
            await this.$nextTick()
            if (!this.name) {
                this.error = this.$t('common.required_field').toString()
                return
            }
            const clean = (v: string) => v.trim().replace(/^0x/i, '')
            const opts: PromptOptions = {
                title: this.$t('privateKey.action'),
                message: this.$t('privateKey.msg_input'),
                model: '',
                action: { label: this.$t('common.continue'), color: 'primary' },
                validate: input => {
                    const hex = clean(input)
                    return validKey(hex) ? '' : this.$t('privateKey.msg_invalid')
                }
            }
            let sk: Buffer
            try {
                sk = Buffer.from(clean(await this.$dialog<string>({ component: PromptDialog, opts })), 'hex')
            } catch {
                return
            }
            try {
                const umk = await this.$authenticate()
                await this.$loading(async () => {
                    const vault = Vault.createStatic(sk, umk)
                    const addr = vault.derive(0).address
                    const existing = await this.$svc.wallet.all()
                    if (existing.some(w => w.gid === this.gid && w.meta.type !== 'watch' && w.meta.addresses.some(a => a.toLowerCase() === addr.toLowerCase()))) {
                        throw new Error(this.$t('newWallet.msg_watch_exists'))
                    }
                    await this.$svc.wallet.insert({
                        gid: this.gid,
                        vault: vault.encode(),
                        meta: { name: this.name, type: 'key', addresses: [addr], backedUp: true }
                    })
                })
                this.$backOrHome()
                this.$q.notify(this.$t('common.wallet_created'))
            } catch (err) {
                if (err instanceof Error && err.message) this.error = err.message
            } finally {
                sk.fill(0)
            }
        },
        /** follow an address (or name.vet) without its keys */
        async watchAddress() {
            this.error = ''
            await this.$nextTick()
            if (!this.name) {
                this.error = this.$t('common.required_field').toString()
                return
            }
            const opts: PromptOptions = {
                title: this.$t('newWallet.action_watch'),
                message: this.$t('newWallet.msg_watch_input'),
                model: '',
                action: { label: this.$t('common.add'), color: 'primary' },
                validate: input => {
                    const v = input.trim()
                    return addressUtil.test(v) || isVetName(v) ? '' : this.$t('send.msg_invalid_address')
                }
            }
            try {
                let addr = (await this.$dialog<string>({ component: PromptDialog, opts })).trim()
                if (isVetName(addr)) {
                    const resolved = await resolveVetName(addr)
                    if (!resolved) {
                        this.error = this.$t('send.msg_vet_not_found', { name: addr })
                        return
                    }
                    addr = resolved
                }
                const existing = await this.$svc.wallet.all()
                if (existing.some(w => w.gid === this.gid && w.meta.addresses.some(a => a.toLowerCase() === addr.toLowerCase()))) {
                    this.error = this.$t('newWallet.msg_watch_exists')
                    return
                }
                await this.$svc.wallet.insert({
                    gid: this.gid,
                    vault: '',
                    meta: { name: this.name, type: 'watch', addresses: [addressUtil.toChecksumed(addr.toLowerCase())], backedUp: true }
                })
                this.$backOrHome()
                this.$q.notify(this.$t('common.wallet_created'))
            } catch { }
        },
        async newWallet(type: 'generate' | 'import', wordsCount = 12) {
            // reset error
            this.error = ''
            await this.$nextTick()

            // check name
            if (!this.name) {
                this.error = this.$t('common.required_field').toString()
                return
            }

            let words: string[] | undefined
            let path: string
            if (type === 'import') {
                // get user input words and path
                try {
                    [words, path] = await this.$dialog<[string[], string]>({
                        component: MnemonicInputDialog,
                        state: this.importState
                    })
                } catch {
                    return
                }
            }
            try {
                const umk = await this.$authenticate()
                try {
                    // main process
                    let walletID = -1
                    let meta: M.Wallet.Meta | null = null
                    await this.$loading(async () => {
                        words = words || await Vault.generateMnemonic(wordsCount / 3 * 4)
                        const vault = Vault.createHD(
                            words,
                            umk,
                            path)
                        const node0 = vault.derive(0)
                        meta = {
                            name: this.name,
                            type: 'hd',
                            addresses: [node0.address],
                            backedUp: type === 'import'
                        }
                        walletID = await this.$svc.wallet.insert({
                            gid: this.gid,
                            vault: vault.encode(),
                            meta: meta
                        })
                    })
                    // backup in lite mode
                    if (import.meta.env.QUASAR_MODE === 'spa' || import.meta.env.QUASAR_MODE === 'pwa' || import.meta.env.QUASAR_MODE === 'electron') {
                        if (type === 'generate') {
                            try {
                                await this.$dialog({
                                    component: BackupDialog,
                                    walletId: walletID,
                                    meta: meta,
                                    words: words
                                })
                            } catch { }
                        }
                    }
                    this.$backOrHome()
                    this.$q.notify(this.$t('common.wallet_created'))
                } catch (err) {
                    this.error = (err as Error).message
                }
            } catch { }
        }
    }
})
</script>
<style lang="sass" scoped>
// the three ways to add a wallet, as tiles
.choice
  width: 100%
  padding: 16px
  color: inherit
  font: inherit
  text-align: left
  cursor: pointer
  transition: border-color 0.15s
  &:hover
    border-color: rgba(255, 255, 255, 0.22)

.choice--primary
  border-color: color-mix(in srgb, var(--q-primary) 40%, transparent)
  background: color-mix(in srgb, var(--q-primary) 06%, transparent)

.choice-title
  font-size: 16px
  font-weight: 900
  letter-spacing: -0.01em

.switch-link
  display: block
  font-size: 13px
  font-weight: 700
  text-decoration: none

.choice-body
  margin-top: 2px
  font-size: 13px
  line-height: 1.4
  color: $text-muted

</style>
