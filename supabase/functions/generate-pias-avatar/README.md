# generate-pias-avatar — AI pias-portret (#682)

Maakt van de profielfoto een goedmoedig clownportret (OpenAI `gpt-image-1`, image
*edit*) in de vaste stijl van de pias-referentie in de publieke `avatars`-bucket.
Het portret komt op `{userId}/pias.png` en wordt op **De Schandpaal** getoond
i.p.v. de gewone avatar.

Spiegel van [`generate-dictator-avatar`](../generate-dictator-avatar/README.md)
(#554): hetzelfde recept (`_shared/aiPortretHandler.ts`), dezelfde aanroeppaden,
secrets en deploy-vlag. Alleen de stijl verschilt — prompt, referentiepad,
bestandsnaam en doelkolommen staan als data in `STIJLEN.pias`
(`_shared/aiPortret.ts`).

**Lazy + opt-out.** De function draait niet bij elke upload, maar zodra iemand de
globale pias van de week wordt (server-trigger op `pias_of_week`) of wanneer je
zélf de pias bent en je portret vervallen is (client-vangnet). Staat
`profiles.pias_portret` uit, dan gaat de foto nooit naar OpenAI. Kosten: ~één
generatie per persoon per profielfoto, niet per week en niet per upload.

## Twee aanroeppaden

1. **Client** (eigenaar pre-warmt z'n eigen portret) — `supabase.functions
   .invoke("generate-pias-avatar")` met de user-JWT. `targetUserId` = de ingelogde
   gebruiker; `body.userId` wordt genegeerd.
2. **Trusted server-trigger** — aanroep met header `x-cron-secret` + `{ userId }`.
   Mag voor een willekeurige gebruiker.

Verkeerd of ongeconfigureerd `x-cron-secret` → `401` (geen stille terugval naar
pad 1).

## Eenmalige setup

1. **Stijlreferentie kiezen en uploaden** naar `avatars/_ref/pias-stijl.png`. De
   bron-PNG zit bewust niet in de repo (seed-beeld, geen app-asset), dus geef het
   pad mee:

   ```sh
   SUPABASE_URL=https://<ref>.supabase.co \
   SUPABASE_SERVICE_ROLE_KEY=<service_role key> \
   node scripts/upload-pias-referentie.mjs <pad/naar/pias-stijl.png>
   ```

   Doe dit óók lokaal (URL/key uit `npx supabase status`). Zonder referentie geeft
   de function `{ error: "reference-missing" }` (503) en verandert er niets.

   Waaraan het beeld moet voldoen: vierkant kop-en-schouders-clownportret,
   goedmoedig i.p.v. grotesk, met de elementen die de prompt noemt — schmink, rode
   neus, kleurrijke kraag, helder circuslicht, egale achtergrond. Het gezicht op de
   referentie doet niet mee; de function kopieert er alleen kostuum en licht van.

2. **Secrets** (dezelfde als de dictator-function — al gezet? dan niets te doen):

   ```sh
   supabase secrets set \
     OPENAI_API_KEY="sk-..." \
     CRON_SECRET="<zelfde-lange-string-als-de-andere-functies>"
   ```

   Zonder `OPENAI_API_KEY` doet de function niets (`{ skipped: "no-key" }`) —
   graceful, de Schandpaal toont zolang de gewone avatar.

3. **Deployen** (ZONDER jwt-verificatie — de function doet z'n eigen auth):

   ```sh
   supabase functions deploy generate-pias-avatar --no-verify-jwt
   supabase functions deploy generate-dictator-avatar --no-verify-jwt
   ```

   De dictator-function moet mee, want die deelt sinds #682 dezelfde
   `_shared/`-modules; de oude bundel bevat ze nog niet.

4. **Server-trigger** op `pias_of_week` — voer
   `supabase/snippets/pias_portret_webhook.sql` uit in de SQL-editor (vul
   `<PROJECT-REF>` + `<CRON-SECRET>` in). Draai dit ná stap 3.

## Lokaal draaien

`OPENAI_API_KEY` beschikbaar maken voor de lokale edge-runtime — in
`supabase/config.toml`:

```toml
[edge_runtime.secrets]
OPENAI_API_KEY = "env(OPENAI_API_KEY)"
CRON_SECRET = "env(CRON_SECRET)"
```

Start met de env gezet (`OPENAI_API_KEY=... npx supabase start`), of serveer met
`--env-file`. Vergeet stap 1 niet (referentie lokaal seeden).

## Privacy

Foto's van (bijna-)piassen gaan naar OpenAI; per generatie uitsluitend de avatar
van díé gebruiker + de vaste referentie + de vaste prompt — geen thread/history,
geen context van andere gebruikers. Opt-out via `profiles.pias_portret`
(Instellingen → Weergave), los van de dictator-opt-out. Een opt-out nult ook het
bewaarde portret (#682-migratie). Vermeld dit in de privacyvoorwaarden.

De prompt vraagt expliciet om een *goedmoedige* clown en verbiedt het uitvergroten
of vervormen van iemands gezichtstrekken: de grap is de rol, niet de persoon. Wie
een roast-schild (#183) aan heeft, komt niet op De Schandpaal en krijgt dus ook
nooit een clownportret.
