<template>
    <q-infinite-scroll
        @load="onLoad"
        :offset="0"
    >
        <div
            v-for="(item, index) in logs"
            :key="index"
        >
            <LogItem
                class="q-my-sm"
                :address="address"
                :log="item"
            />
            <q-separator inset="item" />
        </div>
        <div
            v-if="noMore"
            class="text-center q-my-md text-grey"
        >
            <div
                v-if="logs.length === 0"
                class="column items-center q-py-xl q-px-lg"
            >
                <q-icon
                    name="o_receipt_long"
                    size="32px"
                    class="text-muted"
                />
                <div class="q-mt-sm text-muted" style="max-width: 28ch">{{$t('asset.msg_no_history')}}</div>
            </div>
            <span
                class="text-caption"
                v-else
            >{{$t('asset.msg_no_more')}}</span>
        </div>
        <template v-slot:loading>
            <div class="text-center q-my-sm">
                <q-spinner-dots
                    color="primary"
                    size="20px"
                />
            </div>
        </template>
    </q-infinite-scroll>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import { vetTransfers, tokenTransfers } from './queries'
import { TransferLogItem } from './models'
import LogItem from './LogItem.vue'

export default defineComponent({
    components: {
        LogItem
    },
    emits: ['logs'],
    props: {
        pageSize: { type: Number, required: true },
        address: { type: String, required: true },
        token: { type: Object as () => M.TokenSpec, required: true }
    },
    data() {
        return {
            pageNum: 1,
            logs: [] as TransferLogItem[],
            offset: 0,
            noMore: false,
            splitBlock: null as unknown as number,
            // async computed (see src/shims-async-computed.d.ts)
            recentList: [] as TransferLogItem[]
        }
    },
    asyncComputed: {
        recentList: {
            async get() {
                let on = true
                let list: TransferLogItem[] = []
                const from = (this.logs[0] ? this.logs[0].meta.blockNumber : this.splitBlock) + 1
                const to = 2 ** 32 - 1
                while (on) {
                    const r = await this.query(from, to, list.length)
                    on = r.length === this.pageSize
                    list = [...list, ...r]
                }
                return list
            },
            default: []
        }
    },
    computed: {
        gid() {
            return this.token && this.token.gid
        }
    },
    created() {
        this.splitBlock = this.$svc.bc(this.gid).thor.status.head.number
    },
    watch: {
        logs(list: TransferLogItem[]) {
            this.$emit('logs', list)
        },
        recentList(data: TransferLogItem[]) {
            if (data.length) {
                this.logs = [...data, ...this.logs]
            }
        }
    },
    methods: {
        vetTransfers,
        tokenTransfers,
        onNewLogs(data: TransferLogItem[]) {
            if (data.length) {
                this.logs = [...data, ...this.logs]
            }
        },
        async onLoad(index: number, done: (stop: boolean) => void) {
            try {
                const logs = await this.query(0, this.splitBlock, (this.pageNum - 1) * this.pageSize)
                this.pageNum++
                this.logs = [...this.logs, ...logs]
                this.noMore = logs.length < this.pageSize
                done(logs.length < this.pageSize)
            } catch (error) {
                // TODO error
                console.log(error)
                done(true)
            }
        },
        async query(fb: number, tb: number, offset: number) {
            if (fb >= tb) {
                return []
            }
            if (this.token && this.token.symbol !== 'VET') {
                return await this.tokenTransfers(this.$svc.bc(this.gid).thor, [this.token], this.address, fb, tb, offset, this.pageSize)
            } else {
                return await this.vetTransfers(this.$svc.bc(this.gid).thor, this.token, this.address, fb, tb, offset, this.pageSize)
            }
        }
    }
})
</script>
