# BlackVault – handmatige testchecklist

Loop deze lijst door na elke grote wijziging (upgrade-fases, releases).
Gebruik **testnet** of een wallet zonder echte waarde, behalve waar "mainnet" staat.

Noteer per run: datum, versie/commit, platform (web / desktop / Android / iOS), resultaat.

## 1. Eerste start
- [ ] Disclaimer verschijnt, kan alleen verder na aanvinken
- [ ] Welkomstscherm toont BVM-logo, slides swipen
- [ ] Taal wisselen (Automatic / English / 中文) werkt

## 2. Wallet aanmaken
- [ ] Nieuw wachtwoord + bevestigen; verkeerde bevestiging geeft foutmelding
- [ ] "One Moment"-stappen lopen door, eindigt met "Your wallet is ready!"
- [ ] Hoofdscherm toont wallet-kaart met adres en VET/VTHO-saldo (geen `--.--`)
- [ ] Banner "Wallet not backed up" is zichtbaar

## 3. Back-up
- [ ] Back-up starten, 24 woorden tonen (na wachtwoord)
- [ ] Woorden-controle: verkeerde volgorde wordt geweigerd, juiste volgorde accepteert
- [ ] Banner verdwijnt na geslaagde back-up

## 4. Wallet importeren
- [ ] Importeren met bekende mnemonic geeft **hetzelfde adres** als in andere wallets (bv. VeWorld)
- [ ] Ongeldige mnemonic geeft foutmelding
- [ ] Meerdere wallets: wisselen via het zijmenu, actieve wallet is gemarkeerd

## 5. Adressen en tokens
- [ ] Extra adres toevoegen in een wallet
- [ ] Adres kopiëren en QR-code tonen
- [ ] Tokeninstellingen: token aan/uit zetten, verschijnt/verdwijnt op het hoofdscherm
- [ ] Asset-pagina toont transferhistorie; link opent de explorer

## 6. Versturen (testnet)
- [ ] VET versturen naar eigen tweede adres, saldo werkt bij
- [ ] VTHO versturen
- [ ] Ander token (VIP-180) versturen
- [ ] Ongeldig adres / te hoog bedrag geeft foutmelding
- [ ] Recente ontvangers worden onthouden

## 7. dApp-interactie
- [ ] dApp op testnet opent BlackVault voor een **transactie**; samenvatting en clauses kloppen; tekenen lukt
- [ ] dApp vraagt een **certificaat** (login); tekenen lukt
- [ ] Afwijzen sluit netjes af, dApp krijgt een fout
- [ ] Activiteitenoverzicht toont de transactie en status wordt "completed"

## 8. Instellingen
- [ ] Wachtwoord wijzigen; oud wachtwoord werkt daarna niet meer, nieuw wel
- [ ] Nodes: standaardnode werkt; eigen node toevoegen en selecteren
- [ ] Wallet verwijderen (testwallet)

## 9. Ledger (desktop / Chrome)
- [ ] Ledger koppelen, adres verschijnt
- [ ] Transactie tekenen met Ledger

## 10. Platform-specifiek
- [ ] **Web/PWA**: installeren als app, opnieuw openen werkt; app-icoon is BVM
- [ ] **Desktop**: `connex:`-link uit een browser opent BlackVault
- [ ] **Mobiel**: QR-scanner werkt; biometrische ontgrendeling werkt

## 11. Bestaande data (bij upgrades)
- [ ] Een wallet die met de **vorige versie** is aangemaakt, opent met hetzelfde wachtwoord
      en toont hetzelfde adres (de automatische tests in `next/test/core` bewaken dit ook)
