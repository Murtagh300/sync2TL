import type { DatabaseSync } from 'node:sqlite'
import type { Subscription } from './store.ts'
import { currentRound } from './rounds.ts'
import { callNode, pad, word } from './node.ts'

/**
 * A push when a VeBetterDAO voting reward can be claimed: once a round has ended, VoterRewards
 * holds what each voter earned in it (and a Galaxy Member bonus). Checked for the addresses of the
 * devices that asked, once per round.
 */

export const VOTER_REWARDS = '0x838a33af756a6366f93e201423e1425f67ec0fa7'
// getReward(uint256,address), getGMReward(uint256,address)
const GET_REWARD = '0x008f33d7'
const GET_GM_REWARD = '0x84d14f34'

const TEXT: Record<string, string> = {
    en: 'Your voting reward for round {n} is ready: {amount} B3TR',
    nl: 'Je stembeloning van ronde {n} staat klaar: {amount} B3TR',
    de: 'Deine Abstimmungsbelohnung für Runde {n} ist bereit: {amount} B3TR',
    fr: 'Votre récompense de vote de la manche {n} est prête : {amount} B3TR',
    zh: '第 {n} 轮投票奖励可领取：{amount} B3TR',
    es: 'Tu recompensa por votar en la ronda {n} está lista: {amount} B3TR',
    it: 'La tua ricompensa di voto del round {n} è pronta: {amount} B3TR',
    ja: 'ラウンド {n} の投票報酬を受け取れます：{amount} B3TR',
    ko: '{n}라운드 투표 보상을 받을 수 있습니다: {amount} B3TR',
    pt: 'Sua recompensa de voto da rodada {n} está pronta: {amount} B3TR',
    tr: '{n}. tur oy ödülünüz hazır: {amount} B3TR',
    vi: 'Phần thưởng bỏ phiếu vòng {n} đã sẵn sàng: {amount} B3TR',
    ru: 'Награда за голосование в раунде {n} готова: {amount} B3TR',
    pl: 'Nagroda za głosowanie w rundzie {n} czeka: {amount} B3TR',
    id: 'Hadiah voting putaran {n} siap diklaim: {amount} B3TR'
}

export function rewardText(lang: string, round: number, amount: string) {
    return (TEXT[lang] || TEXT.en!).replace('{n}', String(round)).replace('{amount}', amount)
}

/** voting plus Galaxy Member reward (wei) of each address in a round */
export async function rewardsIn(node: string, round: number, addresses: string[]): Promise<Map<string, bigint>> {
    const out = new Map<string, bigint>()
    for (let i = 0; i < addresses.length; i += 50) {
        const chunk = addresses.slice(i, i + 50)
        const res = await callNode(node, chunk.flatMap(a => [
            { to: VOTER_REWARDS, data: GET_REWARD + pad(round) + pad(a) },
            { to: VOTER_REWARDS, data: GET_GM_REWARD + pad(round) + pad(a) }
        ]))
        chunk.forEach((a, k) => out.set(a, word(res[k * 2]!) + word(res[k * 2 + 1]!)))
    }
    return out
}

type Sender = (sub: Subscription, payload: string) => Promise<void>
type Reader = (node: string, round: number, addresses: string[]) => Promise<Map<string, bigint>>

export function createRewardWatch(db: DatabaseSync, opts: { nodes: string[], send: Sender, round?: (node: string) => Promise<number>, rewards?: Reader }) {
    const getState = db.prepare('SELECT value FROM state WHERE key = ?')
    const setState = db.prepare('INSERT INTO state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    const listeners = db.prepare('SELECT endpoint, keys, lang, addresses FROM subscriptions WHERE rewards = 1')
    const readRound = opts.round || currentRound
    const readRewards = opts.rewards || rewardsIn
    let n = 0

    /** after a round ends: who of the listeners earned something in it */
    async function tick() {
        const node = opts.nodes[n++ % opts.nodes.length]!
        const ended = (await readRound(node)) - 1
        const last = getState.get('vbd:rewardRound') as { value: string } | undefined
        if (ended < 1 || (last && Number(last.value) >= ended)) return 0
        const rows = listeners.all() as { endpoint: string, keys: string, lang: string, addresses: string }[]
        const all = [...new Set(rows.flatMap(r => JSON.parse(r.addresses) as string[]))]
        const rewards = all.length ? await readRewards(node, ended, all) : new Map<string, bigint>()
        // read once: a failure above tries again next time
        setState.run('vbd:rewardRound', String(ended))
        let sent = 0
        for (const r of rows) {
            const total = (JSON.parse(r.addresses) as string[]).reduce((s, a) => s + (rewards.get(a) || 0n), 0n)
            if (total <= 0n) continue
            const amount = (Number(total / 10n ** 16n) / 100).toLocaleString('en-US', { maximumFractionDigits: 2 })
            const payload = JSON.stringify({ title: rewardText(r.lang, ended, amount), body: 'BlackVault', url: '#/voter-rewards', tag: `reward:${ended}` })
            await opts.send({ endpoint: r.endpoint, keys: JSON.parse(r.keys), lang: r.lang }, payload)
                .then(() => { sent++ }, err => console.warn('[push] reward:', (err as Error).message))
        }
        return sent
    }

    return {
        tick,
        start() {
            setInterval(() => { tick().catch(err => console.warn('[push] reward tick:', (err as Error).message)) }, 15 * 60 * 1000).unref()
            tick().catch(() => { })
        }
    }
}
