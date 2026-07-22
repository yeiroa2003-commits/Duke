-- ============================================================
-- DUKE - ESQUEMA COMPLETO PARA NEON POSTGRESQL
-- ============================================================
-- Ejecuta este archivo UNA SOLA VEZ en:
-- Neon Console > SQL Editor > New query > Run
--
-- IMPORTANTE:
-- Neon es solamente la base de datos PostgreSQL.
-- El navegador NO debe conectarse directamente usando DATABASE_URL.
-- La aplicación debe usar una API/backend (por ejemplo, Vercel Functions)
-- para proteger la contraseña de conexión y validar permisos.
--
-- Las fotos y audios deben guardarse en un servicio de archivos
-- (Vercel Blob, Cloudinary, UploadThing, S3, etc.). En Neon se guardan
-- únicamente la URL y la clave del archivo.
-- ============================================================

begin;

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- Función común para updated_at
-- ------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ------------------------------------------------------------
-- USUARIOS Y SESIONES
-- Neon no incluye autenticación; estas tablas permiten implementarla
-- desde una API segura.
-- ------------------------------------------------------------
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  password_hash text not null,
  display_name varchar(40) not null,
  avatar varchar(12) not null default 'D',
  mood_text varchar(50) not null default 'Feliz',
  mood_emoji varchar(12) not null default '😊',
  email_verified boolean not null default false,
  is_active boolean not null default true,
  last_seen timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint users_email_not_blank check (length(trim(email)) >= 5),
  constraint users_password_hash_not_blank check (length(password_hash) >= 20),
  constraint users_display_name_not_blank check (length(trim(display_name)) >= 1)
);

create unique index if not exists users_email_unique_idx
  on public.users (lower(email));

drop trigger if exists users_updated_at on public.users;
create trigger users_updated_at
before update on public.users
for each row execute function public.set_updated_at();

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  token_hash text not null unique,
  user_agent text,
  ip_address inet,
  expires_at timestamptz not null,
  last_used_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint sessions_token_hash_not_blank check (length(token_hash) >= 32)
);

create index if not exists sessions_user_idx
  on public.sessions (user_id, expires_at desc);

create index if not exists sessions_active_idx
  on public.sessions (token_hash)
  where revoked_at is null;

-- ------------------------------------------------------------
-- ESPACIO PRIVADO DE LA PAREJA
-- ------------------------------------------------------------
create table if not exists public.couples (
  id uuid primary key default gen_random_uuid(),
  name varchar(60) not null,
  invite_code varchar(11) not null unique,
  pin_hash text not null,
  relationship_date date,
  created_by uuid not null references public.users(id) on delete cascade,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint couples_name_not_blank check (length(trim(name)) >= 2),
  constraint couples_invite_code_format check (invite_code ~ '^DUKE-[A-Z0-9]{6}$'),
  constraint couples_pin_hash_not_blank check (length(pin_hash) >= 20)
);

drop trigger if exists couples_updated_at on public.couples;
create trigger couples_updated_at
before update on public.couples
for each row execute function public.set_updated_at();

create table if not exists public.couple_members (
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role varchar(20) not null default 'partner'
    check (role in ('owner', 'partner')),
  joined_at timestamptz not null default now(),
  primary key (couple_id, user_id),
  unique (user_id)
);

create index if not exists couple_members_couple_idx
  on public.couple_members (couple_id, joined_at);

-- Impide que entren más de dos personas a un espacio.
create or replace function public.enforce_two_couple_members()
returns trigger
language plpgsql
as $$
declare
  v_count integer;
begin
  perform 1
  from public.couples
  where id = new.couple_id
  for update;

  select count(*)
  into v_count
  from public.couple_members
  where couple_id = new.couple_id;

  if v_count >= 2 then
    raise exception 'DUKE_SPACE_FULL';
  end if;

  return new;
end;
$$;

drop trigger if exists couple_members_limit_two on public.couple_members;
create trigger couple_members_limit_two
before insert on public.couple_members
for each row execute function public.enforce_two_couple_members();

-- ------------------------------------------------------------
-- PRESENCIA Y ESTADO EN LÍNEA
-- ------------------------------------------------------------
create table if not exists public.presence (
  user_id uuid primary key references public.users(id) on delete cascade,
  couple_id uuid not null references public.couples(id) on delete cascade,
  status varchar(20) not null default 'offline'
    check (status in ('online', 'away', 'busy', 'offline')),
  is_typing boolean not null default false,
  current_view varchar(30),
  last_seen timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists presence_couple_idx
  on public.presence (couple_id, status);

drop trigger if exists presence_updated_at on public.presence;
create trigger presence_updated_at
before update on public.presence
for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- CHAT Y REACCIONES
-- ------------------------------------------------------------
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  sender_id uuid not null references public.users(id) on delete cascade,
  body text not null default '',
  message_type varchar(20) not null default 'text'
    check (message_type in ('text', 'image', 'audio', 'video', 'file', 'system')),
  media_url text,
  storage_key text,
  reply_to uuid references public.messages(id) on delete set null,
  reply_preview text,
  edited_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  constraint messages_have_content check (
    length(trim(body)) > 0
    or media_url is not null
    or message_type = 'system'
  )
);

create index if not exists messages_couple_created_idx
  on public.messages (couple_id, created_at desc);

create index if not exists messages_sender_idx
  on public.messages (sender_id, created_at desc);

create table if not exists public.message_reads (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

create table if not exists public.message_reactions (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  emoji varchar(12) not null,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);

-- ------------------------------------------------------------
-- RECUERDOS Y FECHAS ESPECIALES
-- ------------------------------------------------------------
create table if not exists public.memories (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  title varchar(100) not null,
  description text not null default '',
  memory_date date,
  media_url text,
  storage_key text,
  is_favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint memories_title_not_blank check (length(trim(title)) >= 1)
);

create index if not exists memories_couple_date_idx
  on public.memories (couple_id, memory_date desc nulls last, created_at desc);

drop trigger if exists memories_updated_at on public.memories;
create trigger memories_updated_at
before update on public.memories
for each row execute function public.set_updated_at();

create table if not exists public.special_dates (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  created_by uuid not null references public.users(id) on delete cascade,
  title varchar(80) not null,
  event_date date not null,
  repeats_yearly boolean not null default false,
  reminder_days_before smallint not null default 1
    check (reminder_days_before between 0 and 365),
  created_at timestamptz not null default now(),
  constraint special_dates_title_not_blank check (length(trim(title)) >= 1)
);

create index if not exists special_dates_couple_date_idx
  on public.special_dates (couple_id, event_date);

-- ------------------------------------------------------------
-- JUEGOS
-- ------------------------------------------------------------
create table if not exists public.game_states (
  couple_id uuid not null references public.couples(id) on delete cascade,
  game_type varchar(30) not null
    check (game_type in ('tictactoe', 'questions', 'roulette', 'truth_or_dare')),
  state jsonb not null default '{}'::jsonb,
  updated_by uuid not null references public.users(id) on delete cascade,
  version integer not null default 1,
  updated_at timestamptz not null default now(),
  primary key (couple_id, game_type)
);

create index if not exists game_states_updated_idx
  on public.game_states (couple_id, updated_at desc);

drop trigger if exists game_states_updated_at on public.game_states;
create trigger game_states_updated_at
before update on public.game_states
for each row execute function public.set_updated_at();

create table if not exists public.question_answers (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  question_key varchar(80) not null,
  question_text text not null,
  user_id uuid not null references public.users(id) on delete cascade,
  answer text not null,
  round_id uuid not null default gen_random_uuid(),
  revealed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (couple_id, question_key, round_id, user_id)
);

create index if not exists question_answers_round_idx
  on public.question_answers (couple_id, round_id, created_at);

-- ------------------------------------------------------------
-- LLAMADAS Y NOTIFICACIONES
-- ------------------------------------------------------------
create table if not exists public.calls (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  started_by uuid not null references public.users(id) on delete cascade,
  call_type varchar(10) not null check (call_type in ('audio', 'video')),
  provider varchar(30) not null default 'jitsi',
  room_name text not null,
  status varchar(20) not null default 'ringing'
    check (status in ('ringing', 'active', 'declined', 'missed', 'ended')),
  started_at timestamptz not null default now(),
  answered_at timestamptz,
  ended_at timestamptz
);

create index if not exists calls_couple_started_idx
  on public.calls (couple_id, started_at desc);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  sender_id uuid references public.users(id) on delete cascade,
  recipient_id uuid not null references public.users(id) on delete cascade,
  notification_type varchar(30) not null
    check (notification_type in (
      'message', 'missing_you', 'incoming_call', 'memory',
      'special_date', 'game', 'system'
    )),
  title varchar(100) not null,
  body text not null default '',
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_recipient_idx
  on public.notifications (recipient_id, read_at, created_at desc);

-- ------------------------------------------------------------
-- ACTIVIDAD Y RACHA
-- ------------------------------------------------------------
create table if not exists public.daily_activity (
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  activity_date date not null default current_date,
  messages_count integer not null default 0 check (messages_count >= 0),
  memories_count integer not null default 0 check (memories_count >= 0),
  games_count integer not null default 0 check (games_count >= 0),
  calls_count integer not null default 0 check (calls_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (couple_id, user_id, activity_date)
);

-- ------------------------------------------------------------
-- AJUSTES DEL ESPACIO
-- ------------------------------------------------------------
create table if not exists public.couple_settings (
  couple_id uuid primary key references public.couples(id) on delete cascade,
  theme_name varchar(30) not null default 'duke',
  primary_color varchar(20) not null default '#7c3aed',
  secondary_color varchar(20) not null default '#2563eb',
  dark_color varchar(20) not null default '#05040a',
  light_color varchar(20) not null default '#ffffff',
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

drop trigger if exists couple_settings_updated_at on public.couple_settings;
create trigger couple_settings_updated_at
before update on public.couple_settings
for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- FUNCIONES DE AUTENTICACIÓN
-- Deben ser llamadas exclusivamente desde el backend.
-- ------------------------------------------------------------
create or replace function public.create_duke_user(
  p_email text,
  p_password text,
  p_display_name text
)
returns table (
  user_id uuid,
  email text,
  display_name varchar,
  avatar varchar
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user public.users;
  v_email text := lower(trim(p_email));
  v_name text := trim(p_display_name);
begin
  if length(v_email) < 5 or position('@' in v_email) < 2 then
    raise exception 'INVALID_EMAIL';
  end if;

  if length(coalesce(p_password, '')) < 6 then
    raise exception 'PASSWORD_TOO_SHORT';
  end if;

  if length(v_name) < 1 then
    raise exception 'DISPLAY_NAME_REQUIRED';
  end if;

  insert into public.users (
    email,
    password_hash,
    display_name,
    avatar
  )
  values (
    v_email,
    crypt(p_password, gen_salt('bf', 10)),
    v_name,
    upper(left(v_name, 1))
  )
  returning * into v_user;

  return query
  select v_user.id, v_user.email, v_user.display_name, v_user.avatar;

exception
  when unique_violation then
    raise exception 'EMAIL_ALREADY_EXISTS';
end;
$$;

create or replace function public.authenticate_duke_user(
  p_email text,
  p_password text
)
returns table (
  user_id uuid,
  email text,
  display_name varchar,
  avatar varchar,
  couple_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    u.id,
    u.email,
    u.display_name,
    u.avatar,
    cm.couple_id
  from public.users u
  left join public.couple_members cm on cm.user_id = u.id
  where lower(u.email) = lower(trim(p_email))
    and u.is_active = true
    and u.password_hash = crypt(p_password, u.password_hash)
  limit 1;
end;
$$;

-- ------------------------------------------------------------
-- FUNCIONES DEL ESPACIO DUKE
-- ------------------------------------------------------------
create or replace function public.is_duke_member(
  p_user_id uuid,
  p_couple_id uuid
)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.couple_members
    where user_id = p_user_id
      and couple_id = p_couple_id
  );
$$;

create or replace function public.shares_duke_with(
  p_user_id uuid,
  p_other_user_id uuid
)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.couple_members mine
    join public.couple_members theirs
      on theirs.couple_id = mine.couple_id
    where mine.user_id = p_user_id
      and theirs.user_id = p_other_user_id
  );
$$;

create or replace function public.create_duke_couple(
  p_user_id uuid,
  p_name text,
  p_relationship_date date,
  p_pin text
)
returns table (
  couple_id uuid,
  couple_name varchar,
  invite_code varchar,
  relationship_date date
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_couple public.couples;
  v_code text;
begin
  if not exists (
    select 1 from public.users
    where id = p_user_id and is_active = true
  ) then
    raise exception 'USER_NOT_FOUND';
  end if;

  if exists (
    select 1 from public.couple_members
    where user_id = p_user_id
  ) then
    raise exception 'USER_ALREADY_HAS_DUKE';
  end if;

  if length(trim(coalesce(p_name, ''))) < 2 then
    raise exception 'COUPLE_NAME_REQUIRED';
  end if;

  if coalesce(p_pin, '') !~ '^[0-9]{4,8}$' then
    raise exception 'INVALID_PIN';
  end if;

  loop
    v_code := 'DUKE-' || upper(encode(gen_random_bytes(3), 'hex'));
    exit when not exists (
      select 1
      from public.couples c
      where c.invite_code = v_code
    );
  end loop;

  insert into public.couples (
    name,
    invite_code,
    pin_hash,
    relationship_date,
    created_by
  )
  values (
    trim(p_name),
    v_code,
    crypt(p_pin, gen_salt('bf', 10)),
    p_relationship_date,
    p_user_id
  )
  returning * into v_couple;

  insert into public.couple_members (couple_id, user_id, role)
  values (v_couple.id, p_user_id, 'owner');

  insert into public.couple_settings (couple_id)
  values (v_couple.id)
  on conflict (couple_id) do nothing;

  insert into public.presence (user_id, couple_id)
  values (p_user_id, v_couple.id)
  on conflict (user_id) do update
    set couple_id = excluded.couple_id,
        updated_at = now();

  return query
  select
    v_couple.id,
    v_couple.name,
    v_couple.invite_code,
    v_couple.relationship_date;
end;
$$;

create or replace function public.join_duke_couple(
  p_user_id uuid,
  p_invite_code text,
  p_pin text
)
returns table (
  couple_id uuid,
  couple_name varchar,
  invite_code varchar,
  relationship_date date
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_couple public.couples;
begin
  if not exists (
    select 1 from public.users
    where id = p_user_id and is_active = true
  ) then
    raise exception 'USER_NOT_FOUND';
  end if;

  if exists (
    select 1 from public.couple_members
    where user_id = p_user_id
  ) then
    raise exception 'USER_ALREADY_HAS_DUKE';
  end if;

  select c.*
  into v_couple
  from public.couples c
  where upper(c.invite_code) = upper(trim(p_invite_code))
    and c.is_active = true
    and c.pin_hash = crypt(p_pin, c.pin_hash)
  for update;

  if v_couple.id is null then
    raise exception 'INVALID_CODE_OR_PIN';
  end if;

  insert into public.couple_members (couple_id, user_id, role)
  values (v_couple.id, p_user_id, 'partner');

  insert into public.presence (user_id, couple_id)
  values (p_user_id, v_couple.id)
  on conflict (user_id) do update
    set couple_id = excluded.couple_id,
        updated_at = now();

  return query
  select
    v_couple.id,
    v_couple.name,
    v_couple.invite_code,
    v_couple.relationship_date;
end;
$$;

create or replace function public.get_duke_for_user(
  p_user_id uuid
)
returns table (
  couple_id uuid,
  couple_name varchar,
  invite_code varchar,
  relationship_date date,
  member_count bigint
)
language sql
stable
as $$
  select
    c.id,
    c.name,
    c.invite_code,
    c.relationship_date,
    (
      select count(*)
      from public.couple_members x
      where x.couple_id = c.id
    )
  from public.couples c
  join public.couple_members cm
    on cm.couple_id = c.id
  where cm.user_id = p_user_id
    and c.is_active = true
  limit 1;
$$;

create or replace function public.get_duke_members(
  p_user_id uuid,
  p_couple_id uuid
)
returns table (
  user_id uuid,
  display_name varchar,
  avatar varchar,
  mood_text varchar,
  mood_emoji varchar,
  last_seen timestamptz,
  role varchar
)
language plpgsql
stable
as $$
begin
  if not public.is_duke_member(p_user_id, p_couple_id) then
    raise exception 'NOT_A_DUKE_MEMBER';
  end if;

  return query
  select
    u.id,
    u.display_name,
    u.avatar,
    u.mood_text,
    u.mood_emoji,
    u.last_seen,
    cm.role
  from public.couple_members cm
  join public.users u on u.id = cm.user_id
  where cm.couple_id = p_couple_id
  order by cm.joined_at;
end;
$$;

-- ------------------------------------------------------------
-- FUNCIÓN DE ACTIVIDAD
-- ------------------------------------------------------------
create or replace function public.record_duke_activity(
  p_user_id uuid,
  p_couple_id uuid,
  p_activity varchar
)
returns void
language plpgsql
as $$
begin
  if not public.is_duke_member(p_user_id, p_couple_id) then
    raise exception 'NOT_A_DUKE_MEMBER';
  end if;

  insert into public.daily_activity (
    couple_id,
    user_id,
    activity_date,
    messages_count,
    memories_count,
    games_count,
    calls_count
  )
  values (
    p_couple_id,
    p_user_id,
    current_date,
    case when p_activity = 'message' then 1 else 0 end,
    case when p_activity = 'memory' then 1 else 0 end,
    case when p_activity = 'game' then 1 else 0 end,
    case when p_activity = 'call' then 1 else 0 end
  )
  on conflict (couple_id, user_id, activity_date)
  do update set
    messages_count = public.daily_activity.messages_count
      + case when p_activity = 'message' then 1 else 0 end,
    memories_count = public.daily_activity.memories_count
      + case when p_activity = 'memory' then 1 else 0 end,
    games_count = public.daily_activity.games_count
      + case when p_activity = 'game' then 1 else 0 end,
    calls_count = public.daily_activity.calls_count
      + case when p_activity = 'call' then 1 else 0 end,
    updated_at = now();
end;
$$;

-- ------------------------------------------------------------
-- LIMPIEZA DE SESIONES VENCIDAS
-- ------------------------------------------------------------
create or replace function public.cleanup_expired_sessions()
returns integer
language plpgsql
as $$
declare
  v_deleted integer;
begin
  delete from public.sessions
  where expires_at < now()
     or revoked_at is not null;

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

-- ------------------------------------------------------------
-- VISTA SEGURA DE PERFILES DE PAREJA
-- ------------------------------------------------------------
create or replace view public.duke_member_profiles as
select
  cm.couple_id,
  u.id as user_id,
  u.display_name,
  u.avatar,
  u.mood_text,
  u.mood_emoji,
  u.last_seen,
  cm.role,
  cm.joined_at
from public.couple_members cm
join public.users u on u.id = cm.user_id
where u.is_active = true;

commit;

-- ============================================================
-- FIN DEL ESQUEMA
-- ============================================================
