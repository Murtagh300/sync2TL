import type { BVM } from 'boot/services/bvm'

/**
 * Coming mints on the launchpad, as a calendar: each phase that starts later, with a
 * reminder in the app (checked with the other alerts) and an .ics file for any calendar.
 */

export type LaunchEvent = { id: string, slug: string, name: string, phase: string, start: number, end: number | null }

const KEY = 'bv-launch-reminders'

/** phases that start in the future, soonest first */
export function upcomingPhases(launches: BVM.Launch[], now = Date.now()): LaunchEvent[] {
    const out: LaunchEvent[] = []
    for (const l of launches) {
        for (const p of l.phases || []) {
            const start = p.start ? Date.parse(p.start) : NaN
            if (!isFinite(start) || start <= now) continue
            const end = p.end ? Date.parse(p.end) : NaN
            out.push({ id: `${l.slug}:${p.index}`, slug: l.slug, name: l.name, phase: p.label, start, end: isFinite(end) ? end : null })
        }
    }
    return out.sort((a, b) => a.start - b.start)
}

export function reminders(): LaunchEvent[] {
    try {
        return JSON.parse(localStorage.getItem(KEY) || '[]') as LaunchEvent[]
    } catch {
        return []
    }
}

function save(list: LaunchEvent[]) {
    try {
        localStorage.setItem(KEY, JSON.stringify(list))
    } catch { }
}

export function hasReminder(id: string) {
    return reminders().some(r => r.id === id)
}

export function toggleReminder(e: LaunchEvent): boolean {
    const list = reminders()
    const on = !list.some(r => r.id === e.id)
    save(on ? [...list, e] : list.filter(r => r.id !== e.id))
    return on
}

/** reminders that start within the next 15 minutes (or started a little ago); they fire once */
export function dueReminders(now = Date.now()): LaunchEvent[] {
    const list = reminders()
    const due = list.filter(r => r.start - now <= 15 * 60 * 1000 && now - r.start < 60 * 60 * 1000)
    // done with: what fired, and what is long past
    save(list.filter(r => !due.includes(r) && now - r.start < 60 * 60 * 1000))
    return due
}

const stamp = (t: number) => new Date(t).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
const escape = (s: string) => s.replace(/[\\;,]/g, m => '\\' + m).replace(/\n/g, '\\n')

/** a calendar file (RFC 5545) for one mint, with an alarm a quarter before */
export function icsFor(e: LaunchEvent, url: string, now = Date.now()): string {
    return [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//BlackVault//Launchpad//EN',
        'BEGIN:VEVENT',
        `UID:${e.id}@blackvemarket.com`,
        `DTSTAMP:${stamp(now)}`,
        `DTSTART:${stamp(e.start)}`,
        `DTEND:${stamp(e.end && e.end > e.start ? e.end : e.start + 60 * 60 * 1000)}`,
        `SUMMARY:${escape(`Mint: ${e.name} (${e.phase})`)}`,
        `URL:${url}`,
        'BEGIN:VALARM',
        'TRIGGER:-PT15M',
        'ACTION:DISPLAY',
        `DESCRIPTION:${escape(e.name)}`,
        'END:VALARM',
        'END:VEVENT',
        'END:VCALENDAR'
    ].join('\r\n')
}
