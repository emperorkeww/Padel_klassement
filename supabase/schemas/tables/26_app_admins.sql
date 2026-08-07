-- Beheer op appniveau (#1036). Tot nu toe kende de app maar één rol:
-- groepseigenaar (groups.created_by + public.is_group_owner()). Dat regelt wie
-- een lid uit een groep mag zetten en verder niets — er was geen enkele manier
-- om een gebruiker die niet meer binnenkomt te helpen zonder het Supabase-
-- dashboard te openen.
--
-- Bewust een aparte tabel en géén vlag op profiles: die tabel wordt door de
-- client geschreven (updateProfile/updatePrivacy/…) en is publiek leesbaar. Een
-- rol als kolom zou meeliften op een profielupdate zodra iemand de kolomgrant
-- van #465 ooit verruimt, en aan de hele app verraden wie beheerder is. Als
-- eigen tabel staat de rol los van elk clientpad.
create table public.app_admins (
  user_id uuid primary key references auth.users on delete cascade,
  -- Waarom deze persoon beheerder is; puur voor jezelf over een jaar.
  note text,
  added_at timestamptz not null default now()
);

-- Spoor van elke actie die iets aan een account verandert. Niet onderhandelbaar
-- zodra je wachtwoorden van anderen kunt zetten: zonder logboek is "ik heb dat
-- niet gedaan" niet te weerleggen, ook niet door de beheerder zelf.
--
-- Bewust géén foreign keys op actor_id/target_user_id. Een auditrij moet juist
-- blijven staan als het doelaccount verdwijnt — dat is de interessantste rij
-- van allemaal, en een cascade zou het bewijs mee de afgrond in nemen.
create table public.admin_audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid not null,
  action text not null,
  target_user_id uuid,
  -- Waar de actie over ging, als het geen gebruiker was (#1159): 'match',
  -- 'group' of 'poll'. Losse kolommen en geen sleutel in `details`, want dit is
  -- het enige waarop je het logboek wilt kunnen doorzoeken — "wat is er met
  -- déze match gebeurd" moet een index kunnen gebruiken en niet een jsonb-scan.
  -- Null voor de accountacties uit #1036: daar is target_user_id het doel.
  target_type text check (target_type is null or target_type in ('match', 'group', 'poll')),
  target_id uuid,
  -- Context van de actie. NOOIT het uitgedeelde wachtwoord of de herstel-link
  -- zelf: enkel dát er één is uitgegeven, door wie en voor wie. De edge
  -- function is de enige schrijver en bewaakt dat.
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- De hoofdquery is "wat is er met deze gebruiker gebeurd", nieuwste eerst.
create index admin_audit_log_target_idx
  on public.admin_audit_log (target_user_id, created_at desc);

-- Idem voor de inhoudsacties (#1159): "wat is er met deze match gebeurd".
create index admin_audit_log_object_idx
  on public.admin_audit_log (target_type, target_id, created_at desc);
