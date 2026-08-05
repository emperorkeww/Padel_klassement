-- RLS voor de admintabellen (#1036).
--
-- Deze twee tabellen zijn de enige in het schema die de client NOOIT ziet. Geen
-- policy voor authenticated of anon, en geen regel in zz_client_read_grants.sql:
-- alles loopt via de edge function `admin-users` met de service-role-client, die
-- RLS sowieso omzeilt.
--
-- RLS staat aan zonder policies, en dat is opzet en geen vergetelheid: "geen
-- policy" betekent voor PostgREST "geen enkele rij", wat precies de bedoeling
-- is. De grant-revokes eronder zijn de tweede laag — PostgREST heeft naast een
-- policy óók een tabelgrant nodig, dus zonder grant is er zelfs geen pad om te
-- proberen. Supabase geeft nieuwe tabellen standaard grants aan authenticated
-- en anon mee (default privileges), vandaar dat het expliciet weggenomen moet
-- worden in plaats van weggelaten.
--
-- Niemand kan zichzelf beheerder maken: de eerste beheerder wordt met de hand
-- in de SQL-editor gezet (het commando staat in README.md), verdere beheerders
-- alleen door een bestaande beheerder via de edge function.
alter table public.app_admins enable row level security;
alter table public.admin_audit_log enable row level security;

revoke all on table public.app_admins from authenticated, anon;
revoke all on table public.admin_audit_log from authenticated, anon;
