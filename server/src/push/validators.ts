import type { DatabaseSync } from 'node:sqlite'
import type { Subscription } from './store.ts'
import { callNode, pad, word } from './node.ts'

/**
 * A push when a validator a device's StarGate NFTs are with goes offline (its delegators earn
 * nothing meanwhile), comes back, or is leaving (the NFTs need a new one). Read from the Staker
 * built-in contract every ten minutes; a validator's first reading only sets where it is.
 */

export const STAKER = '0x00000000000000000000000000005374616b6572'
// getValidation(address), getValidationPeriodDetails(address)
const GET_VALIDATION = '0x27cd4de1'
const GET_PERIOD = '0x1a9e215a'
const NONE = 4294967295n

export type ValidatorState = 'online' | 'offline' | 'exiting'

const TEXT: Record<ValidatorState, Record<string, string>> = {
    offline: {
        en: 'Your validator {v} is offline: your NFT earns nothing while it is',
        nl: 'Je validator {v} is offline: je NFT verdient intussen niets',
        de: 'Dein Validator {v} ist offline: dein NFT verdient solange nichts',
        fr: 'Votre validateur {v} est hors ligne : votre NFT ne rapporte rien pendant ce temps',
        zh: '你的验证节点 {v} 已离线：期间你的 NFT 没有收益',
        es: 'Tu validador {v} está desconectado: tu NFT no gana nada mientras tanto',
        it: 'Il tuo validatore {v} è offline: nel frattempo il tuo NFT non guadagna',
        ja: 'バリデーター {v} がオフラインです。その間 NFT の報酬はありません',
        ko: '검증인 {v}이(가) 오프라인입니다. 그동안 NFT 보상이 없습니다',
        pt: 'Seu validador {v} está offline: seu NFT não rende nada enquanto isso',
        tr: 'Doğrulayıcınız {v} çevrimdışı: bu sırada NFT\'niz kazanmıyor',
        vi: 'Validator {v} của bạn đang ngoại tuyến: NFT của bạn tạm không có thưởng',
        ru: 'Ваш валидатор {v} офлайн: пока он недоступен, NFT ничего не приносит',
        pl: 'Twój walidator {v} jest offline: w tym czasie Twój NFT nic nie zarabia',
        id: 'Validator Anda {v} sedang offline: NFT Anda tidak menghasilkan apa pun selama itu'
    },
    online: {
        en: 'Your validator {v} is back online',
        nl: 'Je validator {v} is weer online',
        de: 'Dein Validator {v} ist wieder online',
        fr: 'Votre validateur {v} est de nouveau en ligne',
        zh: '你的验证节点 {v} 已恢复在线',
        es: 'Tu validador {v} vuelve a estar en línea',
        it: 'Il tuo validatore {v} è di nuovo online',
        ja: 'バリデーター {v} がオンラインに戻りました',
        ko: '검증인 {v}이(가) 다시 온라인입니다',
        pt: 'Seu validador {v} voltou a ficar online',
        tr: 'Doğrulayıcınız {v} yeniden çevrimiçi',
        vi: 'Validator {v} của bạn đã trực tuyến trở lại',
        ru: 'Ваш валидатор {v} снова онлайн',
        pl: 'Twój walidator {v} znów jest online',
        id: 'Validator Anda {v} kembali online'
    },
    exiting: {
        en: 'Your validator {v} is leaving: move your NFT to another one',
        nl: 'Je validator {v} stopt: zet je NFT bij een andere',
        de: 'Dein Validator {v} hört auf: zieh dein NFT zu einem anderen um',
        fr: 'Votre validateur {v} s\'arrête : confiez votre NFT à un autre',
        zh: '你的验证节点 {v} 即将退出：请把 NFT 委托给其他节点',
        es: 'Tu validador {v} se retira: pasa tu NFT a otro',
        it: 'Il tuo validatore {v} si ritira: sposta il tuo NFT su un altro',
        ja: 'バリデーター {v} が退出します。NFT を別のバリデーターに移してください',
        ko: '검증인 {v}이(가) 종료됩니다. NFT를 다른 검증인으로 옮기세요',
        pt: 'Seu validador {v} vai sair: passe seu NFT para outro',
        tr: 'Doğrulayıcınız {v} ayrılıyor: NFT\'nizi başka birine taşıyın',
        vi: 'Validator {v} của bạn sắp dừng: hãy chuyển NFT sang validator khác',
        ru: 'Ваш валидатор {v} уходит: перенесите NFT к другому',
        pl: 'Twój walidator {v} kończy działanie: przenieś NFT do innego',
        id: 'Validator Anda {v} akan berhenti: pindahkan NFT Anda ke validator lain'
    }
}

export function validatorText(state: ValidatorState, lang: string, validator: string) {
    const v = `${validator.slice(0, 6)}…${validator.slice(-4)}`
    return (TEXT[state][lang] || TEXT[state].en!).replace('{v}', v)
}

/** where each validator stands now */
export async function validatorStates(node: string, validators: string[]): Promise<Map<string, ValidatorState>> {
    const out = new Map<string, ValidatorState>()
    for (let i = 0; i < validators.length; i += 40) {
        const chunk = validators.slice(i, i + 40)
        const res = await callNode(node, chunk.flatMap(v => [
            { to: STAKER, data: GET_VALIDATION + pad(v) },
            { to: STAKER, data: GET_PERIOD + pad(v) }
        ]))
        chunk.forEach((v, k) => {
            const val = res[k * 2] ?? null
            if (!val) return
            // status 3: exited; an exit block set: leaving at the end of its period
            const status = word(val, 4)
            // status 0: no such validator
            if (status === 0n) return
            const exitBlock = word(res[k * 2 + 1] ?? null, 2)
            if (status === 3n || (exitBlock !== 0n && exitBlock !== NONE)) out.set(v, 'exiting')
            else out.set(v, word(val, 5) === NONE ? 'online' : 'offline')
        })
    }
    return out
}

type Sender = (sub: Subscription, payload: string) => Promise<void>

export function createValidatorWatch(db: DatabaseSync, opts: { nodes: string[], send: Sender, states?: typeof validatorStates }) {
    const getState = db.prepare('SELECT value FROM state WHERE key = ?')
    const setState = db.prepare('INSERT INTO state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    const watched = db.prepare('SELECT DISTINCT validator FROM push_validators')
    const listeners = db.prepare('SELECT s.endpoint, s.keys, s.lang FROM push_validators p JOIN subscriptions s ON s.endpoint = p.endpoint WHERE p.validator = ?')
    const read = opts.states || validatorStates
    let n = 0

    async function tick() {
        const node = opts.nodes[n++ % opts.nodes.length]!
        const list = (watched.all() as { validator: string }[]).map(r => r.validator)
        if (!list.length) return 0
        const now = await read(node, list)
        let sent = 0
        for (const [v, state] of now) {
            const key = `val:${v}`
            const before = (getState.get(key) as { value: string } | undefined)?.value
            setState.run(key, state)
            // first reading, or nothing new; and "online" is only news after being offline
            if (!before || before === state || (state === 'online' && before !== 'offline')) continue
            for (const r of listeners.all(v) as { endpoint: string, keys: string, lang: string }[]) {
                const payload = JSON.stringify({ title: validatorText(state, r.lang, v), body: 'BlackVault', url: '#/stargate', tag: `validator:${v}` })
                await opts.send({ endpoint: r.endpoint, keys: JSON.parse(r.keys), lang: r.lang }, payload)
                    .then(() => { sent++ }, err => console.warn('[push] validator:', (err as Error).message))
            }
        }
        return sent
    }

    return {
        tick,
        start() {
            setInterval(() => { tick().catch(err => console.warn('[push] validator tick:', (err as Error).message)) }, 10 * 60 * 1000).unref()
            tick().catch(() => { })
        }
    }
}
