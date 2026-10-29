<template>
    <div class="fit column no-wrap">
        <page-toolbar :title="$t('security.title')" />
        <page-content
            class="col"
            padding
        >
            <!-- the score -->
            <div class="bvm-tile score q-mb-lg row no-wrap items-center">
                <q-circular-progress
                    :value="score"
                    size="76px"
                    :thickness="0.14"
                    :color="score >= 80 ? 'primary' : score >= 50 ? 'warning' : 'negative'"
                    track-color="grey-9"
                    show-value
                    class="score-ring"
                    :aria-label="$t('security.title')"
                >
                    <span class="bvm-display score-value">{{done}}/{{checks.length}}</span>
                </q-circular-progress>
                <div class="q-ml-md">
                    <div class="bvm-display score-title">{{scoreTitle}}</div>
                    <div class="text-soft">{{$t('security.msg_score')}}</div>
                </div>
            </div>

            <q-list role="group" class="bvm-list">
                <q-item
                    v-for="c in checks"
                    :key="c.key"
                    clickable
                    @click="fix(c.key)"
                >
                    <q-item-section avatar>
                        <q-icon
                            :name="c.state === 'ok' ? 'check_circle' : c.state === 'checking' ? 'o_hourglass_top' : 'o_error_outline'"
                            :color="c.state === 'ok' ? 'primary' : c.state === 'checking' ? 'grey-6' : 'warning'"
                            size="26px"
                        />
                    </q-item-section>
                    <q-item-section>
                        <q-item-label>{{c.title}}</q-item-label>
                        <q-item-label caption>{{c.detail}}</q-item-label>
                    </q-item-section>
                    <q-item-section side>
                        <q-icon
                            name="chevron_right"
                            class="text-muted"
                        />
                    </q-item-section>
                </q-item>
            </q-list>
            <q-btn
                outline
                no-caps
                color="negative"
                icon="o_emergency"
                class="full-width q-mt-lg"
                :label="$t('panic.action_open')"
                :to="{ name: 'panic' }"
            />
            <p class="text-caption text-muted q-mt-xs text-center">{{$t('panic.msg_open')}}</p>
        </page-content>
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import PageToolbar from 'components/PageToolbar.vue'
import PageContent from 'components/PageContent.vue'
import { BioPass } from 'src/utils/bio-pass'
import { prefs } from 'src/utils/prefs'
import { findApprovals, type Approval } from 'src/utils/approvals'
import { contractName, UNLIMITED } from 'src/utils/actions'
import { dappsFromActivity } from 'src/utils/dapps'
import { genesises } from 'src/consts'

type Key = 'backup' | 'lock' | 'bio' | 'approvals' | 'dapps' | 'emergency'
type Check = { key: Key, title: string, detail: string, state: 'ok' | 'todo' | 'checking' }

// how safe this wallet is set up, with a way to fix each point
export default defineComponent({
    components: { PageToolbar, PageContent },
    data: () => ({
        prefs,
        wallets: [] as M.Wallet[],
        bioAvailable: false,
        bioOn: false,
        risky: null as number | null,
        dappCount: 0,
        emergencyDone: (() => {
            try {
                return ((JSON.parse(localStorage.getItem('bv-emergency') || '{}') as { checked?: string[] }).checked || []).length >= 4
            } catch {
                return false
            }
        })()
    }),
    computed: {
        notBackedUp(): M.Wallet[] {
            return this.wallets.filter(w => !w.meta.backedUp)
        },
        checks(): Check[] {
            const list: Check[] = [
                {
                    key: 'backup',
                    title: this.$t('security.check_backup'),
                    detail: this.notBackedUp.length ? this.$t('security.todo_backup', { n: this.notBackedUp.length }) : this.$t('security.ok_backup'),
                    state: this.notBackedUp.length ? 'todo' : 'ok'
                },
                {
                    key: 'lock',
                    title: this.$t('security.check_lock'),
                    detail: prefs.autoLockMinutes >= 0 ? this.$t('security.ok_lock', { n: prefs.autoLockMinutes }) : this.$t('security.todo_lock'),
                    state: prefs.autoLockMinutes >= 0 ? 'ok' : 'todo'
                },
                {
                    key: 'approvals',
                    title: this.$t('security.check_approvals'),
                    detail: this.risky === null ? this.$t('security.checking') : this.risky ? this.$t('security.todo_approvals', { n: this.risky }) : this.$t('security.ok_approvals'),
                    state: this.risky === null ? 'checking' : this.risky ? 'todo' : 'ok'
                },
                {
                    key: 'emergency',
                    title: this.$t('emergency.title'),
                    detail: this.emergencyDone ? this.$t('security.ok_emergency') : this.$t('security.todo_emergency'),
                    state: this.emergencyDone ? 'ok' : 'todo'
                },
                {
                    key: 'dapps',
                    title: this.$t('security.check_dapps'),
                    detail: this.$t('security.info_dapps', { n: this.dappCount }),
                    state: 'ok'
                }
            ]
            if (this.bioAvailable) {
                list.splice(2, 0, {
                    key: 'bio',
                    title: this.$t('security.check_bio'),
                    detail: this.bioOn ? this.$t('security.ok_bio') : this.$t('security.todo_bio'),
                    state: this.bioOn ? 'ok' : 'todo'
                })
            }
            return list
        },
        done(): number {
            return this.checks.filter(c => c.state === 'ok').length
        },
        score(): number {
            return Math.round((this.done / this.checks.length) * 100)
        },
        scoreTitle(): string {
            return this.score >= 80 ? this.$t('security.score_good') : this.score >= 50 ? this.$t('security.score_fair') : this.$t('security.score_poor')
        }
    },
    async created() {
        const [wallets, activity, bio, bioOn] = await Promise.all([
            this.$svc.wallet.all(),
            this.$svc.activity.page(1000, 0),
            BioPass.open().catch(() => null),
            this.$svc.config.getBioPassOn()
        ])
        this.wallets = wallets
        this.dappCount = dappsFromActivity(activity).length
        this.bioAvailable = !!bio
        this.bioOn = bioOn
        // unlimited or collection-wide approvals to contracts nobody named
        const main = wallets.filter(w => w.gid === genesises.main.id).flatMap(w => w.meta.addresses)
        let risky = 0
        for (const a of main) {
            try {
                const found = await findApprovals(this.$svc.bc(genesises.main.id).thor, a)
                risky += found.filter((x: Approval) => !contractName(x.spender) && (x.kind === 'nft' || x.allowance >= UNLIMITED)).length
            } catch { }
        }
        this.risky = risky
    },
    methods: {
        fix(key: Key) {
            switch (key) {
                case 'backup': {
                    const w = this.notBackedUp[0]
                    if (w) void this.$router.push({ name: 'backup', params: { walletId: String(w.id) } })
                    break
                }
                case 'lock':
                case 'bio':
                    void this.$router.push({ name: 'settings' })
                    break
                case 'approvals': {
                    const w = this.wallets.find(x => x.gid === genesises.main.id)
                    if (w) void this.$router.push({ name: 'approvals', params: { walletId: String(w.id), addressIndex: '0' } })
                    break
                }
                case 'emergency':
                    void this.$router.push({ name: 'emergency' })
                    break
                case 'dapps':
                    void this.$router.push({ name: 'dapps' })
                    break
            }
        }
    }
})
</script>
<style lang="sass" scoped>
.score
  padding: 16px

.score-value
  font-size: 18px

.score-title
  font-size: 22px
</style>
