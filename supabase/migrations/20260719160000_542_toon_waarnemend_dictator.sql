-- #542: cosmetische per-gebruiker weergavevoorkeur — toont het klassement de
-- waarnemend dictator (Kylian Mbappé bij verstek, #530) bovenaan zolang niemand
-- de El Padelissimo-tier (#527) haalt? Default 'true' = bestaand gedrag; elke
-- gebruiker kan 'm zelf wegklikken, cross-device.
--
-- Additief; geen nieuwe RLS/grant nodig — de self-update-policy op profiles
-- ("Gebruiker kan eigen profiel bijwerken") en de table-wide grants dekken de
-- nieuwe kolom al, net als bij roast_schild (20260711202439).
alter table "public"."profiles"
  add column "toon_waarnemend_dictator" boolean not null default true;