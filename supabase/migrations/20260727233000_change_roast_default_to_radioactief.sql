-- Wijzig de default roast-intensiteit naar 'radioactief' (#183):
-- Zorg ervoor dat Coach Rudy standaard veel snerigser en gemener is door de gehele app.

alter table "public"."groups"
  alter column "roast_intensiteit" set default 'radioactief'::public.roast_intensiteit;

alter table "public"."profiles"
  alter column "roast_intensiteit" set default 'radioactief'::public.roast_intensiteit;

-- Update bestaande groepen en profielen die op de oude default 'gemeen' stonden naar de nieuwe default 'radioactief'.
update "public"."groups"
  set "roast_intensiteit" = 'radioactief'::public.roast_intensiteit
  where "roast_intensiteit" = 'gemeen'::public.roast_intensiteit;

update "public"."profiles"
  set "roast_intensiteit" = 'radioactief'::public.roast_intensiteit
  where "roast_intensiteit" = 'gemeen'::public.roast_intensiteit;
