<template>
    <q-dialog
        ref="dialog"
        :position="$q.screen.xs ? 'bottom' : 'standard'"
        @hide="$emit('hide')"
    >
        <q-card class="full-width picker">
            <prompt-dialog-toolbar>{{$t('watchlist.title_pick')}}</prompt-dialog-toolbar>
            <q-card-section class="q-pt-none">
                <q-input
                    v-model="search"
                    dense
                    outlined
                    autofocus
                    clearable
                    :placeholder="$t('watchlist.label_search')"
                >
                    <template #prepend>
                        <q-icon name="o_search" />
                    </template>
                </q-input>
            </q-card-section>
            <div class="picker-list">
                <div
                    v-if="loading"
                    class="row justify-center q-pa-lg"
                >
                    <bv-loader size="28px" />
                </div>
                <q-list v-else>
                    <q-item
                        v-for="c in shown"
                        :key="c.slug"
                        clickable
                        :disable="exclude.includes(c.slug)"
                        @click="pick(c)"
                    >
                        <q-item-section avatar>
                            <q-avatar rounded>
                                <img :src="c.coverImage">
                            </q-avatar>
                        </q-item-section>
                        <q-item-section>
                            <q-item-label lines="1">{{c.name}}</q-item-label>
                            <q-item-label
                                v-if="c.floorValue"
                                caption
                            >{{$t('market.label_floor')}} {{c.floorValue}} {{c.floorCurrency}}</q-item-label>
                        </q-item-section>
                        <q-item-section
                            v-if="exclude.includes(c.slug)"
                            side
                        >
                            <q-icon
                                name="check"
                                color="primary"
                            />
                        </q-item-section>
                    </q-item>
                </q-list>
            </div>
        </q-card>
    </q-dialog>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import { QDialog } from 'quasar'
import PromptDialogToolbar from 'src/components/PromptDialogToolbar.vue'
import type { BVM } from 'boot/services/bvm'

// choose a BlackVeMarket collection
export default defineComponent({
    // the Dialog plugin listens to these
    emits: ['ok', 'hide'],
    components: { PromptDialogToolbar },
    props: {
        exclude: { type: Array as () => string[], default: () => [] }
    },
    data: () => ({
        search: '' as string | null,
        loading: true,
        collections: [] as BVM.Collection[]
    }),
    computed: {
        shown(): BVM.Collection[] {
            const q = (this.search || '').trim().toLowerCase()
            return q ? this.collections.filter(c => c.name.toLowerCase().includes(q)) : this.collections
        }
    },
    async created() {
        try {
            const all = await this.$svc.bvm.collections()
            this.collections = Object.values(all).sort((a, b) => a.name.localeCompare(b.name))
        } catch {
            this.collections = []
        } finally {
            this.loading = false
        }
    },
    methods: {
        // method is REQUIRED by $q.dialog
        show() { (this.$refs.dialog as QDialog).show() },
        // method is REQUIRED by $q.dialog
        hide() { (this.$refs.dialog as QDialog).hide() },
        pick(c: BVM.Collection) {
            this.$emit('ok', c)
            this.hide()
        }
    }
})
</script>
<style lang="sass" scoped>
.picker-list
  max-height: 60vh
  overflow-y: auto
  padding-bottom: 8px
</style>
