<template>
    <div>
        <slot :displayName="displayName(configLang || '')" />
        <pop-sheets
            v-bind="$attrs"
            :sheets="sheets"
        />
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import PopSheets, { Sheet } from 'src/components/PopSheets.vue'

// maps lang to lang's localized display name
const displayNames: Record<string, string> = {
    'en-us': 'English (U.S.)',
    'zh-cn': '中文 (中国)',
    'nl-nl': 'Nederlands',
    'de-de': 'Deutsch',
    'fr-fr': 'Français',
    'es-es': 'Español',
    'it-it': 'Italiano',
    'ja-jp': '日本語',
    'ko-kr': '한국어',
    'pt-br': 'Português (Brasil)',
    'tr-tr': 'Türkçe',
    'vi-vn': 'Tiếng Việt',
    'ru-ru': 'Русский',
    'pl-pl': 'Polski',
    'id-id': 'Bahasa Indonesia'
}

export default defineComponent({
    components: { PopSheets },
    computed: {
        sheets(): Sheet[] {
            // empty lang means auto
            return ['', ...this.$i18n.availableLocales]
                .map<Sheet>(lang => {
                    return {
                        label: this.displayName(lang) + (this.configLang === lang ? ' ✓' : ''),
                        action: () => { this.$svc.config.saveLanguage(lang) }
                    }
                })
        }
    },
    data: () => ({
        // async computed (see src/shims-async-computed.d.ts)
        configLang: null as string | null
    }),
    asyncComputed: {
        configLang() {
            return this.$svc.config.getLanguage()
        }
    },
    methods: {
        displayName(lang: string): string {
            if (!lang) {
                // the language it picked, so "auto" says what you get: "Nederlands (automatisch)"
                return this.$t('common.lang_auto_as', { lang: this.displayName(this.$i18n.locale) })
            }
            const name = displayNames[lang]
            if (name) {
                return name
            }
            try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const ns = new (Intl as any).DisplayNames([lang], { type: 'language' })
                return ns.of(lang)
            } catch {
                return lang
            }
        }
    }
})
</script>
