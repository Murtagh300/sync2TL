<template>
    <div class="column fit no-wrap">
        <page-toolbar :title="$t('settings.title')" />
        <page-content class="col">
            <div class="settings q-pa-md">
                <div class="bvm-label q-mb-sm q-ml-xs">{{$t('settings.label_general')}}</div>
                <q-list class="bvm-list q-mb-lg">
                    <language-list-popup
                        v-slot="{displayName}"
                        anchor="bottom right"
                        self="top right"
                        :offset="[-16, 0]"
                    >
                        <item
                            icon="o_language"
                            :title="$t('settings.action_language')"
                            :value="displayName"
                            clickable
                        />
                    </language-list-popup>
                    <item
                        icon="o_lock"
                        :title="$t('settings.action_change_password')"
                        clickable
                        @click="onClickChangePassword()"
                    />
                    <item
                        v-if="bioPass"
                        icon="o_fingerprint"
                        :title="$t('bioAuth.title')"
                    >
                        <q-toggle
                            color="primary"
                            :model-value="!!bioPassSaved"
                            :disable="!bioPass"
                            @update:model-value="toggleBioPass"
                        />
                    </item>
                </q-list>
                <div class="bvm-label q-mb-sm q-ml-xs">{{$t('settings.label_network')}}</div>
                <q-list class="bvm-list q-mb-lg">
                    <item
                        icon="o_contacts"
                        :title="$t('contacts.title')"
                        :to="{name: 'contacts'}"
                    />
                    <item
                        icon="o_toll"
                        :title="$t('settings.action_token_list')"
                        :to="{name: 'tokens-setting'}"
                    />
                    <item
                        icon="o_dns"
                        :title="$t('settings.action_nodes')"
                        :to="{name: 'nodes-setting'}"
                    />
                </q-list>
                <q-list class="bvm-list">
                    <item
                        icon="o_storefront"
                        :title="$t('settings.action_user_guide')"
                        clickable
                        @click="openGuide()"
                    />
                </q-list>
            </div>
        </page-content>
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import Item from './Item.vue'
import NewPasswordDialog from 'pages/NewPasswordDialog'
import { BioPass } from 'src/utils/bio-pass'
import LanguageListPopup from 'pages/LanguageListPopup.vue'
import PageToolbar from 'components/PageToolbar.vue'
import PageContent from 'src/components/PageContent.vue'
import { kdfEncrypt } from 'src/core/vault'
import { openURL } from 'src/utils/open-url'
import { marketURL } from 'boot/services/bvm'

export default defineComponent({
    components: { Item, LanguageListPopup, PageToolbar, PageContent },
    data: () => ({
        // async computed (see src/shims-async-computed.d.ts)
        bioPass: null as BioPass | null,
        bioPassSaved: null as boolean | null
    }),
    asyncComputed: {
        bioPass() {
            return BioPass.open()
        },
        bioPassSaved(): Promise<boolean> {
            return this.$svc.config.getBioPassOn()
        }
    },
    methods: {
        // TODO faceID
        async toggleBioPass(newVal: boolean) {
            const bioPass = this.bioPass
            if (!bioPass) {
                return
            }

            try {
                if (newVal) {
                    const umk = await this.$authenticate()
                    if (this.$q.platform.is.ios) {
                        await bioPass.show(
                            this.$t('bioAuth.title').toString(),
                            this.$t('common.cancel').toString()
                        )
                    }
                    await bioPass.save(
                        this.$t('bioAuth.title').toString(),
                        this.$t('common.cancel').toString(),
                        umk.toString('hex'))
                }
                await this.$svc.config.setBioPassOn(newVal)
            } catch (err) {
                const e = err as {code?: number, message?: string}
                if (e?.code === -102) { /* BIOMETRIC_AUTHENTICATION_FAILED */
                    this.$q.notify({
                        textColor: 'white',
                        position: 'top',
                        type: 'warning',
                        message: this.$t('bioAuth.msg_auth_failed').toString()
                    })
                } else {
                    console.warn(err)
                }
            }
        },
        async onClickChangePassword() {
            try {
                const umk = await this.$authenticate()
                const newPassword = await this.$dialog<string>({ component: NewPasswordDialog })
                try {
                    await this.$loading(async () => {
                        const glob = await kdfEncrypt(umk, newPassword)
                        await this.$svc.config.setUserMasterKeyGlob(JSON.stringify(glob))
                    })
                    this.$q.notify(this.$t('settings.msg_password_changed'))
                } catch (err) {
                    // fatal error
                    console.error(err)
                }
            } catch { }
        },
        openGuide() {
            openURL(marketURL)
        }
    }
})
</script>
