-- #554: AI dictator-portret uit de profielfoto (OpenAI gpt-image-1), lazy +
-- opt-out, getoond op De Troon (#528/#545) voor de echte dictator. Deze migratie
-- levert alleen het schema: de opt-out-vlag, de opslag-URL van het gegenereerde
-- portret en de bron-avatar waarop het gebaseerd is (voor invalidatie).
--
-- De edge function 'generate-dictator-avatar' (PR2) en de trigger-/UI-wiring
-- (PR3) bouwen hierop voort.

-- Opt-out (spiegelt toon_waarnemend_dictator, #542): staat 'ie uit, dan gaat de
-- foto nooit naar OpenAI en toont de troon de gewone avatar. Default 'true' =
-- bestaand gedrag mag; de gebruiker kan het zelf uitzetten. Client-schrijfbaar
-- via de bestaande self-update-policy + table-wide grant, net als #542.
alter table "public"."profiles"
  add column "dictator_portret" boolean not null default true;

-- Publieke URL van het gegenereerde portret (null = nog niet / vervallen), en de
-- avatar_url waarop het gebaseerd is (of de sentinel '__geen_avatar__' als de
-- gebruiker geen profielfoto had). Bij een fotowissel (bron != huidige
-- avatar_url) hoort het portret opnieuw gegenereerd te worden.
alter table "public"."profiles"
  add column "dictator_avatar_url" text;
alter table "public"."profiles"
  add column "dictator_avatar_bron" text;

-- Guard op de twee gegenereerde kolommen. De table-wide UPDATE-grant op profiles
-- laat een client élke eigen kolom schrijven; zonder deze guard kon een gebruiker
-- z'n troon-portret spoofen (willekeurige URL, opt-out omzeilen). Kolom-grants
-- zijn hier onhandig — dat zou een uitputtende kolomlijst vergen die elke latere
-- additieve migratie moet bijwerken (vgl. #432 op matches). Een before-update-
-- trigger doet het robuuster én regelt meteen de invalidatie bij een fotowissel.
--
-- SECURITY INVOKER (geen definer): zo weerspiegelt current_role de échte
-- aanroeper — 'service_role' voor de edge function, 'authenticated'/'anon' voor
-- een gewone client. De function raakt geen andere objecten aan, enkel NEW/OLD.
create function public.profiles_dictator_portret_guard()
  returns trigger
  language plpgsql
  set search_path = ''
as $$
begin
  if new.avatar_url is distinct from old.avatar_url then
    -- Nieuwe profielfoto => bestaand portret vervalt (moet opnieuw gegenereerd).
    -- Geldt voor iedereen, ook de eigenaar die z'n foto wisselt.
    new.dictator_avatar_url := null;
    new.dictator_avatar_bron := null;
  elsif current_role <> 'service_role' then
    -- Geen fotowissel en geen service-role: enkel de edge function mag het
    -- gegenereerde portret schrijven. Reset stiekeme client-writes naar OLD.
    new.dictator_avatar_url := old.dictator_avatar_url;
    new.dictator_avatar_bron := old.dictator_avatar_bron;
  end if;
  return new;
end;
$$;

create trigger profiles_dictator_portret_guard
  before update on public.profiles
  for each row execute function public.profiles_dictator_portret_guard();
