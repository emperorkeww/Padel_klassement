# send-push — web-push-meldingen

Verstuurt push-meldingen bij deze events: nieuwe ronde in je groep, uitslag
van jouw match, een inkomend vriendschapsverzoek, speeldag-polls (nieuw,
gelockt, geboekt) en een nieuwe pias-van-de-week (Coach Rudy plaagt de pias
zelf; roast-schild aan = geen push).

## Eenmalige setup (productie)

1. **VAPID-sleutels genereren** (of gebruik de al aangeleverde):

   ```sh
   npx web-push generate-vapid-keys
   ```

2. **Secrets zetten** op het gehoste project:

   ```sh
   supabase secrets set \
     VAPID_PUBLIC_KEY="<publieke sleutel>" \
     VAPID_PRIVATE_KEY="<privésleutel>" \
     VAPID_SUBJECT="mailto:jouw@mailadres.tld" \
     CRON_SECRET="<willekeurige-lange-string>"
   ```

   `CRON_SECRET` (#459) is het gedeelde geheim dat de webhook meestuurt als
   `x-cron-secret`; het is dezelfde secret als de cron-functies
   (match-reminders e.a.). De functie draait `--no-verify-jwt`, dus dit is de
   énige authenticatie: **fail-closed** — is de secret niet gezet of stuurt de
   aanroeper hem niet (juist) mee, dan antwoordt send-push met `401` en verstuurt
   niets. Zonder deze setup zou iedereen die de function-URL kent vervalste
   pushes kunnen laten sturen.

3. **Functie deployen**:

   ```sh
   supabase functions deploy send-push --no-verify-jwt
   ```

4. **Webhooks aanmaken**: voer `supabase/snippets/push_webhooks.sql` uit in de
   SQL-editor van het gehoste project (vervang `<PROJECT-REF>` én
   `<CRON-SECRET>`), of maak dezelfde webhooks via Dashboard → Database →
   Webhooks (voeg daar de header `x-cron-secret` toe). **Volgorde is kritisch
   door fail-closed:** zet eerst `CRON_SECRET` (stap 2) en deploy de functie
   (stap 3) — pas dán deze triggers met het geheim erin. Draait de trigger nog
   zónder (juiste) header, dan weigert send-push en komt er geen push aan. Voor
   de pias-triggers geldt bovendien: eerst de migratie (diff-recompute) en de
   functie deployen, dán pas de triggers aanmaken — anders vuurt elke uitslag ze af.

5. **Frontend**: zet `VITE_VAPID_PUBLIC_KEY` (de publieke sleutel) als
   GitHub-secret zodat de deploy-workflow hem in de build meebakt.

Gebruikers zetten meldingen daarna zelf aan via Profiel → Meldingen.
iOS vereist een op het beginscherm geïnstalleerde PWA (iOS 16.4+).
