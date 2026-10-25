<template>
    <div class="fit column no-wrap">
        <page-toolbar :title="$t('emergency.title')" />
        <page-content
            class="col"
            padding
        >
            <div class="bvm-tile q-pa-md q-mb-md row no-wrap items-start">
                <q-icon
                    name="o_family_restroom"
                    size="28px"
                    color="primary"
                />
                <p class="q-ml-md q-mb-none text-soft intro">{{$t('emergency.msg_intro')}}</p>
            </div>

            <div class="row items-center q-mb-sm">
                <div class="bvm-label">{{$t('emergency.label_checklist')}}</div>
                <q-space />
                <span class="text-muted done">{{done}}/{{items.length}}</span>
            </div>
            <q-list class="bvm-list q-mb-md">
                <q-item
                    v-for="item in items"
                    :key="item.key"
                    tag="label"
                    clickable
                >
                    <q-item-section avatar>
                        <q-checkbox
                            v-model="state.checked"
                            :val="item.key"
                            color="primary"
                        />
                    </q-item-section>
                    <q-item-section>
                        <q-item-label class="text-weight-bold">{{item.title}}</q-item-label>
                        <q-item-label caption>{{item.text}}</q-item-label>
                    </q-item-section>
                    <q-item-section
                        v-if="item.to"
                        side
                    >
                        <q-btn
                            flat
                            dense
                            no-caps
                            color="primary"
                            :label="$t('emergency.action_go')"
                            :to="item.to"
                            @click.stop
                        />
                    </q-item-section>
                </q-item>
            </q-list>

            <div class="bvm-tile q-pa-md q-mb-md">
                <div class="text-weight-bold">{{$t('emergency.label_letter')}}</div>
                <p class="text-soft q-mt-xs">{{$t('emergency.msg_letter')}}</p>
                <q-btn
                    outline
                    no-caps
                    color="primary"
                    icon="o_print"
                    :label="$t('emergency.action_print')"
                    @click="printLetter()"
                />
            </div>
            <div
                v-if="state.reviewedAt"
                class="text-muted text-center reviewed"
            >{{$t('emergency.label_reviewed', { when: new Date(state.reviewedAt).toLocaleDateString() })}}</div>
            <q-btn
                flat
                no-caps
                class="full-width q-mt-xs"
                color="primary"
                :label="$t('emergency.action_reviewed')"
                @click="state.reviewedAt = Date.now()"
            />
        </page-content>
    </div>
</template>
<script lang="ts">
import { defineComponent, reactive, watch } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import PageToolbar from 'components/PageToolbar.vue'
import PageContent from 'components/PageContent.vue'
import { printWindow } from 'src/utils/export'

const KEY = 'bv-emergency'

function load(): { checked: string[], reviewedAt: number } {
    try {
        return { checked: [], reviewedAt: 0, ...JSON.parse(localStorage.getItem(KEY) || '{}') as object }
    } catch {
        return { checked: [], reviewedAt: 0 }
    }
}

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))

/**
 * what your family needs to know if something happens to you, without ever storing or
 * printing the recovery words themselves
 */
export default defineComponent({
    components: { PageToolbar, PageContent },
    data: () => ({
        state: reactive(load()),
        wallets: [] as M.Wallet[]
    }),
    computed: {
        items(): { key: string, title: string, text: string, to?: RouteLocationRaw }[] {
            const firstUnbacked = this.wallets.find(w => w.meta.type === 'hd' && !w.meta.backedUp)
            return [
                { key: 'backup', title: this.$t('emergency.i_backup'), text: this.$t('emergency.i_backup_text'), to: firstUnbacked ? { name: 'backup', params: { walletId: String(firstUnbacked.id) } } : undefined },
                { key: 'place', title: this.$t('emergency.i_place'), text: this.$t('emergency.i_place_text') },
                { key: 'person', title: this.$t('emergency.i_person'), text: this.$t('emergency.i_person_text') },
                { key: 'letter', title: this.$t('emergency.i_letter'), text: this.$t('emergency.i_letter_text') },
                { key: 'yearly', title: this.$t('emergency.i_yearly'), text: this.$t('emergency.i_yearly_text') }
            ]
        },
        done(): number {
            return this.items.filter(i => this.state.checked.includes(i.key)).length
        }
    },
    async created() {
        this.wallets = await this.$svc.wallet.all()
        watch(this.state, v => {
            try {
                localStorage.setItem(KEY, JSON.stringify(v))
            } catch { }
        }, { deep: true })
    },
    methods: {
        /** a letter with the wallets and how to restore them; never the words */
        printLetter() {
            const w = window.open('', '_blank')
            if (!w) {
                this.$q.notify(this.$t('export.msg_popup'))
                return
            }
            const rows = this.wallets.map(x => `<tr><td>${esc(x.meta.name)}</td><td>${esc(this.$netDisplayName(x.gid))}</td><td>${esc(x.meta.type === 'watch' ? this.$t('watch.label') : this.$t('emergency.letter_words'))}</td><td><code>${x.meta.addresses.map(esc).join('<br>')}</code></td></tr>`).join('')
            w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(this.$t('emergency.letter_title'))}</title>
<style>body{font:13px system-ui,sans-serif;margin:32px;color:#111;line-height:1.5}h1{font-size:20px}table{border-collapse:collapse;width:100%;margin:12px 0}td,th{border:1px solid #ccc;padding:6px 8px;text-align:left;vertical-align:top}code{font-size:11px}.box{border:2px dashed #999;padding:12px;margin-top:16px}</style></head><body>
<h1>${esc(this.$t('emergency.letter_title'))}</h1>
<p>${esc(this.$t('emergency.letter_intro'))}</p>
<table><tr><th>${esc(this.$t('emergency.letter_wallet'))}</th><th>${esc(this.$t('emergency.letter_network'))}</th><th>${esc(this.$t('emergency.letter_key'))}</th><th>${esc(this.$t('emergency.letter_addresses'))}</th></tr>${rows}</table>
<h2>${esc(this.$t('emergency.letter_restore_title'))}</h2>
<ol><li>${esc(this.$t('emergency.letter_step1'))}</li><li>${esc(this.$t('emergency.letter_step2'))}</li><li>${esc(this.$t('emergency.letter_step3'))}</li><li>${esc(this.$t('emergency.letter_step4'))}</li></ol>
<div class="box">${esc(this.$t('emergency.letter_where'))}<br><br>______________________________________________</div>
<p style="color:#a00"><b>${esc(this.$t('emergency.letter_warning'))}</b></p>
</body></html>`)
            w.document.close()
            printWindow(w)
            if (!this.state.checked.includes('letter')) {
                this.state.checked.push('letter')
            }
        }
    }
})
</script>
<style lang="sass" scoped>
.intro
  line-height: 1.5

.done
  font-size: 13px
  font-weight: 800

.reviewed
  font-size: 12px
</style>
