# send-push — web-push-meldingen

Verstuurt push-meldingen bij drie events: nieuwe ronde in je groep, uitslag
van jouw match, en een inkomend vriendschapsverzoek.

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
     VAPID_SUBJECT="mailto:jouw@mailadres.tld"
   ```

3. **Functie deployen**:

   ```sh
   supabase functions deploy send-push --no-verify-jwt
   ```

4. **Webhooks aanmaken**: voer `supabase/snippets/push_webhooks.sql` uit in de
   SQL-editor van het gehoste project (vervang de placeholders), of maak
   dezelfde drie webhooks via Dashboard → Database → Webhooks.

5. **Frontend**: zet `VITE_VAPID_PUBLIC_KEY` (de publieke sleutel) als
   GitHub-secret zodat de deploy-workflow hem in de build meebakt.

Gebruikers zetten meldingen daarna zelf aan via Profiel → Meldingen.
iOS vereist een op het beginscherm geïnstalleerde PWA (iOS 16.4+).
