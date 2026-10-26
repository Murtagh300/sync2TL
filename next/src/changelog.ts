/**
 * What's new, shown once after an update (components/WhatsNewDialog.vue) and from Meer.
 * The newest version first; keep each line short and about what a user notices.
 * The full history is in CHANGELOG.md.
 */

export type Release = {
    version: string
    date: string
    /** per language; English is the fallback */
    items: Record<string, string[]>
}

export const releases: Release[] = [{
    version: '2.1.0',
    date: '2026-10-25',
    items: {
        en: [
            'Notifications for incoming VET, VTHO and tokens, also when BlackVault is closed. No sign-in needed.',
            'A back-up of your settings: contacts, notes, alerts and more, protected with a password.',
            'Updates wait until you tap Update, and this screen tells you what changed.',
            'When a service is slow or down, BlackVault says so instead of showing empty numbers.',
            'Steadier connections: requests are retried, and a service that is down is given a rest.'
        ],
        nl: [
            'Meldingen voor binnenkomende VET, VTHO en tokens, ook als BlackVault dicht is. Inloggen is niet nodig.',
            'Een back-up van je instellingen: contacten, notities, alerts en meer, beveiligd met een wachtwoord.',
            'Updates wachten tot je op Bijwerken tikt, en dit scherm vertelt wat er veranderd is.',
            'Als een dienst traag of onbereikbaar is, zegt BlackVault dat in plaats van lege cijfers te tonen.',
            'Stabielere verbindingen: verzoeken worden opnieuw geprobeerd en een dienst die plat ligt krijgt even rust.'
        ],
        de: [
            'Mitteilungen für eingehende VET, VTHO und Token, auch wenn BlackVault geschlossen ist. Keine Anmeldung nötig.',
            'Ein Backup deiner Einstellungen: Kontakte, Notizen, Alarme und mehr, mit Passwort geschützt.',
            'Updates warten, bis du auf Aktualisieren tippst, und dieser Bildschirm zeigt, was sich geändert hat.',
            'Ist ein Dienst langsam oder nicht erreichbar, sagt BlackVault das, statt leere Zahlen zu zeigen.',
            'Stabilere Verbindungen: Anfragen werden wiederholt, und ein ausgefallener Dienst bekommt eine Pause.'
        ],
        fr: [
            'Des notifications pour les VET, VTHO et jetons entrants, même BlackVault fermé. Aucune connexion nécessaire.',
            'Une sauvegarde de vos réglages : contacts, notes, alertes et plus, protégée par un mot de passe.',
            'Les mises à jour attendent que vous touchiez Mettre à jour, et cet écran dit ce qui a changé.',
            'Quand un service est lent ou indisponible, BlackVault le dit au lieu d’afficher des chiffres vides.',
            'Des connexions plus stables : les requêtes sont réessayées, et un service en panne est laissé au repos.'
        ],
        zh: [
            '收到 VET、VTHO 或代币时通知你，即使 BlackVault 已关闭。无需登录。',
            '设置备份：联系人、备注、提醒等，用密码保护。',
            '更新会等你点“更新”后再安装，此页面会告诉你有哪些变化。',
            '当某个服务变慢或不可用时，BlackVault 会提示你，而不是显示空白数字。',
            '连接更稳定：请求会自动重试，出故障的服务会暂停访问一会儿。'
        ]
    }
}]

/** the lines of a release in this language */
export function releaseItems(r: Release, locale: string): string[] {
    return r.items[locale.slice(0, 2)] || r.items.en || []
}

const SEEN = 'bv-seen-version'

/** the release to show once after an update (not after a fresh install), and remember it was seen */
export function unseenRelease(current: string): Release | null {
    let seen: string | null = null
    try {
        seen = localStorage.getItem(SEEN)
        localStorage.setItem(SEEN, current)
    } catch {
        return null
    }
    if (!seen || seen === current) return null
    return releases.find(r => r.version === current) || null
}
