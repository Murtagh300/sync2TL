import { defineBoot } from '#q-app'
import { createI18n } from 'vue-i18n'
import messages from 'src/i18n'

export const i18n = createI18n({
    // legacy mode keeps this.$t / $tc working in the ported options-API components
    legacy: true,
    locale: 'en-us',
    fallbackLocale: 'en-us',
    messages,
    silentFallbackWarn: true,
    // en-us is complete; other locales may lack a few strings
    missingWarn: false,
    fallbackWarn: false
})

export default defineBoot(({ app }) => {
    app.use(i18n)
})
