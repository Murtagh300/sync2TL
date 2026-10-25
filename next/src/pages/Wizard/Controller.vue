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
                    @click="onClickStart()"
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
                <h4 class="q-mb-none bvm-display">{{$t('wizard.title_init')}}</h4>
                <Progress
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
                    :label="$t('common.finish')"
                    @click="$emit('done')"
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
        Progress,
        FeatureSlides,
        LanguageListPopup,
        PageContent
    },
    data: () => {
        return {
            slide: 'welcome',
            progressStr: '',
            finished: false
        }
    },
    methods: {
        async onClickStart() {
            // set new password
            const password = await this.$dialog<string>({ component: NewPasswordDialog })

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

            // generate mnemonics of the first wallet
            this.progressStr = this.$t('wizard.msg_init_animation_s3').toString()
            const words = await randomDelay(() => Vault.generateMnemonic(16), 1)

            // encrypt the wallet
            this.progressStr = this.$t('wizard.msg_init_animation_s4').toString()
            const vault = await randomDelay(() => Promise.resolve(Vault.createHD(words, umk)), 0.3)

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
                    backedUp: false
                }
                walletID = await this.$svc.wallet.insert({
                    gid: genesises.main.id,
                    vault: vault.encode(),
                    meta: meta
                })
            }, 0.2)

            this.progressStr = ''
            this.finished = true

            // backup in lite mode
            if (import.meta.env.QUASAR_MODE === 'spa' || import.meta.env.QUASAR_MODE === 'pwa') {
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
</style>
