<template>
    <div class="column no-wrap">
        <h1 class="hero-title bvm-display">{{$t('wizard.title_welcome')}}</h1>
        <p class="hero-body">{{$t('wizard.msg_feature_1')}}</p>

        <div class="features q-mt-lg">
            <div
                v-for="f in features"
                :key="f.icon"
                class="bvm-tile feature row no-wrap items-start"
            >
                <q-icon
                    :name="f.icon"
                    size="20px"
                    color="primary"
                    class="q-mr-sm q-mt-xs"
                />
                <div>
                    <div class="feature-title">{{f.title}}</div>
                    <div
                        v-if="f.content"
                        class="feature-body"
                    >{{f.content}}</div>
                </div>
            </div>
        </div>
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'

// the welcome screen: what BlackVault is, before the first wallet is made
export default defineComponent({
    computed: {
        features() {
            return [{
                icon: 'o_lock',
                title: this.$t('wizard.title_feature_1').toString(),
                content: ''
            }, {
                icon: 'o_swap_horiz',
                title: this.$t('wizard.title_feature_2').toString(),
                content: this.$t('wizard.msg_feature_2').toString()
            }, {
                icon: 'o_draw',
                title: this.$t('wizard.title_feature_3').toString(),
                content: this.$t('wizard.msg_feature_3').toString()
            }]
        }
    }
})
</script>
<style lang="sass" scoped>
.hero-title
  margin: 0
  font-size: clamp(44px, 13vw, 64px)

.hero-body
  margin: 16px 0 0
  max-width: 34ch
  font-size: 16px
  line-height: 1.5
  color: $text-soft

.features
  display: grid
  grid-template-columns: 1fr 1fr
  gap: 10px

.feature
  padding: 14px

// the first one has the most to say and spans the row
.feature:first-child
  grid-column: 1 / -1

.feature-title
  font-weight: 800
  font-size: 14px
  line-height: 1.3

.feature-body
  margin-top: 4px
  font-size: 13px
  line-height: 1.4
  color: $text-muted
</style>
