-- Roast-fundament (#183): per-groep roast-intensiteit + per-speler roast-schild.
-- Additief; geen nieuwe RLS nodig (owner-update op groups en self-update op
-- profiles dekken de nieuwe kolommen al).
--
-- NB: `supabase db diff` genereerde hier ook spurious drops/herbouw van de
-- standen-views (zónder security_invoker) en van storage-avatarpolicies. Die
-- zijn handmatig verwijderd — zie geheugen over db diff-ruis.

create type "public"."roast_intensiteit" as enum ('mild', 'gemeen', 'radioactief');

alter table "public"."groups"
  add column "roast_intensiteit" public.roast_intensiteit not null
  default 'gemeen'::public.roast_intensiteit;

alter table "public"."profiles"
  add column "roast_schild" boolean not null default false;
