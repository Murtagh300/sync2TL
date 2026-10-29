import { describe, expect, it } from 'vitest'
import { addImpact, impactShown, proofImpact } from 'src/utils/impact'
import { GOVERNOR, proposalVoteClause, STATES } from 'src/utils/governance'

describe('impact from proofs', () => {
    // as X2Earn apps write them (seen on mainnet)
    const proofs = [
        '{"version": 2,"description": "Bubbles Refill Submission","proof": {"image":"https://x/y.webp"},"impact": {"carbon":70,"plastic":0,"waste_mass":0}}',
        '{"version": 2,"description": "daily:quick-drop","proof": {},"impact": {"carbon":5,"water":1,"energy":30,"waste_mass":25,"plastic":15,"trees_planted":0}}',
        '{"version": 2,"description": "purchase","impact": {"carbon":14300}}',
        'not json',
        '{"version": 2,"description": "no impact"}',
        '{"impact": {"carbon": -5, "water": "lots", "energy": 1e12}}'
    ]

    it('adds up what the apps state, and counts the actions that state any', () => {
        const { total, actions } = addImpact(proofs)
        expect(actions).toBe(3)
        expect(total).toEqual({ carbon: 14375, plastic: 15, waste_mass: 25, water: 1, energy: 30 })
        expect(proofImpact('nope')).toEqual({})
    })

    it('shows grams as kilograms and so on', () => {
        expect(impactShown('carbon', 14375)).toEqual({ value: 14.375, unit: 'kg' })
        expect(impactShown('water', 500)).toEqual({ value: 500, unit: 'mL' })
        expect(impactShown('energy', 2500)).toEqual({ value: 2.5, unit: 'kWh' })
        expect(impactShown('education_time', 5400)).toEqual({ value: 1.5, unit: 'h' })
    })
})

describe('governance', () => {
    it('votes with a reason, support as the governor counts it', () => {
        const c = proposalVoteClause('12345', 'abstain', 'x')
        expect(c.to).toBe(GOVERNOR)
        // castVoteWithReason(uint256,uint8,string)
        expect(c.data.slice(0, 10)).toBe('0x7b3c71d3')
        expect(BigInt('0x' + c.data.slice(10, 74))).toBe(12345n)
        expect(BigInt('0x' + c.data.slice(74, 138))).toBe(2n)
        expect(STATES[8]).toBe('development')
    })
})
