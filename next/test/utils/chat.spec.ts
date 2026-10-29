import { describe, expect, it } from 'vitest'
import { conversations, type ChatLine } from 'src/utils/chat'

const ME = '0x' + 'a'.repeat(40)
const B = '0x' + 'b'.repeat(40)
const C = '0x' + 'c'.repeat(40)
const line = (id: number, from: string, to: string): ChatLine => ({ id, from, to, at: id * 1000, text: `m${id}` })

describe('conversations', () => {
    it('groups by the other side, newest first, and counts unread', () => {
        const list = conversations([line(1, B, ME), line(2, ME, B), line(3, C, ME), line(4, B, ME)], ME, { [B]: 1 })
        expect(list.map(c => [c.with, c.last.id, c.unread])).toEqual([[B, 4, 1], [C, 3, 1]])
    })
})
