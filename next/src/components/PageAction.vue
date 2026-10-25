<template>
    <div class="q-pa-md">
        <div class="bar narrow-page q-mx-auto row justify-around">
            <slot />
        </div>
    </div>
</template>
<style scoped>
.bar > * {
    width: 42%;
}
/* a single action takes the whole row */
.bar > *:only-child {
    width: 100%;
}
</style>
