import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'
import messages from 'src/i18n'

/** every string of every language compiles, and its placeholders match English */
describe('translations', () => {
    const flat = (o: Record<string, unknown>, prefix = ''): [string, string][] =>
        Object.entries(o).flatMap(([k, v]) => typeof v === 'string' ? [[prefix + k, v] as [string, string]] : flat(v as Record<string, unknown>, `${prefix}${k}.`))
    const en = new Map(flat(messages['en-us'] as Record<string, unknown>))
    const names = (s: string) => [...new Set(s.match(/\{\w+\}/g) || [])].sort().join()

    for (const lang of Object.keys(messages)) {
        it(`${lang} compiles with the same placeholders`, () => {
            const errors: string[] = []
            const i18n = createI18n({ legacy: false, locale: lang, messages, missingWarn: false, fallbackWarn: false, warnHtmlMessage: false })
            for (const [key, value] of flat(messages[lang as keyof typeof messages] as Record<string, unknown>)) {
                try {
                    i18n.global.t(key, { n: 2, name: 'x', amount: '1', symbol: 'VET' }, 2)
                } catch (err) {
                    errors.push(`${key}: ${(err as Error).message}`)
                }
                const base = en.get(key)
                if (base !== undefined && names(base) !== names(value)) errors.push(`${key}: placeholders ${names(value)} vs ${names(base)}`)
            }
            expect(errors).toEqual([])
        })
    }
})
