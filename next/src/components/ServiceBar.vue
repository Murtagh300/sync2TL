<template>
    <div
        v-if="line"
        class="service-bar row no-wrap items-center q-gutter-x-sm"
        :class="`service-bar--${line.level}`"
        role="status"
    >
        <q-icon
            :name="line.icon"
            size="16px"
        />
        <div class="col">{{line.text}}</div>
        <q-btn
            v-if="line.kind === 'update'"
            flat
            dense
            no-caps
            :label="$t('service.action_update')"
            @click="reload()"
        />
        <q-btn
            v-else
            flat
            dense
            round
            size="sm"
            icon="close"
            :aria-label="$t('common.close')"
            @click="dismiss(line.key)"
        />
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import { network } from 'src/utils/network'
import { remote, compareVersions, noticeText, downServices } from 'src/utils/remote-config'
import { applyUpdate } from 'src/utils/app-update'

const KEY = 'bv-dismissed-notices'

function loadDismissed(): string[] {
    try {
        const v = JSON.parse(localStorage.getItem(KEY) || '[]') as unknown
        return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(-20) : []
    } catch {
        return []
    }
}

type Line = { kind: 'update' | 'notice' | 'degraded', key: string, level: 'info' | 'warning', icon: string, text: string }

// what the BlackVault server has to say: an update that is needed, a notice, services that are down
export default defineComponent({
    data: () => ({ remote, network, dismissed: loadDismissed() }),
    computed: {
        line(): Line | null {
            if (!this.network.online) return null
            const flags = this.remote.flags
            const version = String(import.meta.env.APP_VERSION || '0.0.0')
            if (flags && compareVersions(version, flags.minVersion || '0.0.0') < 0) {
                return { kind: 'update', key: 'update', level: 'warning', icon: 'o_system_update', text: this.$t('service.msg_update') }
            }
            const text = noticeText(flags, this.$i18n.locale)
            const noticeKey = `notice:${text}`
            if (text && !this.dismissed.includes(noticeKey)) {
                return { kind: 'notice', key: noticeKey, level: flags?.notice?.level || 'info', icon: 'o_campaign', text }
            }
            const down = downServices(this.remote.health)
            const downKey = `down:${down.join(',')}:${this.remote.health?.at.slice(0, 13) || ''}`
            if (down.length && !this.dismissed.includes(downKey)) {
                return { kind: 'degraded', key: downKey, level: 'warning', icon: 'o_cloud_sync', text: this.$t('service.msg_degraded', { services: down.join(', ') }) }
            }
            return null
        }
    },
    methods: {
        dismiss(key: string) {
            this.dismissed = [...this.dismissed, key].slice(-20)
            try {
                localStorage.setItem(KEY, JSON.stringify(this.dismissed))
            } catch { }
        },
        reload() {
            void applyUpdate()
        }
    }
})
</script>
<style lang="sass" scoped>
.service-bar
  flex: none
  padding: 4px 8px 4px 12px
  font-size: 13px
  font-weight: 700
  background: var(--bv-accent-soft)
  color: var(--q-primary)

.service-bar--warning
  background: rgba(252, 211, 77, 0.12)
  color: $warning
</style>
