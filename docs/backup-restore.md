# Backup & herstel van de productie-Supabase

De workflow [`.github/workflows/backup.yml`](../.github/workflows/backup.yml) maakt
elke nacht om 03:20 UTC een versleutelde momentopname van productie en hangt die
als artifact aan de run. Dit document beschrijft wat daar in zit en hoe je het
terugzet.

> [!IMPORTANT]
> De passphrase (`BACKUP_PASSPHRASE`) is het enige dat de backup opent. Kwijt is
> kwijt — er is geen sleutelherstel. Bewaar hem in een wachtwoordmanager, niet
> uitsluitend als repo-secret.

## Waarom dit er is

De platform-backups van Supabase dekken ons risico niet: op Free zijn er geen
restore-bare dagelijkse backups, op Pro wel maar met 7 dagen retentie, en in geen
van beide gevallen zitten de bestanden uit Storage erin. De matchhistorie en de
daaruit opgebouwde Elo-standen zijn niet te reconstrueren.

## Wat er in zit

| Bestand | Inhoud |
| :--- | :--- |
| `db/roles.sql` | Cluster-rollen en hun instellingen (`statement_timeout` per rol). |
| `db/schema.sql` | Het volledige `public`-schema: tabellen, views, functies, policies, grants. |
| `db/auth.sql` | De data van het `auth`-schema — accounts, identiteiten, sessies. |
| `db/data.sql` | De data van `public` en `supabase_functions`. |
| `storage/avatars/…` | Alle bestanden uit de `avatars`-bucket: profielfoto's en de AI-dictatorportretten. |
| `storage/avatars-manifest.json` | Pad + grootte per bestand, om een restore tegen af te vinken. |
| `HERKOMST.txt` | Commit, run-id, projectref en tijdstip van de dump. |

### Wat er bewust níet in zit

- **Het `storage`-schema in de database.** Twee redenen. Terugzetten loopt stuk op
  `permission denied for table buckets_vectors` — alle storage-tabellen zijn
  eigendom van `supabase_storage_admin`, niet van `postgres`. En het is overbodig:
  de Storage-API schrijft `storage.objects` zelf opnieuw zodra de bestanden terug
  geüpload worden. Dat is nagemeten — na een restore stond de rij er weer met de
  juiste grootte. Er gaat ook geen toegangscontrole verloren, want de policies zijn
  padgebaseerd (`foldername(name)[1] = auth.uid()`), niet eigenaargebaseerd.
- **De bucketdefinitie zelf.** Die is code, geen data: ze staat in de migratie
  `supabase/migrations/20260701150000_avatars_storage.sql`. Zie stap 4 hieronder.
- **De schema's `auth`, `storage`, `extensions` en `vault` als DDL.** `db dump`
  dumpt alleen `public`; die andere schema's maakt het Supabase-platform aan. Je
  kunt deze backup dus **niet** terugzetten in een kale Postgres — het doel moet
  een Supabase-project zijn (hosted of lokaal via `supabase start`).
- **Edge Function-secrets** (`ADMIN_SITE_URL`, VAPID-sleutels, `CRON_SECRET`) en de
  Cloudflare-configuratie. Die zet je met de hand terug; zie de README.

## Herstellen

### 1. Het archief ophalen en openen

```bash
gh run list --workflow=Backup --limit 5
gh run download <run-id>          # levert supabase-backup-<datum>-<run-id>/
cd supabase-backup-*
gpg --decrypt backup.tar.gz.gpg > backup.tar.gz
mkdir herstel && tar -xzf backup.tar.gz -C herstel
cat herstel/HERKOMST.txt          # controleer dat je de juiste nacht te pakken hebt
```

### 2. Een doelproject klaarzetten

Een **leeg Supabase-project** (nieuw hosted project, of lokaal `supabase start`).
Noteer de connectiestring; hosted vind je die onder Project Settings > Database.

> [!WARNING]
> Het doelproject moet minstens even nieuw zijn als de bron. Loopt het achter, dan
> mist het `auth`-schema tabellen of kolommen die de dump wél heeft, en klapt stap 3
> op `relation "auth.<tabel>" does not exist`. Zie *Als de auth-dump vastloopt*.

### 3. De database terugzetten

In één transactie, met foreign keys en triggers uit (`session_replication_role`),
zodat de volgorde binnen de dump niet uitmaakt:

```bash
psql --single-transaction --variable ON_ERROR_STOP=1 \
  --file herstel/db/roles.sql \
  --file herstel/db/schema.sql \
  --command 'SET session_replication_role = replica' \
  --file herstel/db/auth.sql \
  --file herstel/db/data.sql \
  --dbname "postgresql://postgres:<wachtwoord>@<host>:5432/postgres"
```

`WARNING: no privileges were granted for "_error_diag"` is onschuldig en hoort erbij.
Bij `ERROR` rolt de hele transactie terug en is er niets half hersteld.

### 4. De bucket aanmaken

De bucket en zijn policies zitten niet in de backup. Draai de migratie:

```bash
psql --variable ON_ERROR_STOP=1 \
  --file supabase/migrations/20260701150000_avatars_storage.sql \
  --dbname "postgresql://postgres:<wachtwoord>@<host>:5432/postgres"
```

### 5. De bestanden terugzetten

De service-role-key haal je op dat moment uit het dashboard (Project Settings > API).
Die staat bewust niet als repo-secret: de backup heeft hem niet nodig, alleen het
herstel.

```bash
SUPABASE_URL=https://<ref>.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<service-role key> \
node scripts/restore-storage.mjs herstel/storage
```

Het script vinkt zichzelf af tegen `avatars-manifest.json` en faalt hard bij een
ontbrekend of afwijkend bestand.

### 6. Nalopen

- Aantal rijen in `public.matches` en `public.profiles` tegen `HERKOMST.txt`-datum.
- Een profielfoto opvragen: `https://<ref>.supabase.co/storage/v1/object/public/avatars/<uid>/<bestand>`.
- Inloggen met een bestaand account.
- Edge Function-secrets en de Cloudflare-Worker opnieuw configureren.

### Als de auth-dump vastloopt

Bij `relation "auth.<tabel>" does not exist` mist het doelproject een tabel die de
bron wél had (GoTrue-versieverschil). De app-data staat los in `data.sql` en heeft
er geen last van. Snijd het betreffende `COPY`-blok uit `auth.sql` en draai stap 3
opnieuw:

```bash
awk '
  /^COPY "auth"."(custom_oauth_providers|webauthn_challenges|webauthn_credentials)"/ { skip=1; next }
  skip && /^\\\.$/ { skip=0; next }
  !skip
' herstel/db/auth.sql > herstel/db/auth-trimmed.sql
```

Wat je echt nodig hebt is `auth.users` en `auth.identities`. De rest —
`sessions`, `refresh_tokens`, `mfa_*`, `audit_log_entries`, `flow_state`, de
oauth-/saml-/sso-tabellen — is sessiestatus die je na een ramp toch liever kwijt
bent: iedereen logt gewoon opnieuw in.

## Beperkingen om in de gaten te houden

- **90 dagen retentie.** Dat is het maximum voor GitHub-artifacts. Wil je verder
  terug kunnen, download dan periodiek een archief en bewaar het buiten GitHub.
- **De backup leeft bij dezelfde partij als de code.** Een R2-bestemming is de
  logische vervolgstap.
- **Een `schedule` draait alleen vanaf de default branch.** De workflow maakt dus
  pas backups nadat hij via `develop` naar `main` is gereleased, en de knop
  "Run workflow" verschijnt pas op `main`.
- **GitHub zet geplande workflows uit na 60 dagen zonder activiteit in de repo.**
- Faalt de nachtelijke run, dan mailt GitHub de repo-eigenaar. Er is verder geen
  aparte alarmering.

## Herstel oefenen

Een backup die nooit is teruggezet is een aanname, geen backup. De keten hierboven
is op 2026-08-06 end-to-end doorlopen tegen een geïsoleerde lokale stack: dumpen,
versleutelen, ontsleutelen, terugzetten in een leeg Supabase-project en de
bestanden opnieuw uploaden. Alle 34 publieke tabellen kwamen op hetzelfde
rijaantal uit en het teruggezette bestand was byte-identiek (gelijke SHA-256).

Herhaal dat een keer per kwartaal met een échte productie-artifact. Doe dat in een
**apart** lokaal project en niet in je gewone dev-stack: `supabase start` in deze
repo past de migraties toe (dus geen leeg project), en `supabase db reset` wist de
dev-database die je met andere sessies deelt.

```bash
mkdir -p /tmp/herstelproef/supabase
cp supabase/config.toml supabase/templates -r /tmp/herstelproef/supabase/
cd /tmp/herstelproef
# eigen project_id en poorten, zodat niets botst met de dev-stack
sed -i 's/^project_id = "Padel"/project_id = "Herstelproef"/;
        s/^port = 54321$/port = 54421/; s/^port = 54322$/port = 54422/;
        s/^shadow_port = 54320$/shadow_port = 54420/; s/^port = 54329$/port = 54429/;
        s/^port = 54323$/port = 54423/; s/^port = 54324$/port = 54424/;
        s/^port = 54327$/port = 54427/' supabase/config.toml
supabase start                    # leeg project: geen migrations/ meegekopieerd
# stap 3 t/m 5 hierboven, met poort 54422 en de service-role-key uit `supabase status`
supabase stop --no-backup         # opruimen
```
