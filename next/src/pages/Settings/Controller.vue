<template>
    <div class="column fit no-wrap">
        <page-toolbar :title="$t('settings.title')" />
        <page-content class="col">
            <div class="settings q-pa-md">
                <div class="bvm-label q-mb-sm q-ml-xs">{{$t('settings.label_general')}}</div>
                <q-list role="group" class="bvm-list q-mb-lg">
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
                </q-list>
                <div class="bvm-label q-mb-sm q-ml-xs">{{$t('settings.label_security')}}</div>
                <q-list role="group" class="bvm-list q-mb-lg">
                    <item
                        icon="o_shield"
                        :title="$t('security.title')"
                        :to="{name: 'security'}"
                    />
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
                            :aria-label="$t('bioAuth.title')"
                            color="primary"
                            :model-value="!!bioPassSaved"
                            :disable="!bioPass"
                            @update:model-value="toggleBioPass"
                        />
                    </item>
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
                    <q-item>
                        <q-item-section avatar>
                            <q-avatar icon="o_front_hand" />
                        </q-item-section>
                        <q-item-section>
                            <q-item-label>{{$t('spendLimit.setting')}}</q-item-label>
                            <q-item-label caption>{{$t('spendLimit.setting_hint')}}</q-item-label>
                        </q-item-section>
                        <q-item-section side>
                            <q-select
                                v-model="prefs.spendLimit"
                                :options="limitOptions"
                                emit-value
                                map-options
                                dense
                                borderless
                                style="min-width: 96px"
                            />
                        </q-item-section>
                    </q-item>
                </q-list>
                <div class="bvm-label q-mb-sm q-ml-xs">{{$t('settings.label_privacy')}}</div>
                <q-list role="group" class="bvm-list q-mb-lg">
                    <item
                        icon="o_visibility_off"
                        :title="$t('home.action_hide')"
                    >
                        <q-toggle
                            :aria-label="$t('home.action_hide')"
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
                            :aria-label="$t('settings.label_shake_hide')"
                            :model-value="prefs.shakeToHide"
                            color="primary"
                            @update:model-value="setShake"
                        />
                    </item>
                    <item
                        v-if="hasServer"
                        icon="o_bug_report"
                        :title="$t('service.label_error_reports')"
                        :caption="$t('service.msg_error_reports')"
                    >
                        <q-toggle
                            :aria-label="$t('service.label_error_reports')"
                            v-model="prefs.errorReports"
                            color="primary"
                        />
                    </item>
                </q-list>
                <div class="bvm-label q-mb-sm q-ml-xs">{{$t('settings.label_appearance')}}</div>
                <q-list role="group" class="bvm-list q-mb-lg">
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
                                :aria-label="$t('settings.label_text_size')"
                                label
                            />
                        </q-item-section>
                    </q-item>
                    <item
                        icon="o_touch_app"
                        :title="$t('simple.label_setting')"
                    >
                        <q-toggle
                            :aria-label="$t('simple.label_setting')"
                            :model-value="prefs.simpleMode"
                            color="primary"
                            @update:model-value="setSimple"
                        />
                    </item>
                    <item
                        icon="o_contrast"
                        :title="$t('settings.label_contrast')"
                    >
                        <q-toggle
                            :aria-label="$t('settings.label_contrast')"
                            v-model="prefs.highContrast"
                            color="primary"
                        />
                    </item>
                    <item
                        icon="o_vibration"
                        :title="$t('settings.label_haptics')"
                    >
                        <q-toggle
                            :aria-label="$t('settings.label_haptics')"
                            v-model="prefs.haptics"
                            color="primary"
                        />
                    </item>
                    <item
                        icon="o_notifications_active"
                        :title="$t('settings.label_sound')"
                    >
                        <q-toggle
                            :aria-label="$t('settings.label_sound')"
                            v-model="prefs.sound"
                            color="primary"
                            @update:model-value="v => v && playChime()"
                        />
                    </item>
                </q-list>
                <template v-if="desktopPrefs && (desktopPrefs.canTray || desktopPrefs.canLogin)">
                    <div class="bvm-label q-mb-sm q-ml-xs">{{$t('desktopApp.title')}}</div>
                    <q-list role="group" class="bvm-list q-mb-lg">
                        <item
                            v-if="desktopPrefs.canLogin"
                            icon="o_power_settings_new"
                            :title="$t('desktopApp.label_login')"
                            :caption="$t('desktopApp.msg_login')"
                        >
                            <q-toggle
                                :aria-label="$t('desktopApp.label_login')"
                                :model-value="desktopPrefs.openAtLogin"
                                color="primary"
                                @update:model-value="v => setDesktop({ openAtLogin: v })"
                            />
                        </item>
                        <item
                            v-if="desktopPrefs.canTray"
                            icon="o_move_to_inbox"
                            :title="$t('desktopApp.label_tray')"
                            :caption="$t('desktopApp.msg_tray')"
                        >
                            <q-toggle
                                :aria-label="$t('desktopApp.label_tray')"
                                :model-value="desktopPrefs.keepInTray"
                                color="primary"
                                @update:model-value="v => setDesktop({ keepInTray: v })"
                            />
                        </item>
                    </q-list>
                </template>
                <div class="bvm-label q-mb-sm q-ml-xs">{{$t('settings.label_network')}}</div>
                <q-list role="group" class="bvm-list q-mb-lg">
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
                <div class="bvm-label q-mb-sm q-ml-xs">{{$t('settingsBackup.label')}}</div>
                <q-list role="group" class="bvm-list q-mb-sm">
                    <item
                        icon="o_cloud_download"
                        :title="$t('settingsBackup.action_export')"
                        clickable
                        :disable="backupBusy"
                        @click="exportSettings()"
                    />
                    <item
                        icon="o_settings_backup_restore"
                        :title="$t('settingsBackup.action_import')"
                        clickable
                        :disable="backupBusy"
                        @click="pickBackup()"
                    />
                </q-list>
                <div class="text-muted backup-hint q-mx-xs q-mb-lg">{{$t('settingsBackup.msg_hint')}}</div>
                <input
                    ref="backupFile"
                    type="file"
                    accept=".json,application/json"
                    class="hidden"
                    @change="importSettings"
                >
                <q-list role="group" class="bvm-list">
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
import { LIMIT_OPTIONS } from 'src/utils/spend-limit'
import { playChime } from 'src/utils/sound'
import { serverUrl } from 'src/utils/endpoints'
import { BackupError, CONFIG_KEYS, LOCAL_KEYS, decryptSettings, encryptSettings, summarize, type Settings } from 'src/utils/settings-backup'
import { downloadText } from 'src/utils/export'
import { money } from 'src/utils/prefs'
import { desktop, type DesktopPrefs } from 'src/utils/desktop'

export default defineComponent({
    components: { Item, LanguageListPopup, PageToolbar, PageContent },
    data: () => ({
        hasServer: serverUrl !== null,
        backupBusy: false,
        // async computed (see src/shims-async-computed.d.ts)
        bioPass: null as BioPass | null,
        bioPassSaved: null as boolean | null,
        prefs,
        accents,
        // the desktop app's tray and login item; null in the web app
        desktopPrefs: null as DesktopPrefs | null
    }),
    async created() {
        this.desktopPrefs = desktop ? await desktop.getPrefs() : null
    },
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
        limitOptions(): { label: string, value: number }[] {
            return LIMIT_OPTIONS.map(v => ({ label: v ? money(v) : this.$t('spendLimit.off'), value: v }))
        },
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
        /** the simple home; a size up with it, which the user can still change */
        setSimple(on: boolean) {
            prefs.simpleMode = on
            if (on && prefs.textScale < 1.1) prefs.textScale = 1.1
        },
        playChime,
        async setDesktop(next: Partial<Pick<DesktopPrefs, 'keepInTray' | 'openAtLogin'>>) {
            if (!desktop || !this.desktopPrefs) return
            await desktop.setPrefs(next)
            this.desktopPrefs = await desktop.getPrefs()
        },
        /** ask for the backup's password; twice when making one */
        askPassword(title: string, confirm: boolean): Promise<string | null> {
            const ask = (message: string) => new Promise<string | null>(resolve => {
                this.$q.dialog({
                    title,
                    message,
                    prompt: { model: '', type: 'password', isValid: (v: string) => v.length >= 8 },
                    cancel: true,
                    persistent: true
                }).onOk((v: string) => resolve(v)).onCancel(() => resolve(null)).onDismiss(() => resolve(null))
            })
            return ask(this.$t('settingsBackup.msg_password')).then(async first => {
                if (first === null || !confirm) return first
                const again = await ask(this.$t('settingsBackup.msg_password_again'))
                if (again === null) return null
                if (again !== first) {
                    this.$q.notify(this.$t('settingsBackup.msg_mismatch'))
                    return null
                }
                return first
            })
        },
        async exportSettings() {
            const password = await this.askPassword(this.$t('settingsBackup.action_export'), true)
            if (!password) return
            this.backupBusy = true
            try {
                const settings: Settings = { local: {}, config: {} }
                for (const k of LOCAL_KEYS) {
                    const v = localStorage.getItem(k)
                    if (v !== null) settings.local[k] = v
                }
                for (const k of CONFIG_KEYS) {
                    const v = await this.$svc.config.getBackupValue(k)
                    if (v) settings.config[k] = v
                }
                const file = await encryptSettings(settings, password)
                downloadText(`blackvault-settings-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(file, null, 1), 'application/json')
                this.$q.notify(this.$t('settingsBackup.msg_exported'))
            } finally {
                this.backupBusy = false
            }
        },
        pickBackup() {
            (this.$refs.backupFile as HTMLInputElement).click()
        },
        async importSettings(e: Event) {
            const input = e.target as HTMLInputElement
            const file = input.files?.[0]
            input.value = ''
            if (!file || file.size > 8 * 1024 * 1024) return
            const text = await file.text()
            const password = await this.askPassword(this.$t('settingsBackup.action_import'), false)
            if (!password) return
            this.backupBusy = true
            let settings: Settings
            try {
                settings = await decryptSettings(text, password)
            } catch (err) {
                this.$q.notify(this.$t(err instanceof BackupError && err.reason === 'password' ? 'settingsBackup.msg_wrong_password' : 'settingsBackup.msg_not_a_backup'))
                return
            } finally {
                this.backupBusy = false
            }
            const sum = summarize(settings)
            const ok = await new Promise<boolean>(resolve => {
                this.$q.dialog({
                    title: this.$t('settingsBackup.action_import'),
                    message: this.$t('settingsBackup.msg_confirm', sum) + (sum.names ? `\n\n${this.$t('settingsBackup.label_contacts')}: ${sum.names}` : ''),
                    style: 'white-space: pre-line',
                    cancel: true,
                    ok: { label: this.$t('settingsBackup.action_restore'), color: 'primary', unelevated: true, noCaps: true }
                }).onOk(() => resolve(true)).onCancel(() => resolve(false)).onDismiss(() => resolve(false))
            })
            if (!ok) return
            for (const [k, v] of Object.entries(settings.local)) {
                localStorage.setItem(k, v)
            }
            for (const [k, v] of Object.entries(settings.config)) {
                await this.$svc.config.setBackupValue(k as typeof CONFIG_KEYS[number], v)
            }
            // everything reads its settings at start: start again
            window.location.reload()
        },
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
.backup-hint
  font-size: 12px

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
