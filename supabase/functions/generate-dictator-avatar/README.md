# generate-dictator-avatar — AI dictator-portret (#554)

Maakt van de profielfoto een over-the-top militair dictator-portret (OpenAI
`gpt-image-1`, image *edit*) in de vaste stijl van de waarnemend-dictator-
referentie (groen uniform, medailles, imperiale pose). Het portret komt in de
publieke `avatars`-bucket op `{userId}/dictator.png` en wordt op De Troon
(#528/#545) getoond i.p.v. de gewone avatar.

**Lazy + opt-out.** De function draait niet bij elke upload maar zodra iemand in
range komt om dictator te worden (client-side pre-warm, PR3) of daadwerkelijk de
troon pakt (server-side vangnet via de `dictator_termijnen`-trigger, PR3). Staat
`profiles.dictator_portret` uit, dan gaat de foto nooit naar OpenAI.

## Twee aanroeppaden

1. **Client** (eigenaar pre-warmt z'n eigen portret) — `supabase.functions
   .invoke("generate-dictator-avatar")` met de user-JWT. `targetUserId` = de
   ingelogde gebruiker.
2. **Trusted server-trigger** (vangnet) — aanroep met header `x-cron-secret` +
   `{ userId }`. Mag voor een willekeurige gebruiker.

Verkeerd `x-cron-secret` → `401` (geen stille terugval naar pad 1).

## Eenmalige setup

1. **Stijlreferentie uploaden** naar `avatars/_ref/dictator-stijl.png` (de
   function fetcht die i.p.v. de ~2 MB-asset mee te bundelen):

   ```sh
   SUPABASE_URL=https://<ref>.supabase.co \
   SUPABASE_SERVICE_ROLE_KEY=<service_role key> \
   node scripts/upload-dictator-referentie.mjs
   ```

   Doe dit óók lokaal (met de lokale URL/key uit `npx supabase status`).

2. **Secrets zetten** op het gehoste project:

   ```sh
   supabase secrets set \
     OPENAI_API_KEY="sk-..." \
     CRON_SECRET="<zelfde-lange-string-als-de-andere-functies>"
   ```

   Zonder `OPENAI_API_KEY` doet de function niets (`{ skipped: "no-key" }`) —
   graceful, de troon toont zolang de gewone avatar. `CRON_SECRET` is dezelfde
   secret als de andere trusted-trigger-functies (#459).

3. **Deployen** (MET jwt-verificatie, de standaard — pad 1 heeft de user nodig):

   ```sh
   supabase functions deploy generate-dictator-avatar
   ```

4. **Server-trigger** op `dictator_termijnen` (PR3) — die stuurt via `pg_net` het
   `x-cron-secret` + de nieuwe dictator-`userId` mee.

## Lokaal draaien

`OPENAI_API_KEY` beschikbaar maken voor de lokale edge-runtime — voeg toe aan
`supabase/config.toml`:

```toml
[edge_runtime.secrets]
OPENAI_API_KEY = "env(OPENAI_API_KEY)"
CRON_SECRET = "env(CRON_SECRET)"
```

en start met de env gezet (`OPENAI_API_KEY=... npx supabase start`), of serveer
met `--env-file`. Vergeet stap 1 (referentie lokaal seeden) niet, anders geeft de
function `{ error: "reference-missing" }`.

## Privacy

Foto's van (bijna-)dictators gaan naar OpenAI; per generatie uitsluitend de avatar
van díé gebruiker + de vaste referentie + de vaste prompt — geen thread/history,
geen context van andere gebruikers. Opt-out via `profiles.dictator_portret`
(instellingen). Vermeld dit in de privacyvoorwaarden.
