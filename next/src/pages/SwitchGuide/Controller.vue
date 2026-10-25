<template>
    <div class="fit column no-wrap">
        <page-toolbar :title="$t('switchGuide.title')" />
        <page-content
            class="col"
            padding
        >
            <p class="text-soft">{{$t('switchGuide.msg_intro')}}</p>

            <!-- why it works -->
            <div class="bvm-tile q-pa-md q-mb-md row no-wrap">
                <q-icon
                    name="o_verified"
                    size="24px"
                    color="primary"
                />
                <div class="q-ml-md">
                    <div class="text-weight-bold">{{$t('switchGuide.title_same')}}</div>
                    <div class="text-soft guide-text">{{$t('switchGuide.msg_same')}}</div>
                </div>
            </div>

            <q-btn-toggle
                v-model="from"
                spread
                no-caps
                unelevated
                toggle-color="primary"
                color="dark"
                class="q-mb-md source"
                :options="[{ label: 'VeWorld', value: 'veworld' }, { label: 'Sync2', value: 'sync2' }, { label: $t('switchGuide.other'), value: 'other' }]"
            />

            <ol class="steps">
                <li
                    v-for="(step, k) in steps"
                    :key="from + k"
                    class="bvm-tile step"
                >
                    <div class="text-weight-bold">{{step.title}}</div>
                    <div class="text-soft guide-text">{{step.text}}</div>
                </li>
            </ol>

            <div class="bvm-tile q-pa-md q-mt-md warn row no-wrap">
                <q-icon
                    name="o_gpp_maybe"
                    size="24px"
                    color="warning"
                />
                <div class="q-ml-md">
                    <div class="text-weight-bold">{{$t('switchGuide.title_limits')}}</div>
                    <ul class="limits">
                        <li>{{$t('switchGuide.limit_key')}}</li>
                        <li>{{$t('switchGuide.limit_ledger')}}</li>
                        <li>{{$t('switchGuide.limit_safety')}}</li>
                    </ul>
                </div>
            </div>
        </page-content>
        <page-action>
            <q-btn
                unelevated
                no-caps
                size="lg"
                color="primary"
                icon="o_key"
                :label="$t('newWallet.action_import')"
                :to="{ name: 'new-wallet' }"
            />
        </page-action>
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import PageToolbar from 'components/PageToolbar.vue'
import PageContent from 'components/PageContent.vue'
import PageAction from 'components/PageAction.vue'

type Source = 'veworld' | 'sync2' | 'other'

// moving a wallet from VeWorld or Sync2: the same recovery words give the same addresses
export default defineComponent({
    components: { PageToolbar, PageContent, PageAction },
    data: () => ({
        from: 'veworld' as Source
    }),
    computed: {
        steps(): { title: string, text: string }[] {
            const n = [1, 2, 3, 4]
            return n.map(i => ({
                title: this.$t(`switchGuide.${this.from}_${i}_title`),
                text: this.$t(`switchGuide.${this.from}_${i}`)
            }))
        }
    }
})
</script>
<style lang="sass" scoped>
.guide-text
  font-size: 13px
  line-height: 1.45
  margin-top: 2px

.source
  border: 1px solid $hairline-2

.steps
  list-style: none
  padding: 0
  margin: 0
  counter-reset: step
  display: grid
  gap: 8px

.step
  position: relative
  padding: 12px 14px 12px 48px
  counter-increment: step
  &::before
    content: counter(step)
    position: absolute
    left: 14px
    top: 12px
    width: 24px
    height: 24px
    border-radius: 50%
    background: var(--q-primary)
    color: $on-primary
    font-weight: 900
    font-size: 13px
    display: flex
    align-items: center
    justify-content: center

.warn
  border-color: rgba(252, 211, 77, 0.35)

.limits
  margin: 4px 0 0
  padding-left: 18px
  font-size: 13px
  line-height: 1.45
  color: $text-soft
</style>
