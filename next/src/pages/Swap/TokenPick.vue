<template>
    <q-btn
        outline
        no-caps
        rounded
        class="token-pick"
        @click="open = true"
    >
        <token-avatar
            v-if="current"
            :spec="current"
            size="22px"
            class="q-mr-sm"
        />
        <span class="text-weight-bold">{{modelValue}}</span>
        <q-icon
            name="expand_more"
            size="18px"
            class="q-ml-xs"
        />
        <q-dialog
            v-model="open"
            :position="$q.screen.xs ? 'bottom' : 'standard'"
        >
            <q-card class="full-width">
                <prompt-dialog-toolbar>{{$t('swap.title_pick')}}</prompt-dialog-toolbar>
                <q-card-section class="q-pt-none">
                    <q-input
                        v-model="search"
                        dense
                        outlined
                        autofocus
                        clearable
                        :placeholder="$t('tokens.label_search')"
                    >
                        <template #prepend>
                            <q-icon name="o_search" />
                        </template>
                    </q-input>
                </q-card-section>
                <q-list class="pick-list">
                    <q-item
                        v-for="t in shown"
                        :key="t.symbol"
                        v-close-popup
                        clickable
                        :active="t.symbol === modelValue"
                        @click="$emit('update:modelValue', t.symbol)"
                    >
                        <q-item-section avatar>
                            <token-avatar
                                :spec="t"
                                size="30px"
                            />
                        </q-item-section>
                        <q-item-section>
                            <q-item-label>{{t.symbol}}</q-item-label>
                            <q-item-label caption>{{t.name}}</q-item-label>
                        </q-item-section>
                    </q-item>
                </q-list>
            </q-card>
        </q-dialog>
    </q-btn>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import TokenAvatar from 'components/TokenAvatar.vue'
import PromptDialogToolbar from 'components/PromptDialogToolbar.vue'

// a token by symbol, chosen from a searchable list
export default defineComponent({
    components: { TokenAvatar, PromptDialogToolbar },
    props: {
        modelValue: { type: String, required: true },
        tokens: { type: Array as () => M.TokenSpec[], default: () => [] }
    },
    emits: ['update:modelValue'],
    data: () => ({
        open: false,
        search: '' as string | null
    }),
    computed: {
        current(): M.TokenSpec | undefined {
            return this.tokens.find(t => t.symbol === this.modelValue)
        },
        shown(): M.TokenSpec[] {
            const q = (this.search || '').trim().toLowerCase()
            const list = q ? this.tokens.filter(t => t.symbol.toLowerCase().includes(q) || t.name.toLowerCase().includes(q)) : this.tokens
            return list.slice(0, 80)
        }
    }
})
</script>
<style lang="sass" scoped>
.token-pick
  flex: none
  padding: 4px 10px

.pick-list
  max-height: 60vh
  overflow-y: auto
  padding-bottom: 8px
</style>
