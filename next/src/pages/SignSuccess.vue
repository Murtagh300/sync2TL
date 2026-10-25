<template>
    <div class="column fit no-wrap">
        <page-toolbar :title="$t('sign.title_success')" />
        <page-content
            class="q-my-auto text-center"
            padding
        >
            <div class="success-mark flex flex-center q-mx-auto q-mb-lg">
                <q-icon
                    size="40px"
                    name="o_check"
                    color="primary"
                />
            </div>
            <h1 class="bvm-display success-title q-my-none">{{ $t('sign.msg_signed', { content_type: typeText.toLowerCase() }) }}</h1>
        </page-content>
        <page-action>
            <q-btn
                outline
                color="primary"
                :to="{name:'activities'}"
                :label="$t('sign.action_view_activities')"
            />
            <q-btn
                unelevated
                color="primary"
                @click="close()"
                :label="$t('common.close')"
            />
        </page-action>
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import PageToolbar from 'components/PageToolbar.vue'
import PageContent from 'src/components/PageContent.vue'
import PageAction from 'src/components/PageAction.vue'

export default defineComponent({
    components: { PageToolbar, PageContent, PageAction },
    props: {
        type: String as () => 'tx' | 'cert'
    },
    computed: {
        typeText(): string {
            switch (this.type) {
                case 'tx':
                    return this.$t('common.transaction')
                case 'cert':
                    return this.$t('common.certificate')
                default:
                    return '??'
            }
        }
    },
    methods: {
        close() {
            this.$backOrHome()
        }
    }
})
</script>
<style lang="sass" scoped>
.success-mark
  width: 76px
  height: 76px
  border-radius: 20px
  border: 1px solid color-mix(in srgb, var(--q-primary) 35%, transparent)
  background: color-mix(in srgb, var(--q-primary) 08%, transparent)

.success-title
  font-size: 30px
</style>
