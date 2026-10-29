import { IMPACT_KEYS, type Impact, type ImpactKey } from './impact'

/**
 * A goal for the year ("save 50 kg CO₂"), in the unit people read; progress is what the X2Earn
 * proofs of the year say (utils/impact.ts). Kept on this device.
 */

export type ImpactGoal = { key: ImpactKey, target: number, year: number }

const KEY = 'bv-impact-goal'

/** what a goal's number counts in: kilograms for masses, litres, kWh, hours */
export const GOAL_UNIT: Partial<Record<ImpactKey, { unit: string, factor: number }>> = {
    carbon: { unit: 'kg', factor: 1000 },
    plastic: { unit: 'kg', factor: 1000 },
    waste_mass: { unit: 'kg', factor: 1000 },
    timber: { unit: 'kg', factor: 1000 },
    water: { unit: 'L', factor: 1000 },
    energy: { unit: 'kWh', factor: 1000 },
    clean_energy_production_wh: { unit: 'kWh', factor: 1000 },
    trees_planted: { unit: '', factor: 1 },
    calories_burned: { unit: 'kcal', factor: 1 },
    education_time: { unit: 'h', factor: 3600 }
}

export function loadGoal(): ImpactGoal | null {
    try {
        const g = JSON.parse(localStorage.getItem(KEY) || 'null') as ImpactGoal | null
        return g && (IMPACT_KEYS as readonly string[]).includes(g.key) && g.target > 0 ? g : null
    } catch {
        return null
    }
}

export function saveGoal(g: ImpactGoal | null) {
    try {
        if (g) localStorage.setItem(KEY, JSON.stringify(g))
        else localStorage.removeItem(KEY)
    } catch { }
}

/** how far the year's impact is, in the goal's unit, and the share done (0..1) */
export function goalProgress(goal: ImpactGoal, total: Impact): { done: number, share: number } {
    const f = GOAL_UNIT[goal.key]?.factor || 1
    const done = (total[goal.key] || 0) / f
    return { done, share: Math.min(1, goal.target > 0 ? done / goal.target : 0) }
}

/** on track: the share of the year gone by against the share done */
export function onTrack(share: number, now = new Date()): boolean {
    const start = new Date(now.getFullYear(), 0, 1).getTime()
    const end = new Date(now.getFullYear() + 1, 0, 1).getTime()
    return share >= (now.getTime() - start) / (end - start)
}
