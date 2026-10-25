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
                <q-list class="bvm-list q-mb-lg">
                    <item
                        icon="o_shield"
                        :title="$t('security.title')"
                        :to="{name: 'security'}"
                    />
                    <q-item>
                        <q-item-section avatar>
                            <q-avatar icon="o_lock_clock" />
                        </q-item-section>
                        <q-item-section>
                            <q-item-label>{{$t('settings.label_autolock')}}</q-item-label>
                        </q-item-section>
                        <q-item-section side>
                            <q-select
                                v-model="prefs.autoLockMinutes"
                                dense
                                borderless
                                emit-value
                                map-options
                                :options="lockOptions"
                                style="min-width: 110px"
                            />
                        </q-item-section>
                    </q-item>
                </q-list>
                <div class="bvm-label q-mb-sm q-ml-xs">{{$t('settings.label_appearance')}}</div>
                <q-list class="bvm-list q-mb-lg">
                    <q-item>
                        <q-item-section avatar>
                            <q-avatar icon="o_palette" />
                        </q-item-section>
                        <q-item-section>
                            <q-item-label>{{$t('settings.label_accent')}}</q-item-label>
                        </q-item-section>
                        <q-item-section side>
                            <div class="row no-wrap q-gutter-x-sm">
                                <button
                                    v-for="(a, name) in accents"
                                    :key="name"
                                    type="button"
                                    class="swatch"
                                    :class="{ 'swatch--on': prefs.accent === name }"
                                    :style="{ background: a.color }"
                                    :aria-label="name"
                                    @click="setAccent(name)"
                                />
                            </div>
                        </q-item-section>
                    </q-item>
                    <q-item>
                        <q-item-section avatar>
                            <q-avatar icon="o_payments" />
                        </q-item-section>
                        <q-item-section>
                            <q-item-label>{{$t('settings.label_currency')}}</q-item-label>
                        </q-item-section>
                        <q-item-section side>
                            <q-btn-toggle
                                v-model="prefs.currency"
                                dense
                                no-caps
                                unelevated
                                toggle-color="primary"
                                color="dark"
                                :options="[{ label: '€ EUR', value: 'EUR' }, { label: '$ USD', value: 'USD' }]"
                            />
                        </q-item-section>
                    </q-item>
                    <item
                        icon="o_visibility_off"
                        :title="$t('home.action_hide')"
                    >
                        <q-toggle
                            v-model="prefs.hideBalances"
                            color="primary"
                        />
                    </item>
                    <item
                        v-if="motionSupported"
                        icon="o_vibration"
                        :title="$t('settings.label_shake_hide')"
                    >
                        <q-toggle
                            :model-value="prefs.shakeToHide"
                            color="primary"
                            @update:model-value="setShake"
                        />
                    </item>
                    <q-item>
                        <q-item-section avatar>
                            <q-avatar icon="o_format_size" />
                        </q-item-section>
                        <q-item-section>
                            <q-item-label>{{$t('settings.label_text_size')}}</q-item-label>
                            <q-slider
                                v-model="prefs.textScale"
                                :min="0.9"
                                :max="1.3"
                                :step="0.1"
                                markers
                                snap
                                color="primary"
                                :label-value="`${Math.round(prefs.textScale * 100)}%`"
                                label
                            />
                        </q-item-section>
                    </q-item>
                    <item
                        icon="o_contrast"
                        :title="$t('settings.label_contrast')"
                    >
                        <q-toggle
                            v-model="prefs.highContrast"
                            color="primary"
                        />
                    </item>
                    <item
                        icon="o_vibration"
                        :title="$t('settings.label_haptics')"
                    >
                        <q-toggle
                            v-model="prefs.haptics"
                            color="primary"
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
import { accents, applyAccent, haptic, prefs, type Accent } from 'src/utils/prefs'
import { motionSupported, requestMotion } from 'src/utils/shake'

export default defineComponent({
    components: { Item, LanguageListPopup, PageToolbar, PageContent },
    data: () => ({
        // async computed (see src/shims-async-computed.d.ts)
        bioPass: null as BioPass | null,
        bioPassSaved: null as boolean | null,
        prefs,
        accents
    }),
    asyncComputed: {
        bioPass() {
            return BioPass.open()
        },
        bioPassSaved(): Promise<boolean> {
            return this.$svc.config.getBioPassOn()
        }
    },
    computed: {
        motionSupported: () => motionSupported(),
        lockOptions(): { label: string, value: number }[] {
            return [
                { label: this.$t('settings.lock_now'), value: 0 },
                { label: this.$t('settings.lock_minutes', { n: 1 }), value: 1 },
                { label: this.$t('settings.lock_minutes', { n: 5 }), value: 5 },
                { label: this.$t('settings.lock_minutes', { n: 15 }), value: 15 },
                { label: this.$t('settings.lock_never'), value: -1 }
            ]
        }
    },
    methods: {
        async setShake(on: boolean) {
            const granted = on && await requestMotion()
            prefs.shakeToHide = granted
            if (on && !granted) {
                this.$q.notify({ message: this.$t('settings.msg_motion_denied'), color: 'negative' })
            }
        },
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
        setAccent(name: Accent) {
            prefs.accent = name
            applyAccent(name)
            haptic()
        },
        openGuide() {
            openURL(marketURL)
        }
    }
})
</script>
<style lang="sass" scoped>
.swatch
  width: 22px
  height: 22px
  padding: 0
  border-radius: 50%
  border: 2px solid transparent
  cursor: pointer

.swatch--on
  border-color: #fff
  box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.6) inset
</style>
