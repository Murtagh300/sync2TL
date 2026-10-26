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
        <div class="row q-gutter-xs q-mt-sm">
            <q-chip
                v-for="l in labelOptions"
                :key="l"
                clickable
                dense
                :outline="!note.labels.includes(l)"
                :color="note.labels.includes(l) ? 'primary' : undefined"
                :text-color="note.labels.includes(l) ? 'dark' : undefined"
                :aria-pressed="note.labels.includes(l)"
                class="q-ma-none q-mr-xs"
                @click="toggleLabel(l)"
            >{{l}}</q-chip>
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
</style>
