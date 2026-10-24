<template>
    <q-list
        bordered
        separator
        class="rounded-borders bg-surface"
        style="width: min(560px, 100%)"
    >
        <q-item-label header>Services (phase 2)</q-item-label>
        <q-item>
            <q-item-section>
                <q-item-label>Mainnet head (live via connex pool)</q-item-label>
                <q-item-label caption class="monospace" data-test="head">{{ head ?? '…' }}</q-item-label>
            </q-item-section>
        </q-item>
        <q-item>
            <q-item-section>
                <q-item-label>Test address VET balance</q-item-label>
                <q-item-label caption class="monospace" data-test="balance">{{ balance ?? '…' }}</q-item-label>
            </q-item-section>
        </q-item>
        <q-item>
            <q-item-section>
                <q-item-label>Wallets in storage (reactive)</q-item-label>
                <q-item-label caption data-test="wallets">{{ walletCount ?? '…' }}</q-item-label>
            </q-item-section>
            <q-item-section side>
                <div class="row q-gutter-sm">
                    <q-btn dense flat no-caps color="primary" label="Add" @click="addWallet" />
                    <q-btn dense flat no-caps color="primary" label="Remove" @click="removeWallet" />
                </div>
            </q-item-section>
        </q-item>
        <q-item>
            <q-item-section>
                <q-item-label>Tokens (registry + VET/VTHO)</q-item-label>
                <q-item-label caption data-test="tokens">{{ tokenCount ?? '…' }}</q-item-label>
            </q-item-section>
        </q-item>
        <q-item>
            <q-item-section>
                <q-item-label>{{ $netDisplayName(mainId) }} · {{ $netDisplayName(testId) }}</q-item-label>
                <q-item-label caption data-test="dialog-result">dialog: {{ dialogResult }}</q-item-label>
            </q-item-section>
            <q-item-section side>
                <div class="row q-gutter-sm">
                    <q-btn dense flat no-caps color="primary" label="Dialog" @click="openDialog" />
                    <q-btn dense flat no-caps color="primary" label="Loading" @click="showLoading" />
                </div>
            </q-item-section>
        </q-item>
    </q-list>
</template>

<script lang="ts">
// Phase 2 only: exercises $svc, asyncComputed reactivity, $dialog and $loading.
import { defineComponent } from 'vue'
import { genesises } from 'src/consts'

const TEST_ADDRESS = '0xe5d846748409df0b23d5bd47ceb14afc1cbbbcb3'

export default defineComponent({
    data: () => ({
        mainId: genesises.main.id,
        testId: genesises.test.id,
        dialogResult: '–',
        // async computed (see src/shims-async-computed.d.ts)
        head: null as number | null,
        balance: null as string | null,
        walletCount: null as number | null,
        tokenCount: null as number | null
    }),
    asyncComputed: {
        head(): Promise<number> {
            const thor = this.$svc.bc(genesises.main.id).thor
            return Promise.resolve(thor.status.head.number)
        },
        balance(): Promise<string> {
            const token = { symbol: 'VET' } as M.TokenSpec
            return this.$svc.bc(genesises.main.id).balanceOf(TEST_ADDRESS, token)
        },
        walletCount(): Promise<number> {
            return this.$svc.wallet.all().then(r => r.length)
        },
        tokenCount(): Promise<number> {
            return this.$svc.config.token.all().then(r => r.length)
        }
    },
    methods: {
        addWallet() {
            return this.$svc.wallet.insert({
                gid: genesises.test.id,
                vault: '{}',
                meta: { name: 'service-check', type: 'hd', addresses: [] }
            })
        },
        async removeWallet() {
            const [w] = await this.$svc.wallet.getByGid(genesises.test.id)
            if (w && w.meta.name === 'service-check') {
                await this.$svc.wallet.delete(w.id)
            }
        },
        async openDialog() {
            try {
                await this.$dialog({ title: 'BlackVault', message: 'Dialog plugin works', cancel: true })
                this.dialogResult = 'ok'
            } catch {
                this.dialogResult = 'cancelled'
            }
        },
        showLoading() {
            return this.$loading(() => new Promise(resolve => setTimeout(resolve, 1500)))
        }
    }
})
</script>
