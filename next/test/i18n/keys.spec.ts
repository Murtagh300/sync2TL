import { describe, expect, it } from 'vitest'
import enUS from 'src/i18n/en-us'
import nlNL from 'src/i18n/nl-nl'
import deDE from 'src/i18n/de-de'
import frFR from 'src/i18n/fr-fr'

type Tree = { [k: string]: string | Tree }

/** every key path of a message tree */
function keys(t: Tree, prefix = ''): string[] {
    return Object.entries(t).flatMap(([k, v]) => typeof v === 'string' ? [prefix + k] : keys(v, `${prefix}${k}.`))
}

/** the {placeholders} in a message */
const params = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort()

const get = (t: Tree, path: string) => path.split('.').reduce<string | Tree>((o, k) => (o as Tree)[k]!, t) as string

// complete translations (zh-cn may lack a few strings: English fills in)
for (const [name, messages] of Object.entries({ Dutch: nlNL, German: deDE, French: frFR })) {
    describe(`the ${name} translation`, () => {
        it('has every English key, and no others', () => {
            expect(keys(messages as Tree).sort()).toEqual(keys(enUS as Tree).sort())
        })

        it('keeps the placeholders of each message', () => {
            for (const k of keys(enUS as Tree)) {
                expect([k, params(get(messages as Tree, k))]).toEqual([k, params(get(enUS as Tree, k))])
            }
        })
    })
}
