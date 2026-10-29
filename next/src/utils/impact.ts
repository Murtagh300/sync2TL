/**
 * What your X2Earn actions did: each reward's proof (VeBetterDAO's proof format, version 2) carries
 * an "impact" object, in the units VeBetterDAO's impact codes set: carbon, plastic, waste and
 * timber in grams, water in millilitres, energy in watt-hours, education in seconds.
 */

export const IMPACT_KEYS = ['carbon', 'water', 'plastic', 'energy', 'waste_mass', 'timber', 'trees_planted', 'clean_energy_production_wh', 'calories_burned', 'education_time'] as const
export type ImpactKey = typeof IMPACT_KEYS[number]
export type Impact = Partial<Record<ImpactKey, number>>

/** the impact in one proof; nothing when there is none or it isn't readable */
export function proofImpact(proof: string): Impact {
    try {
        const p = JSON.parse(proof) as { impact?: Record<string, unknown> }
        const out: Impact = {}
        for (const k of IMPACT_KEYS) {
            const v = Number(p.impact?.[k])
            // an app's own number, bounded: one action doesn't save a power plant
            if (Number.isFinite(v) && v > 0 && v < 1e9) out[k] = v
        }
        return out
    } catch {
        return {}
    }
}

export function addImpact(proofs: string[]): { total: Impact, actions: number } {
    const total: Impact = {}
    let actions = 0
    for (const p of proofs) {
        const i = proofImpact(p)
        if (Object.keys(i).length) actions++
        for (const [k, v] of Object.entries(i) as [ImpactKey, number][]) total[k] = (total[k] || 0) + v
    }
    return { total, actions }
}

/** a value in a unit people read: grams to kilograms, millilitres to litres, Wh to kWh */
export function impactShown(key: ImpactKey, v: number): { value: number, unit: string } {
    switch (key) {
        case 'carbon':
        case 'plastic':
        case 'waste_mass':
        case 'timber':
            return v >= 1000 ? { value: v / 1000, unit: 'kg' } : { value: v, unit: 'g' }
        case 'water':
            return v >= 1000 ? { value: v / 1000, unit: 'L' } : { value: v, unit: 'mL' }
        case 'energy':
        case 'clean_energy_production_wh':
            return v >= 1000 ? { value: v / 1000, unit: 'kWh' } : { value: v, unit: 'Wh' }
        case 'calories_burned':
            return { value: v, unit: 'kcal' }
        case 'education_time':
            return v >= 3600 ? { value: v / 3600, unit: 'h' } : { value: v / 60, unit: 'min' }
        default:
            return { value: v, unit: '' }
    }
}
