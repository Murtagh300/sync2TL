<template>
    <q-carousel
        v-model="slide"
        class="safe-area"
        transition-prev="slide-down"
        transition-next="slide-up"
        animated
    >
        <q-carousel-slide
            name="welcome"
            class="column q-pa-none no-wrap"
        >
            <page-content
                class="col"
                padding
                innerClass="fit column no-wrap"
            >
                <div class="row items-center no-wrap">
                    <img
                        src="~assets/bvm-logo.png"
                        alt="BVM"
                        class="wizard-logo"
                    >
                    <language-list-popup
                        class="q-ml-auto"
                        v-slot="{displayName}"
                    >
                        <q-btn
                            flat
                            dense
                            no-caps
                            icon="o_language"
                            class="text-muted q-px-sm"
                            :label="displayName"
                        />
                    </language-list-popup>
                </div>
                <feature-slides class="q-my-auto q-py-lg" />
            </page-content>
            <div class="wizard-action narrow-page q-mx-auto">
                <q-btn
                    unelevated
                    no-caps
                    color="primary"
                    size="lg"
                    class="full-width"
                    :label="$t('wizard.action_get_started')"
                    @click="onClickStart('create')"
                />
                <q-btn
                    flat
                    no-caps
                    color="primary"
                    size="lg"
                    class="full-width q-mt-sm"
                    icon="o_key"
                    :label="$t('wizard.action_import')"
                    @click="onClickStart('import')"
                />
            </div>
        </q-carousel-slide>
        <q-carousel-slide
            name="progress"
            class="column q-pa-none no-wrap"
        >
            <page-content
                class="col"
                padding
                innerClass="fit column q-gutter-y-md no-wrap"
            >
                <steps :current="finished ? 2 : 1" />
                <h4 class="q-mb-none bvm-display">{{$t('wizard.title_init')}}</h4>
                <WizardProgress
                    :current="progressStr"
                    class="col overflow-auto"
                />
                <div
                    class="text-h5 text-primary"
                    v-if="finished"
                >{{$t('wizard.msg_init_complete')}}</div>
            </page-content>
            <div class="wizard-action narrow-page q-mx-auto">
                <q-btn
                    v-if="finished"
                    unelevated
                    no-caps
                    color="primary"
                    size="lg"
                    class="full-width"
                    :label="$t('common.next')"
                    @click="slide = 'follow'"
                />
            </div>
        </q-carousel-slide>
        <q-carousel-slide
            name="follow"
            class="column q-pa-none no-wrap"
        >
            <page-content
                class="col"
                padding
                innerClass="fit column no-wrap"
            >
                <steps :current="3" />
                <h4 class="q-mb-sm bvm-display">{{$t('wizard.title_follow')}}</h4>
                <p class="text-soft">{{$t('wizard.msg_follow')}}</p>
                <div class="follow-grid">
                    <button
                        v-for="c in ideas"
                        :key="c.slug"
                        type="button"
                        class="follow bvm-tile"
                        :class="{ 'follow--on': followed.includes(c.slug) }"
                        @click="toggleFollow(c.slug)"
                    >
                        <img
                            :src="c.coverImage"
                            alt=""
                            loading="lazy"
                        >
                        <span class="ellipsis">{{c.name}}</span>
                        <q-icon
                            v-if="followed.includes(c.slug)"
                            name="check_circle"
                            class="follow-check"
                            size="22px"
                        />
                    </button>
                </div>
            </page-content>
            <div class="wizard-action narrow-page q-mx-auto">
                <q-btn
                    unelevated
                    no-caps
                    color="primary"
                    size="lg"
                    class="full-width"
                    :label="followed.length ? $t('wizard.action_follow', { n: followed.length }) : $t('wizard.action_skip')"
                    @click="finish()"
                />
            </div>
        </q-carousel-slide>
    </q-carousel>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import FeatureSlides from './FeatureSlides.vue'
import Progress from './Progress.vue'
import NewPasswordDialog from 'pages/NewPasswordDialog'
import { genesises } from 'src/consts'
import LanguageListPopup from 'pages/LanguageListPopup.vue'
import PageContent from 'src/components/PageContent.vue'
import { secureRNG, kdfEncrypt, Vault } from 'src/core/vault'
import { BackupDialog } from '../Backup'
import MnemonicInputDialog from 'pages/NewWallet/MnemonicInputDialog.vue'
import Steps from './Steps.vue'
import type { BVM } from 'boot/services/bvm'
import { emptyWatchlist } from 'src/utils/alerts'

async function randomDelay<T>(p: () => Promise<T>, aboutSeconds: number) {
    const [r] = await Promise.all([
        p(),
        new Promise(resolve => setTimeout(resolve, (aboutSeconds * (1 + Math.random()) * 1000)))
    ])
    return r
}

export default defineComponent({
    emits: ['done'],
    components: {
        WizardProgress: Progress,
        Steps,
        FeatureSlides,
        LanguageListPopup,
        PageContent
    },
    data: () => {
        return {
            slide: 'welcome',
            progressStr: '',
            finished: false,
            ideas: [] as BVM.Collection[],
            followed: [] as string[],
            // what was typed in the import dialog, kept if it is closed and opened again
            importState: { words: '', path: '' }
        }
    },
    methods: {
        toggleFollow(slug: string) {
            this.followed = this.followed.includes(slug) ? this.followed.filter(s => s !== slug) : [...this.followed, slug]
        },
        async finish() {
            if (this.followed.length) {
                await this.$svc.config.setJSON('watchlist', { ...emptyWatchlist(), collections: this.followed })
            }
            this.$emit('done')
        },
        /** a new wallet, or one restored from its recovery words (a wallet made elsewhere, VeWorld, Sync2) */
        async onClickStart(mode: 'create' | 'import') {
            let imported: { words: string[], path: string } | null = null
            if (mode === 'import') {
                try {
                    const [words, path] = await this.$dialog<[string[], string]>({
                        component: MnemonicInputDialog,
                        state: this.importState
                    })
                    imported = { words, path }
                } catch {
                    return
                }
            }
            // collections to suggest at the end, loaded while the wallet is made
            this.$svc.bvm.collections().then(c => { this.ideas = Object.values(c).slice(0, 6) }).catch(() => { })
            // set new password (it protects the wallet on this device; the recovery words restore it anywhere)
            let password: string
            try {
                password = await this.$dialog<string>({ component: NewPasswordDialog })
            } catch {
                return
            }

            this.slide = 'progress'
            await this.$nextTick()

            // generate user master key
            this.progressStr = this.$t('wizard.msg_init_animation_s1').toString()
            const umk = await randomDelay(() => secureRNG(32), 1)

            // encrypt and save user master key
            this.progressStr = this.$t('wizard.msg_init_animation_s2').toString()
            await randomDelay(async () => {
                const glob = await kdfEncrypt(umk, password)
                await this.$svc.config.setUserMasterKeyGlob(JSON.stringify(glob))
            }, 1)

            // the recovery words: new ones, or the ones typed in
            this.progressStr = this.$t(imported ? 'wizard.msg_init_animation_s3_import' : 'wizard.msg_init_animation_s3').toString()
            const words = imported ? imported.words : await randomDelay(() => Vault.generateMnemonic(16), 1)

            // encrypt the wallet
            this.progressStr = this.$t('wizard.msg_init_animation_s4').toString()
            const vault = await randomDelay(() => Promise.resolve(imported ? Vault.createHD(words, umk, imported.path) : Vault.createHD(words, umk)), 0.3)

            // save the wallet
            this.progressStr = this.$t('wizard.msg_init_animation_s5').toString()

            let walletID = -1
            let meta: M.Wallet.Meta | null = null
            await randomDelay(async () => {
                const node0 = vault.derive(0)
                meta = {
                    name: 'My Wallet',
                    type: 'hd',
                    addresses: [node0.address],
                    // restored from its words: those are the backup
                    backedUp: !!imported
                }
                walletID = await this.$svc.wallet.insert({
                    gid: genesises.main.id,
                    vault: vault.encode(),
                    meta: meta
                })
            }, 0.2)

            this.progressStr = ''
            this.finished = true
            this.importState = { words: '', path: '' }

            // backup in lite mode (a restored wallet already has its words written down)
            if (!imported && (import.meta.env.QUASAR_MODE === 'spa' || import.meta.env.QUASAR_MODE === 'pwa' || import.meta.env.QUASAR_MODE === 'electron')) {
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
    }
})
</script>
<style lang="sass" scoped>
.wizard-logo
  height: 22px

.wizard-action
  padding: 12px 16px 20px

.follow-grid
  display: grid
  grid-template-columns: repeat(3, 1fr)
  gap: 8px

.follow
  position: relative
  display: flex
  flex-direction: column
  gap: 6px
  padding: 0 0 8px
  overflow: hidden
  color: inherit
  font: inherit
  font-size: 12px
  font-weight: 700
  cursor: pointer
  img
    width: 100%
    aspect-ratio: 1
    object-fit: cover
  span
    padding: 0 6px

.follow--on
  border-color: var(--q-primary) !important

.follow-check
  position: absolute
  top: 6px
  right: 6px
  color: var(--q-primary)
  background: #000
  border-radius: 50%
</style>
