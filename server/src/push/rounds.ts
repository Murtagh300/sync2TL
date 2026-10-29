import type { DatabaseSync } from 'node:sqlite'
import type { Subscription } from './store.ts'

/**
 * A push when VeBetterDAO's weekly allocation round starts, to the devices that asked: the round
 * is read from XAllocationVoting every few minutes, and a new id is news once.
 */

export const X_ALLOCATION_VOTING = '0x89a00bb0947a30ff95beef77a66aede3842fe5b7'
// currentRoundId()
const CURRENT_ROUND = '0x9cbe5efd'

const TEXT: Record<string, string> = {
    en: 'VeBetterDAO round {n} has started: your vote counts',
    nl: 'VeBetterDAO-ronde {n} is begonnen: je stem telt',
    de: 'VeBetterDAO-Runde {n} hat begonnen: deine Stimme zählt',
    fr: 'La manche VeBetterDAO {n} a commencé : votre vote compte',
    zh: 'VeBetterDAO 第 {n} 轮已开始：快来投票',
    es: 'Ha empezado la ronda {n} de VeBetterDAO: tu voto cuenta',
    it: 'È iniziato il round {n} di VeBetterDAO: il tuo voto conta',
    ja: 'VeBetterDAO ラウンド {n} が始まりました。投票しましょう',
    ko: 'VeBetterDAO {n}라운드가 시작됐습니다. 투표하세요',
    pt: 'A rodada {n} da VeBetterDAO começou: seu voto conta',
    tr: 'VeBetterDAO {n}. turu başladı: oyunuz önemli',
    vi: 'Vòng {n} của VeBetterDAO đã bắt đầu: phiếu của bạn có giá trị',
    ru: 'Раунд {n} VeBetterDAO начался: ваш голос важен',
    pl: 'Runda {n} VeBetterDAO się zaczęła: Twój głos się liczy',
    id: 'Putaran {n} VeBetterDAO telah dimulai: suara Anda berarti'
}

export function roundText(lang: string, round: number) {
    return (TEXT[lang] || TEXT.en!).replace('{n}', String(round))
}

export async function currentRound(node: string): Promise<number> {
    const r = await fetch(`${node.replace(/\/$/, '')}/accounts/*`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ clauses: [{ to: X_ALLOCATION_VOTING, value: '0x0', data: CURRENT_ROUND }] }),
        signal: AbortSignal.timeout(15000)
    })
    if (!r.ok) throw new Error(`node ${r.status}`)
    const [out] = await r.json() as { data: string, reverted: boolean }[]
    if (!out || out.reverted) throw new Error('reverted')
    return Number(BigInt(out.data))
}

type Sender = (sub: Subscription, payload: string) => Promise<void>

export function createRoundWatch(db: DatabaseSync, opts: { nodes: string[], send: Sender, round?: (node: string) => Promise<number> }) {
    const getState = db.prepare('SELECT value FROM state WHERE key = ?')
    const setState = db.prepare('INSERT INTO state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    const listeners = db.prepare('SELECT endpoint, keys, lang FROM subscriptions WHERE rounds = 1')
    const read = opts.round || currentRound
    let n = 0

    async function tick() {
        const node = opts.nodes[n++ % opts.nodes.length]!
        const round = await read(node)
        const last = getState.get('vbd:round') as { value: string } | undefined
        setState.run('vbd:round', String(round))
        // the first reading only sets where we are
        if (!last || round <= Number(last.value)) return 0
        let sent = 0
        for (const r of listeners.all() as { endpoint: string, keys: string, lang: string }[]) {
            const sub = { endpoint: r.endpoint, keys: JSON.parse(r.keys), lang: r.lang }
            const payload = JSON.stringify({ title: roundText(r.lang, round), body: 'BlackVault', url: '#/vote', tag: `round:${round}` })
            await opts.send(sub, payload).then(() => { sent++ }, err => console.warn('[push] round:', (err as Error).message))
        }
        return sent
    }

    return {
        tick,
        start() {
            const timer = setInterval(() => { tick().catch(err => console.warn('[push] round tick:', (err as Error).message)) }, 5 * 60 * 1000)
            timer.unref()
            tick().catch(() => { })
        }
    }
}
