<template>
    <q-layout view="hHh lpR fFf">
        <q-page-container>
            <q-page class="q-pa-md column items-center q-gutter-y-md">
                <img
                    src="~assets/bvm-logo.png"
                    alt="BVM"
                    style="width: min(320px, 70vw)"
                >
                <div class="text-h5">{{ $t('wizard.title_feature_1') }}</div>
                <div class="text-body2 text-center" style="max-width: 420px">
                    {{ $t('wizard.msg_feature_1') }}
                </div>
                <div class="text-caption text-grey">
                    v{{ version }} ({{ build }}) · Quasar {{ $q.version }} · Vue {{ vueVersion }}
                </div>

                <q-btn-toggle
                    v-model="$i18n.locale"
                    no-caps
                    toggle-color="primary"
                    :options="[{ label: 'English', value: 'en-us' }, { label: '中文', value: 'zh-cn' }]"
                />

                <q-btn
                    color="primary"
                    no-caps
                    :loading="running"
                    label="Run toolchain check"
                    @click="run"
                />

                <q-list
                    v-if="results.length"
                    bordered
                    separator
                    class="rounded-borders bg-surface"
                    style="width: min(560px, 100%)"
                >
                    <q-item v-for="r in results" :key="r.name">
                        <q-item-section avatar>
                            <q-icon
                                :name="r.ok ? 'check_circle' : 'error'"
                                :color="r.ok ? 'positive' : 'negative'"
                            />
                        </q-item-section>
                        <q-item-section>
                            <q-item-label>{{ r.name }}</q-item-label>
                            <q-item-label caption class="monospace" style="word-break: break-all">
                                {{ r.detail }}
                            </q-item-label>
                        </q-item-section>
                        <q-item-section side class="text-caption">{{ r.ms }} ms</q-item-section>
                    </q-item>
                </q-list>
                <div v-if="done" :class="allOk ? 'text-positive' : 'text-negative'" data-test="summary">
                    {{ allOk ? 'All checks passed' : 'Some checks failed' }}
                </div>

                <service-check />
            </q-page>
        </q-page-container>
    </q-layout>
</template>

<script setup lang="ts">
// Phase 1 only: proves the new toolchain runs the wallet core in a real browser
// (node polyfills, the vault web worker, IndexedDB via Dexie 4, thor-devkit crypto).
// Replaced by the real pages in phases 2-4.
import { computed, ref, version as vueVersion } from 'vue'
import { Transaction, secp256k1, address } from 'thor-devkit'
import { Vault, kdfDecrypt, kdfEncrypt } from 'core/vault'
import { Storage } from 'core/storage'
import ServiceCheck from './ServiceCheck.vue'

type Result = { name: string, ok: boolean, detail: string, ms: number }

const version = import.meta.env.APP_VERSION
const build = import.meta.env.APP_BUILD
const running = ref(false)
const done = ref(false)
const results = ref<Result[]>([])
const allOk = computed(() => results.value.every(r => r.ok))

// BIP39 test vector; the address is cross-checked with ethers in next/test/fixtures.ts
const TEST_WORDS = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const TEST_ADDRESS = '0xe5d846748409df0b23d5bd47ceb14afc1cbbbcb3'

async function check(name: string, fn: () => Promise<string> | string) {
    const start = performance.now()
    let ok = true
    let detail: string
    try {
        detail = await fn()
    } catch (err) {
        ok = false
        detail = (err as Error).message
    }
    results.value.push({ name, ok, detail, ms: Math.round(performance.now() - start) })
}

function assert(cond: boolean, msg: string): asserts cond {
    if (!cond) {
        throw new Error(msg)
    }
}

async function run() {
    running.value = true
    done.value = false
    results.value = []
    const key = Buffer.alloc(32, 1)

    await check('Node polyfills (Buffer, process)', () => {
        assert(typeof Buffer.from === 'function', 'Buffer missing')
        assert(typeof process !== 'undefined', 'process missing')
        return Buffer.from('BlackVault', 'utf8').toString('hex')
    })
    await check('Mnemonic from worker entropy', async () => {
        const words = await Vault.generateMnemonic()
        assert(words.length === 24, `expected 24 words, got ${words.length}`)
        return `${words.length} words`
    })
    await check('HD derivation (m/44\'/818\'/0\'/0/0)', () => {
        const node = Vault.createHD(TEST_WORDS.split(' '), key).derive(0)
        assert(node.address.toLowerCase() === TEST_ADDRESS, `unexpected address ${node.address}`)
        return node.address
    })
    await check('Password encryption (worker KDF)', async () => {
        const glob = await kdfEncrypt(Buffer.from('secret', 'utf8'), 'pw')
        const clear = await kdfDecrypt(glob, 'pw')
        assert(clear.toString('utf8') === 'secret', 'round trip failed')
        return `PBKDF2 n=${glob.kdf.n}`
    })
    await check('Transaction signing (thor-devkit)', () => {
        const sk = Vault.createHD(TEST_WORDS.split(' '), key).derive(0).unlock(key)
        const tx = new Transaction({
            chainTag: 0x4a,
            blockRef: '0x0000000000000000',
            expiration: 32,
            clauses: [{ to: TEST_ADDRESS, value: 1, data: '0x' }],
            gasPriceCoef: 0,
            gas: 21000,
            dependsOn: null,
            nonce: 1
        })
        tx.signature = secp256k1.sign(tx.signingHash(), sk)
        const signer = address.fromPublicKey(secp256k1.recover(tx.signingHash(), tx.signature))
        assert(signer.toLowerCase() === TEST_ADDRESS, `recovered ${signer}`)
        return `tx ${tx.id!.slice(0, 18)}…`
    })
    await check('IndexedDB storage (Dexie 4)', async () => {
        const db = await Storage.init()
        const row = { key: 'toolchain-check', subKey: '', value: String(Date.now()) }
        await db.configs.insert(row, true)
        const [read] = await db.configs.all().where({ key: row.key, subKey: '' }).query()
        await db.configs.delete({ key: row.key, subKey: '' })
        assert(read?.value === row.value, 'read back mismatch')
        return 'write, read, delete'
    })

    running.value = false
    done.value = true
}
</script>
