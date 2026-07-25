-- #682: AI pias-portret voor De Schandpaal — de spiegel van het dictator-portret
-- (#554). Deze migratie levert alleen het schema: de opt-out-vlag, de opslag-URL
-- van het gegenereerde clownportret en de bron-avatar waarop het gebaseerd is
-- (voor invalidatie). De edge function 'generate-pias-avatar' en de trigger-/UI-
-- wiring bouwen hierop voort.

-- Opt-out (spiegelt dictator_portret): staat 'ie uit, dan gaat de foto nooit naar
-- OpenAI en toont de Schandpaal de gewone avatar. Default 'true' = bestaand
-- gedrag mag; de gebruiker zet het zelf uit in Instellingen.
alter table "public"."profiles"
  add column "pias_portret" boolean not null default true;

-- Publieke URL van het gegenereerde portret (null = nog niet / vervallen) en de
-- avatar_url waarop het gebaseerd is (of de sentinel '__geen_avatar__' zonder
-- profielfoto). Wijkt de bron af van de huidige avatar_url, dan is het portret
-- vervallen en hoort het opnieuw gegenereerd te worden.
alter table "public"."profiles"
  add column "pias_avatar_url" text;
alter table "public"."profiles"
  add column "pias_avatar_bron" text;

-- Kolom-grant (#465): pias_portret is de enige nieuwe kolom die de client zelf
-- schrijft (de opt-out-toggle). pias_avatar_url/-bron blijven buiten de grant —
-- die schrijft uitsluitend de edge function met de service-role. LET OP: `supabase
-- db diff` genereert géén kolom-grants (zie CLAUDE.md), dus deze lijst is handwerk
-- en staat identiek in schemas/policies/profiles.sql. Zonder deze regel faalt de
-- opt-out-toggle met 42501.
revoke update on table public.profiles from authenticated;
grant update (username, full_name, avatar_url, discoverable, allow_friend_requests,
              featured_badges, roast_schild, roast_intensiteit,
              toon_waarnemend_dictator, dictator_portret, pias_portret,
              notify_new_round, notify_result, notify_friend_request,
              notify_match_reminder, notify_rank_change)
  on table public.profiles to authenticated;

-- Eén gedeelde guard i.p.v. een tweede kopie: profiles_dictator_portret_guard
-- (#554) wordt profiles_ai_portret_guard en dekt beide portretsets. Twee guards
-- met bijna-gelijke regels op dezelfde tabel is een bug-magneet — dan divergeren
-- ze bij de eerste wijziging die er maar één raakt.
--
-- Nieuw t.o.v. #554: een opt-out nult het bewaarde portret. "Zet uit" betekende
-- eerder alleen "niet meer tonen", terwijl de URL bleef staan; nu verdwijnt hij.
-- Gevolg: wie de opt-out uit- en weer aanzet, laat één nieuwe generatie maken —
-- bewust, want een bewaarde-maar-onzichtbare portret-URL is precies wat een
-- opt-out níet hoort te betekenen. Het PNG in de storage-bucket blijft staan;
-- daar is de bucket-cleanup voor (buiten deze migratie).
--
-- SECURITY INVOKER (geen definer), net als #554: zo weerspiegelt current_role de
-- échte aanroeper — 'service_role' voor de edge functions, 'authenticated'/'anon'
-- voor een gewone client. De function raakt geen andere objecten aan, enkel
-- NEW/OLD.
drop trigger if exists profiles_dictator_portret_guard on public.profiles;
drop function if exists public.profiles_dictator_portret_guard();

create function public.profiles_ai_portret_guard()
  returns trigger
  language plpgsql
  set search_path = ''
as $$
begin
  if new.avatar_url is distinct from old.avatar_url then
    -- Nieuwe profielfoto => beide portretten vervallen (opnieuw genereren).
    -- Geldt voor iedereen, ook de eigenaar die z'n foto wisselt.
    new.dictator_avatar_url := null;
    new.dictator_avatar_bron := null;
    new.pias_avatar_url := null;
    new.pias_avatar_bron := null;
  elsif current_role <> 'service_role' then
    -- Geen fotowissel en geen service-role: enkel de edge functions mogen de
    -- gegenereerde portretten schrijven. Reset stiekeme client-writes naar OLD.
    -- De kolom-grant hierboven weigert zulke writes al met 42501; dit is de
    -- tweede laag, die ook geldt voor rollen die de grant ooit wél krijgen.
    new.dictator_avatar_url := old.dictator_avatar_url;
    new.dictator_avatar_bron := old.dictator_avatar_bron;
    new.pias_avatar_url := old.pias_avatar_url;
    new.pias_avatar_bron := old.pias_avatar_bron;
  end if;
  -- Opt-out nult wat er staat, ongeacht wie de update doet: uit = weg.
  if new.dictator_portret is false then
    new.dictator_avatar_url := null;
    new.dictator_avatar_bron := null;
  end if;
  if new.pias_portret is false then
    new.pias_avatar_url := null;
    new.pias_avatar_bron := null;
  end if;
  return new;
end;
$$;

create trigger profiles_ai_portret_guard
  before update on public.profiles
  for each row execute function public.profiles_ai_portret_guard();
