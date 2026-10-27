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
    version: '2.2.1',
    date: '2026-10-27',
    items: {
        en: [
            'A sent transaction no longer stays on "waiting for the chain" once it is in a block.',
            'Amounts are written the way your language writes them, and an empty wallet shows how to get your first VET.',
            'A tidier Meer tab with groups and search, and clearer Send and Receive screens.',
            'Desktop app: an icon in the tray, start with the computer, and notifications from Windows or macOS.'
        ],
        nl: [
            'Een verstuurde transactie blijft niet meer op "wacht op de chain" staan als hij in een blok staat.',
            'Bedragen staan in de notatie van je taal, en een lege wallet laat zien hoe je je eerste VET erop zet.',
            'Een overzichtelijkere Meer-tab met groepen en zoeken, en duidelijkere schermen voor Verzenden en Ontvangen.',
            'Desktop-app: een icoon in het systeemvak, starten bij opstarten, en meldingen van Windows of macOS.'
        ],
        de: [
            'Eine gesendete Transaktion bleibt nicht mehr auf „wartet auf die Chain“, sobald sie in einem Block ist.',
            'Beträge stehen so, wie deine Sprache sie schreibt, und eine leere Wallet zeigt, wie du deine ersten VET bekommst.',
            'Ein übersichtlicherer Mehr-Tab mit Gruppen und Suche, und klarere Bildschirme zum Senden und Empfangen.',
            'Desktop-App: ein Symbol im Infobereich, Start mit dem Computer und Benachrichtigungen von Windows oder macOS.'
        ],
        fr: [
            'Une transaction envoyée ne reste plus sur « en attente de la chaîne » une fois dans un bloc.',
            'Les montants s’écrivent comme dans votre langue, et un portefeuille vide montre comment recevoir vos premiers VET.',
            'Un onglet Plus mieux rangé, avec groupes et recherche, et des écrans Envoyer et Recevoir plus clairs.',
            'App de bureau : une icône dans la zone de notification, le démarrage avec l’ordinateur et les notifications de Windows ou macOS.'
        ],
        zh: [
            '已发送的交易进入区块后，不会再一直显示“等待上链”。',
            '金额按你的语言习惯显示；空钱包会提示如何存入第一笔 VET。',
            '“更多”页按分组整理并可搜索，发送和接收页面更清晰。',
            '桌面应用：托盘图标、开机启动，以及来自 Windows 或 macOS 的通知。'
        ]
    }
}, {
    version: '2.2.0',
    date: '2026-10-27',
    items: {
        en: ['BlackVault for Windows, macOS and Linux: a desktop app that updates itself.', 'Websites connect to BlackVault directly: no WalletConnect link to copy. You confirm in BlackVault and it closes by itself.'],
        nl: ['BlackVault voor Windows, macOS en Linux: een desktop-app die zichzelf bijwerkt.', 'Websites verbinden direct met BlackVault: geen WalletConnect-link meer kopiëren. Je bevestigt in BlackVault en het venster sluit vanzelf.'],
        de: ['BlackVault für Windows, macOS und Linux: eine Desktop-App, die sich selbst aktualisiert.', 'Websites verbinden sich direkt mit BlackVault: kein WalletConnect-Link mehr zum Kopieren. Du bestätigst in BlackVault, und das Fenster schließt sich von selbst.'],
        fr: ['BlackVault pour Windows, macOS et Linux : une application de bureau qui se met à jour seule.', 'Les sites se connectent directement à BlackVault : plus de lien WalletConnect à copier. Vous confirmez dans BlackVault, qui se ferme tout seul.'],
        zh: ['适用于 Windows、macOS 和 Linux 的 BlackVault 桌面应用，可自动更新。', '网站可直接连接 BlackVault，无需再复制 WalletConnect 链接。在 BlackVault 中确认后，窗口会自动关闭。']
    }
}, {
    version: '2.1.1',
    date: '2026-10-26',
    items: {
        en: ['Signing uses a newer, audited cryptography library.', 'Safer restoring of a settings back-up: you see its contacts first, and it can no longer change your nodes.', '.vet names show again everywhere.'],
        nl: ['Ondertekenen gebruikt een nieuwere, geaudite cryptografie-bibliotheek.', 'Veiliger terugzetten van een back-up: je ziet eerst de contacten, en hij kan je nodes niet meer wijzigen.', '.vet-namen worden weer overal getoond.'],
        de: ['Signieren nutzt eine neuere, geprüfte Kryptografie-Bibliothek.', 'Sichereres Wiederherstellen eines Backups: Du siehst zuerst die Kontakte, und es kann deine Nodes nicht mehr ändern.', '.vet-Namen werden wieder überall angezeigt.'],
        fr: ['La signature utilise une bibliothèque cryptographique plus récente et auditée.', 'Restauration plus sûre : vous voyez d’abord les contacts, et elle ne peut plus changer vos nœuds.', 'Les noms .vet s’affichent de nouveau partout.'],
        zh: ['签名改用更新且经过审计的加密库。', '恢复设置备份更安全：先显示其中的联系人，且不再能更改你的节点。', '.vet 名称重新正常显示。']
    }
}, {
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
