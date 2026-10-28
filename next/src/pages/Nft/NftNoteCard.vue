<template>
    <!-- a private note and labels, kept on this device -->
    <div class="bvm-tile q-pa-md nft-note">
        <div class="row items-center q-mb-sm">
            <q-icon
                name="o_sticky_note_2"
                size="18px"
                color="primary"
                class="q-mr-xs"
            />
            <span class="text-weight-bold">{{$t('nftNotes.title')}}</span>
            <q-space />
            <span class="text-caption text-muted">{{$t('nftNotes.hint')}}</span>
        </div>
        <q-input
            v-model="note.note"
            dense
            outlined
            autogrow
            maxlength="280"
            :placeholder="$t('nftNotes.placeholder')"
            @blur="save()"
        />
        <!-- labels as roomy toggles: a check when on -->
        <div class="note-labels q-mt-sm">
            <button
                v-for="l in labelOptions"
                :key="l"
                type="button"
                class="note-label"
                :class="{ 'note-label--on': note.labels.includes(l) }"
                :aria-pressed="note.labels.includes(l)"
                @click="toggleLabel(l)"
            >
                <q-icon
                    v-if="note.labels.includes(l)"
                    name="check"
                    size="14px"
                />{{l}}
            </button>
        </div>
    </div>
</template>
<script lang="ts">
import { defineComponent, type PropType } from 'vue'
import { loadNotes, noteOf, saveNote, SUGGESTED_LABELS, type NftNote } from 'src/utils/nft-notes'

type Ref = { contract: string, tokenId: string }

export default defineComponent({
    props: {
        nft: { type: Object as PropType<Ref>, required: true }
    },
    data: () => ({
        note: { note: '', labels: [] } as NftNote
    }),
    computed: {
        /** the suggested labels and the ones this NFT has */
        labelOptions(): string[] {
            return [...new Set([...SUGGESTED_LABELS.map(l => this.$t(`nftNotes.label_${l}`)), ...this.note.labels])]
        }
    },
    watch: {
        nft: {
            immediate: true,
            async handler(nft: Ref) {
                const n = noteOf(await loadNotes(this.$svc), nft)
                // a newer NFT may be shown by now
                if (nft !== this.nft) return
                this.note = n ? { note: n.note, labels: [...n.labels] } : { note: '', labels: [] }
            }
        }
    },
    methods: {
        async save() {
            await saveNote(this.$svc, this.nft, this.note)
        },
        toggleLabel(l: string) {
            this.note.labels = this.note.labels.includes(l) ? this.note.labels.filter(x => x !== l) : [...this.note.labels, l]
            void this.save()
        }
    }
})
</script>
<style lang="sass" scoped>
.nft-note :deep(.q-field__native)
  font-size: 14px

.note-labels
  display: flex
  flex-wrap: wrap
  gap: 8px

.note-label
  display: inline-flex
  align-items: center
  gap: 4px
  min-height: 34px
  padding: 0 14px
  border-radius: 999px
  border: 1px solid $hairline-2
  background: rgba(255, 255, 255, 0.03)
  color: $text-soft
  font: inherit
  font-size: 13px
  font-weight: 700
  cursor: pointer
  &:hover
    border-color: rgba(255, 255, 255, 0.28)

.note-label--on
  border-color: var(--q-primary)
  background: color-mix(in srgb, var(--q-primary) 14%, transparent)
  color: var(--q-primary)
</style>
