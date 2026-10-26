<template>
    <q-item
        v-bind="$attrs"
    >
        <q-item-section avatar>
            <q-avatar :icon="icon" />
        </q-item-section>
        <q-item-section>
            <q-item-label lines="1">{{title}}</q-item-label>
            <q-item-label
                v-if="caption"
                caption
            >{{caption}}</q-item-label>
        </q-item-section>
        <q-item-section side>
            <span class="text-muted">{{value}}</span>
        </q-item-section>
        <q-item-section side>
            <q-icon
                v-if="!$slots.default"
                name="chevron_right"
                class="text-muted"
            ></q-icon>
            <slot />
        </q-item-section>
    </q-item>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
export default defineComponent({
    props: {
        icon: String,
        title: String,
        value: String,
        caption: String
    }
})
</script>
