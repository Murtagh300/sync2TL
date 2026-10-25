<template>
    <div class="column fit no-wrap">
        <q-item>
            <q-item-section class="bvm-label">{{$t('index.label_wallets')}}</q-item-section>
            <q-item-section side>
                <q-btn
                    :aria-label="$t('common.add')"
                    flat
                    round
                    dense
                    icon="o_add"
                    color="primary"
                    :to="{name:'new-wallet'}"
                />
            </q-item-section>
        </q-item>
        <!-- the grouped wallet list -->
        <q-list
            class="col overflow-auto"
            v-scrollDivider.both
        >
            <div
                v-if="wallets.length === 0"
                class="text-grey fit row flex-center"
            >{{$t('common.no_wallet')}}</div>
            <q-item
                v-for="wallet in wallets"
                :key="wallet.id"
                :ref="wallet.id.toString()"
                clickable
                :active="wallet.id === current"
                active-class="wallet-active"
                @click="$emit('select', wallet.id)"
            >
                <q-item-section>
                    <q-item-label
                        lines="1"
                        class="row no-wrap items-center"
                    >
                        <wallet-mark
                            :wallet="wallet"
                            size="20px"
                            class="q-mr-sm"
                        />
                        <span class="ellipsis">{{wallet.meta.name}}</span>
                    </q-item-label>
                    <q-item-label
                        v-if="wallet.gid !==mainnetGid"
                        caption
                    >
                        {{$netDisplayName(wallet.gid)}}
                    </q-item-label>
                </q-item-section>
            </q-item>
        </q-list>
    </div>
</template>
<script lang="ts">
import { defineComponent, type ComponentPublicInstance } from 'vue'
import { genesises } from 'src/consts'
import WalletMark from 'src/components/WalletMark.vue'

export default defineComponent({
    emits: ['select'],
    components: { WalletMark },
    props: {
        wallets: { type: Array as () => M.Wallet[], required: true },
        current: Number
    },
    computed: {
        mainnetGid() { return genesises.main.id }
    },
    watch: {
        wallets(newVal: M.Wallet[], oldVal: M.Wallet[]) {
            if (newVal.length !== oldVal.length) {
                this.$nextTick(() => this.ensureCurrentInView())
            }
        },
        current() {
            this.ensureCurrentInView()
        }
    },
    methods: {
        ensureCurrentInView() {
            const item = this.$refs[String(this.current)] as ComponentPublicInstance[]
            if (item && item.length > 0) {
                item[0].$el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
            }
        }
    }
})
</script>
<style lang="sass" scoped>
.wallet-active
  background: color-mix(in srgb, var(--q-primary) 08%, transparent)
  color: $text
  box-shadow: inset 3px 0 0 var(--q-primary)
  font-weight: 700
</style>
