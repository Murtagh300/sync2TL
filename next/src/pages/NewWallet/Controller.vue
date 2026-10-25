<template>
    <div class="fit column no-wrap">
        <page-toolbar
            :title="$t('newWallet.title')"
            :gid="gid"
        >
            <q-btn
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
            <q-input
                bottom-slots
                outlined
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

const defaultGid = genesises.main.id

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
                const baseName = this.$t('newWallet.title')
                for (let i = 1; ; i++) {
                    const name = `${baseName}${i}`
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
                    if (import.meta.env.QUASAR_MODE === 'spa' || import.meta.env.QUASAR_MODE === 'pwa') {
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

.choice-body
  margin-top: 2px
  font-size: 13px
  line-height: 1.4
  color: $text-muted

</style>
