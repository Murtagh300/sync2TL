<template>
    <div>
        <!-- the wizard, disclaimer and background notifiers are ported with the pages (phase 4) -->
        <stacked-router-view class="fit" />
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import StackedRouterView from 'components/StackedRouterView.vue'

export default defineComponent({
    name: 'Main',
    components: { StackedRouterView }
})
</script>
