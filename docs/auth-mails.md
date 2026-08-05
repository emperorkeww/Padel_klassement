# Auth-mails

> Alle mails die Supabase namens de app verstuurt: wachtwoordherstel,
> aanmelding bevestigen, e-mailadres wijzigen, uitnodigingen en twee
> veiligheidsmeldingen achteraf. Opgezet in [#1037](https://github.com/emperorkeww/Padel_klassement/issues/1037).

## 1. Waar staat wat

De HTML in `supabase/templates/` is **de bron van waarheid**. Het dashboard is
dat niet: wat daar staat is het resultaat van de laatste `config push`.

| bestand | sleutel | soort | onderwerp |
|---|---|---|---|
| `wachtwoord-herstellen.html` | `recovery` | actie | Je wachtwoord opnieuw instellen |
| `bevestig-aanmelding.html` | `confirmation` | actie | Welkom bij Vamos! — bevestig je e-mailadres |
| `bevestig-nieuw-adres.html` | `email_change` | actie | Bevestig je nieuwe e-mailadres |
| `uitnodiging.html` | `invite` | actie | Je bent uitgenodigd voor Vamos! |
| `inloglink.html` | `magic_link` | actie | Je inloglink voor Vamos! |
| `wachtwoord-gewijzigd.html` | `password_changed` | notificatie | Je wachtwoord is gewijzigd |
| `adres-gewijzigd.html` | `email_changed` | notificatie | Je e-mailadres is gewijzigd |

**Actiesjablonen** hebben een knop en een actielink; er valt iets te bevestigen.
**Notificaties** zijn meldingen achteraf: geen knop, wel een weg terug voor wie
de wijziging niet zelf deed.

### De actielink gaat naar ons eigen domein, niet naar Supabase

```
{{ .SiteURL }}/auth/bevestigen?token_hash={{ .TokenHash }}&type=<type>
```

**Niet** `{{ .ConfirmationURL }}`. De client draait op `flowType: "pkce"`
(`src/lib/supabase/client.ts`), en die flow wisselt de code in met een
`code_verifier` uit de localStorage van de browser die de mail aanvroeg. Vraag
je herstel aan op je laptop en open je de mail op je telefoon, dan bestaat die
verifier daar niet: *"Deze herstellink is ongeldig of verlopen"* — terwijl er
niets mis is met de link. Dat is precies wat mensen doen, dus dat is fataal.

`verifyOtp` met een `token_hash` heeft die verifier niet nodig en werkt op elk
apparaat. `src/features/auth/AuthBevestigen.tsx` vangt de link op, wisselt het
token in en stuurt door op basis van `type`.

Bijvangst: de link wijst naar ons eigen domein, dus een linkscanner die de URL
alleen ophaalt zonder JavaScript uit te voeren verbruikt het eenmalige token
niet. Dat was het SafeLinks-risico.

Let op: het `type` in de link is niet altijd de config-sleutel. Het blok heet
`confirmation` maar `verifyOtp` verwacht `signup`; `magic_link` wordt
`magiclink`. `scripts/mail-templates.test.mjs` bewaakt die koppeling.

`magic_link` gebruiken we niet — we loggen in met e-mail + wachtwoord. Het
sjabloon ligt er zodat er niet stilletjes een Engelse standaardmail uitgaat als
die login-methode ooit aangezet wordt.

### Padvormen verschillen per bloktype

```toml
[auth.email.template.recovery]              # vanaf de projectroot
content_path = "./supabase/templates/wachtwoord-herstellen.html"

[auth.email.notification.password_changed]  # vanaf supabase/
enabled = true
content_path = "./templates/wachtwoord-gewijzigd.html"
```

Dat is geen slordigheid maar hoe de CLI het rekent; Supabase' eigen
voorbeeldconfig laat hetzelfde verschil zien. De verkeerde vorm faalt hard bij
elk commando dat de config leest (`supabase status` volstaat om dat te merken).

## 2. Uitrollen naar het gehoste project

```bash
RESEND_API_KEY=<de sleutel uit Resend> \
  npx -y supabase@2.75.0 config push --project-ref fuxjxorbbebbxxgsnyon
```

Draai dit vanuit de projectroot. De CLI toont een diff en vraagt bevestiging.

### Lees die diff. Altijd.

`config push` duwt de **volledige berekende config** naar het project, niet
alleen wat je wijzigde. Alles in `config.toml` buiten `[remotes.production]` is
op de lokale stack gericht. Zonder dat overrideblok zou een push:

- `site_url` op `http://127.0.0.1:3000` zetten — elke mail-link naar localhost;
- de mail-rate-limit van 50 naar 2 per uur brengen;
- e-mailbevestiging uitzetten, zodat accounts zonder verificatie binnenkomen;
- MFA (TOTP) uitzetten, wat gebruikers buitensluit die het al gebruiken.

Die laatste kwam niet uit het uitlezen van de auth-config maar **pas uit de
diff van `config push` zelf**. Vandaar: lezen, niet bevestigen op gevoel.

Een gezonde diff raakt alleen de zeven sjablonen, hun onderwerpen, en niets
anders. Zie je een regel over `site_url`, `rate_limit`, `mfa` of
`enable_confirmations` — **afbreken** en `[remotes.production]` bijwerken.

### Er is geen `config pull`

Pushen is dus eenrichtingsverkeer en blind. `[remotes.production]` is met de
hand gelijkgetrokken met de Management API:

```bash
curl -s -H "Authorization: Bearer <personal-access-token>" \
  https://api.supabase.com/v1/projects/fuxjxorbbebbxxgsnyon/config/auth | jq
```

Token maak je op <https://supabase.com/dashboard/account/tokens>; revoke hem
daarna. Wijzigt iemand iets in het dashboard zonder het hier over te nemen, dan
draait de eerstvolgende push dat terug.

### De SMTP-sleutel

`pass = "env(RESEND_API_KEY)"` — nooit in de repo. Staat de variabele niet in je
shell, dan waarschuwt de CLI (`environment variable is unset`) en riskeer je een
lege waarde te pushen, waarmee alle uitgaande mail plat gaat. Zet hem, of breek
af.

## 3. Lokaal testen

De lokale stack serveert de sjablonen via Kong; **de CLI maakt daarvan een
snapshot bij `supabase start`**. Een wijziging in `supabase/templates/` komt dus
pas in de mail na een herstart:

```bash
npx -y supabase@2.75.0 stop && npx -y supabase@2.75.0 start
```

Controleren wat er écht geserveerd wordt, zonder herstart:

```bash
docker exec supabase_auth_Padel wget -qO- \
  http://supabase_kong_Padel:8088/email/recovery.html | grep -c "<zoekterm>"
```

Een mail afvuren en bekijken in Mailpit (poort 54324, heet in `config.toml` nog
`[inbucket]`):

```bash
KEY=$(grep VITE_SUPABASE_ANON_KEY .env | cut -d= -f2- | tr -d '"')
curl -s -X POST "http://127.0.0.1:54321/auth/v1/recover" \
  -H "apikey: $KEY" -H "Content-Type: application/json" \
  -d '{"email":"dave@example.com"}'

curl -s "http://127.0.0.1:54324/api/v1/messages?limit=1"        # ID
curl -s "http://127.0.0.1:54324/api/v1/message/<ID>"            # .HTML
curl -s "http://127.0.0.1:54324/api/v1/message/<ID>/html-check" # compatibiliteit
```

Die laatste geeft een clientcompatibiliteitsscore; de huidige sjablonen halen
~94% ondersteund. Het `raw`-endpoint is quoted-printable — grep op de ruwe bytes
geeft valse negatieven, decodeer eerst.

## 4. Vallen die stille schade geven

**GoTrue strippt álle HTML-commentaar.** Het rendert met Go's `html/template`.
Een Outlook-knop in `<!--[if mso]>…<![endif]-->` bereikt de mail dus nooit: de
bron ziet er goed uit, Outlook krijgt een kale gekleurde tekstregel. Daarom is
de knop een tabel met `bgcolor` en padding op de `<td>` — dat rendert Outlook
zonder trucs, alleen de afronding valt daar weg.

**Notificaties hebben andere variabelen dan actiesjablonen.** `adres-gewijzigd`
gebruikt `{{ .OldEmail }}` en `{{ .Email }}` (niet `{{ .NewEmail }}`), en
`wachtwoord-gewijzigd` gebruikt er bewust geen enkele. Een variabele die niet
bestaat rendert als `<no value>`, zichtbaar in de mail.

**`{{ .TokenHashNew }}` en `{{ .TokenNew }}` bestaan niet.** Ze renderen leeg.
Bij een adreswissel gaan er twee mails uit en krijgt **elke ontvanger zijn eigen
`{{ .TokenHash }}`** — één sjabloon volstaat dus voor allebei.

**De dev-server bepaalt `site_url` lokaal.** De sjablonen bouwen hun link met
`{{ .SiteURL }}`, dus die moet op `http://localhost:5173` staan (vite-default).
Draait er al iets op 5173, dan pakt vite 5174 en wijzen de maillinks naar de
verkeerde app — controleer de poort in de uitvoer van `npm run dev`.

## 5. Wat CI bewaakt

`scripts/mail-templates.test.mjs` draait mee in `npm test`. Het controleert per
sjabloon: de placeholders, de afwezigheid van externe verwijzingen (`<script>`,
`<link>`, `@import`, webfonts, vreemde domeinen), dat elke hexkleur overeenkomt
met een token uit `src/app/index.css`, de gedeelde romp, dat er nergens op een
conditional comment geleund wordt, de koppeling in `config.toml` inclusief de
juiste padvorm per bloktype, én dat `[remotes.production]` de kritieke
productiewaarden bevat.

Het controleert **niet** of de sjablonen ook echt naar productie gepusht zijn.
Merge is geen uitrol; dat blijft de handmatige stap uit §2.

## 6. Afzender en deliverability

Afzender: `Vamos! <noreply@vamos-padel.net>` via Resend (`smtp.resend.com:465`).

DNS op `vamos-padel.net` (Cloudflare):

| record | waarde |
|---|---|
| SPF | `send.vamos-padel.net` TXT → `v=spf1 include:amazonses.com ~all` |
| DKIM | `resend._domainkey` TXT |
| Return-Path | `send.vamos-padel.net` MX → `feedback-smtp.eu-west-1.amazonses.com` |
| DMARC | `_dmarc` TXT → `v=DMARC1; p=none;` |

`p=none` is bewust de eerste stap: observeren zonder te blokkeren. Verscherpen
naar `quarantine` of `reject` kan pas als vaststaat dat alles uitlijnt.

Er staat geen `rua=` in: `vamos-padel.net` heeft geen MX-record, en een
rapportadres op een ander domein vereist een autorisatierecord aan díé kant.
Wil je toch rapporten, gebruik dan Cloudflare's DMARC Management.

Nalezen kan zonder `dig` (dat staat niet overal geïnstalleerd):

```bash
curl -s -H "accept: application/dns-json" \
  "https://cloudflare-dns.com/dns-query?name=_dmarc.vamos-padel.net&type=TXT"
```
