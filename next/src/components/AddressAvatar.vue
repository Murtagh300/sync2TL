<template>
    <q-avatar
        v-bind="$attrs"
        class="address-avatar"
    >
        <img
            :src="svg"
            alt=""
        >
        <squad-shades v-if="squad" />
    </q-avatar>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import { picasso } from '@vechain/picasso'
import SquadShades from './SquadShades.vue'
import { holdsSquad, knownHolder } from 'src/utils/squad'
import { genesises } from 'src/consts'

export default defineComponent({
    components: { SquadShades },
    props: {
        addr: String
    },
    data: () => ({
        /** a SQUAD holder wears the squad's sunglasses */
        squad: false
    }),
    computed: {
        svg(): string {
            return this.addr ? `data:image/svg+xml;utf8,${picasso(this.addr.toLowerCase())}` : ''
        }
    },
    watch: {
        addr: {
            handler(a: string | undefined) {
                this.squad = false
                if (!a || !/^0x[0-9a-fA-F]{40}$/.test(a)) return
                const known = knownHolder(a)
                if (known !== undefined) {
                    this.squad = known
                    return
                }
                holdsSquad(this.$svc.bc(genesises.main.id).thor, a)
                    .then(v => { if (this.addr === a) this.squad = v })
                    .catch(() => { })
            },
            immediate: true
        }
    }
})
</script>
<style scoped>
.address-avatar :deep(.q-avatar__content) {
    position: relative;
}
</style>
