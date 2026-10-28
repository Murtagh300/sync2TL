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
    version: '2.3.0',
    date: '2026-10-28',
    items: {
        en: [
            'Pay the fee in VET or B3TR instead of VTHO, and see a warning before signing for a brand-new contract or tokens sent where they are lost.',
            'Buy VET with a card or iDEAL, and set buys on a schedule or at a price: BlackVault reminds you and fills in the swap.',
            'Discover the X2Earn apps of this round and what each paid you; a public profile page with a Pay me button.',
            'Your average buy price on the token chart, and a tax export of a year for Koinly and other tools.',
            'A calmer look everywhere, home in one or two columns on a computer, and dApps in a window of their own in the desktop app.'
        ],
        nl: [
            'Betaal de fee in VET of B3TR in plaats van VTHO, en zie een waarschuwing vóór het ondertekenen bij een gloednieuw contract of tokens die verloren gaan.',
            'Koop VET met een kaart of iDEAL, en plan aankopen op een vast moment of bij een prijs: BlackVault herinnert je en vult de swap in.',
            'Ontdek de X2Earn-apps van deze ronde en wat elk jou betaalde; een openbare profielpagina met een Betaal mij-knop.',
            'Je gemiddelde aankoopprijs in de koersgrafiek, en een belastingexport van een jaar voor Koinly en andere tools.',
            'Overal een rustiger uiterlijk, home in één of twee kolommen op een computer, en dApps in een eigen venster in de desktop-app.'
        ],
        de: [
            'Zahle die Gebühr in VET oder B3TR statt VTHO, und sieh vor dem Unterschreiben eine Warnung bei einem brandneuen Vertrag oder Token, die verloren gehen.',
            'Kaufe VET mit Karte oder iDEAL, und plane Käufe nach Zeit oder Preis: BlackVault erinnert dich und füllt den Swap aus.',
            'Entdecke die X2Earn-Apps dieser Runde und was jede dir gezahlt hat; eine öffentliche Profilseite mit Bezahl-mich-Knopf.',
            'Dein durchschnittlicher Kaufpreis im Kursdiagramm, und ein Steuerexport eines Jahres für Koinly und andere Tools.',
            'Überall ein ruhigeres Aussehen, Home in einer oder zwei Spalten am Computer, und dApps in einem eigenen Fenster der Desktop-App.'
        ],
        fr: [
            'Payez les frais en VET ou B3TR au lieu de VTHO, et voyez un avertissement avant de signer pour un contrat tout neuf ou des jetons qui seraient perdus.',
            'Achetez du VET par carte ou iDEAL, et planifiez des achats à date fixe ou à un prix : BlackVault vous le rappelle et remplit le swap.',
            'Découvrez les apps X2Earn de la manche et ce que chacune vous a payé ; une page de profil publique avec un bouton Me payer.',
            'Votre prix d’achat moyen sur le graphique du jeton, et un export fiscal d’une année pour Koinly et d’autres outils.',
            'Un look plus calme partout, l’accueil en une ou deux colonnes sur ordinateur, et les dApps dans leur propre fenêtre dans l’app de bureau.'
        ],
        zh: [
            '可用 VET 或 B3TR 代替 VTHO 支付手续费；签名前遇到新合约或会丢失代币的操作时会给出警告。',
            '可用银行卡或 iDEAL 购买 VET，并可按时间或价格计划买入：BlackVault 会提醒你并填好兑换。',
            '发现本轮 X2Earn 应用及其向你支付的金额；公开主页带“向我付款”按钮。',
            '代币走势图显示你的平均买入价；可导出一年的税务数据，适用于 Koinly 等工具。',
            '整体界面更简洁，电脑上首页可选一栏或两栏，桌面应用中 dApp 在独立窗口打开。'
        ]
    }
}, {
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
