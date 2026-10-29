<template>
    <svg
        class="squad-shades"
        viewBox="0 0 100 34"
        aria-hidden="true"
    >
        <!-- the Squirtle Squad's shades: two pointed lenses on a straight bar -->
        <path
            class="frame"
            d="M2 6 H98 L96 10 H90 L84 27 Q82 31 77 31 H62 Q57 31 56 26 L53 14 Q50 11 47 14 L44 26 Q43 31 38 31 H23 Q18 31 16 27 L10 10 H4 Z"
        />
        <path
            class="lens"
            d="M14 10 H46 L41 25 Q40 27 37 27 H24 Q21 27 20 25 Z"
        />
        <path
            class="lens"
            d="M54 10 H86 L80 25 Q79 27 76 27 H63 Q60 27 59 25 Z"
        />
        <!-- a glint on each lens -->
        <path
            class="glint"
            d="M19 12 H25 L22 18 H17 Z"
        />
        <path
            class="glint"
            d="M59 12 H65 L62 18 H57 Z"
        />
    </svg>
</template>
<style scoped>
.squad-shades {
    position: absolute;
    left: 7%;
    top: 30%;
    width: 86%;
    height: auto;
    pointer-events: none;
    filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.45));
}

.frame {
    fill: #0b0d0c;
}

.lens {
    fill: #1d2421;
}

.glint {
    fill: rgba(255, 255, 255, 0.55);
}
</style>
