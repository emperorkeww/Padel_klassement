-- Persoonlijke roast-intensiteit (#183): een per-speler intensiteit op het
-- profiel, die de feed en het dashboard kleurt. Naast de bestaande per-groep
-- intensiteit (door de eigenaar gezet) en het roast-schild (harde opt-out).
--
-- Additief; geen nieuwe RLS/grants nodig — de bestaande self-update op profiles
-- dekt de kolom al, net als roast_schild uit 20260711202439. Het enum-type
-- public.roast_intensiteit bestaat al sinds diezelfde migratie en wordt hier
-- hergebruikt.

alter table "public"."profiles"
  add column "roast_intensiteit" public.roast_intensiteit not null
  default 'gemeen'::public.roast_intensiteit;
