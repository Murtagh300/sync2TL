<template>
    <div class="column fit no-wrap">
        <page-toolbar :title="$t('activities.title')" />
        <page-content class="col">
            <q-pull-to-refresh
                color="primary"
                bg-color="dark"
                @refresh="refresh"
            >
            <template v-if="entryList.length">
                <template
                    v-for="(item, i) in entryList"
                    :key="item.id"
                >
                    <q-separator
                        v-if="i !== 0"
                    />
                    <Item
                        :entry="item"
                    />
                </template>
            </template>
            <template v-else>
                <div class="text-center q-px-xl q-py-xl column items-center">
                    <q-icon
                        name="o_receipt_long"
                        size="40px"
                        class="text-muted"
                    />
                    <p class="q-mt-md text-soft">{{$t('activities.msg_not_found')}}</p>
                </div>
            </template>
            </q-pull-to-refresh>
        </page-content>
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import Item, { Entry } from './Item.vue'
import PageToolbar from 'components/PageToolbar.vue'
import PageContent from 'components/PageContent.vue'
import { Transaction } from 'thor-devkit'
import { decodeAction } from 'src/utils/actions'
import { describeAction } from 'src/utils/describe-action'
import { formatUnits } from 'src/utils/format'
import type { BVM } from 'boot/services/bvm'

export default defineComponent({
    components: {
        Item,
        PageToolbar,
        PageContent
    },
    data: () => ({
        // async computed (see src/shims-async-computed.d.ts)
        list: [] as M.Activity[],
        walletNames: {} as { [key: string]: string },
        tokens: [] as M.TokenSpec[],
        collections: {} as Record<string, BVM.Collection>
    }),
    asyncComputed: {
        list: {
            get(): Promise<M.Activity[]> {
                return this.$svc.activity.page(100, 0)
            },
            default: []
        },
        tokens: {
            get(): Promise<M.TokenSpec[]> {
                return this.$svc.config.token.all()
            },
            default: []
        },
        collections: {
            get(): Promise<Record<string, BVM.Collection>> {
                return this.$svc.bvm.collections().catch(() => ({}))
            },
            default: {}
        },
        walletNames: {
            async get(): Promise<{ [key: string]: string }> {
                const wallets = await this.$svc.wallet.all()
                return wallets.reduce<Record<number, string>>((prev, cur) => {
                    prev[cur.id] = cur.meta.name
                    return prev
                }, {})
            },
            default: {}
        }
    },
    computed: {
        entryList(): Entry[] {
            return this.list.map<Entry>((a: M.Activity) => {
                const temp: Entry = {
                    gid: a.gid,
                    type: a.type,
                    time: a.createdTime,
                    signer: a.glob.signer,
                    walletName: this.walletNames[a.walletId] || '',
                    link: a.glob.link || '',
                    status: this.status(a),
                    comment: a.type === 'tx' ? a.glob.comment : this.certComment(a.glob.encoded),
                    summary: a.type === 'tx' ? this.txSummary(a) : this.certComment(a.glob.encoded),
                    id: a.glob.id
                }
                if (a.type === 'tx') {
                    temp.confirming = this.confirmText(a)
                } else {
                    temp.message = this.certMessage(a.glob.encoded)
                }

                return temp
            })
        }
    },
    methods: {
        refresh(done: () => void) {
            void this.$asyncComputed.list.update()
            setTimeout(done, 500)
        },
        /** our own comment ("Send 5 VET"), or what the transaction's clauses do */
        txSummary(a: M.Activity): string {
            if (a.type !== 'tx') {
                return ''
            }
            if (a.glob.comment) {
                return a.glob.comment
            }
            try {
                const tx = Transaction.decode(Buffer.from(a.glob.encoded.slice(2), 'hex'))
                const tokens = this.tokens.filter(t => t.gid === a.gid)
                for (const c of tx.body.clauses) {
                    const action = decodeAction({ to: c.to, value: c.value, data: c.data })
                    if (action) {
                        return describeAction(action, {
                            t: (key, params) => this.$t(key, params ?? {}),
                            token: address => tokens.find(t => t.address.toLowerCase() === address.toLowerCase()),
                            collection: address => this.collections[address.toLowerCase()]?.name
                        }).text
                    }
                }
                const [first] = tx.body.clauses
                if (tx.body.clauses.length === 1 && first && (!first.data || first.data === '0x') && BigInt(first.value) > 0n) {
                    return this.$t('activities.label_sent_vet', { amount: formatUnits(BigInt(first.value), 18) })
                }
            } catch {
                // not decodable: fall back to where it came from
            }
            try {
                return a.glob.origin ? this.$t('activities.label_from_dapp', { host: new URL(a.glob.origin).host }) : ''
            } catch {
                return ''
            }
        },
        confirmText(activity: M.Activity): string {
            const receipt = activity.type === 'tx' ? activity.glob.receipt : null
            if (!receipt || activity.status === 'completed') {
                return ''
            }
            const confirms = this.$svc.bc(activity.gid).thor.status.head.number - receipt.meta.blockNumber
            return `${confirms} / 12`
        },
        status(a: M.Activity): 'reverted' | 'reverted?' | 'success' | 'success?' | 'sending' | 'expired' {
            if (a.type === 'cert') {
                return 'success'
            }

            const receipt = a.type === 'tx' ? a.glob.receipt : null

            if (a.status === 'completed') {
                return receipt ? receipt.reverted ? 'reverted' : 'success' : 'expired'
            } else {
                if (receipt) {
                    return receipt.reverted ? 'reverted?' : 'success?'
                } else {
                    return 'sending'
                }
            }
        },
        certComment(encoded: string) {
            const cert: Connex.Vendor.CertMessage = JSON.parse(encoded)
            return cert.purpose === 'identification' ? this.$t('common.identification').toString() : this.$t('common.agreement').toString()
        },
        certMessage(encoded: string) {
            const cert: Connex.Vendor.CertMessage = JSON.parse(encoded)

            return cert.payload.content
        }
    }
})
</script>
