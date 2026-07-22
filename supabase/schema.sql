-- Duke: esquema completo para Supabase
-- Ejecuta este archivo una sola vez desde SQL Editor en un proyecto nuevo.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Duke',
  avatar text not null default 'D',
  mood_text text not null default 'Feliz',
  mood_emoji text not null default '😊',
  last_seen timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.couples (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique,
  pin_hash text not null,
  relationship_date date,
  created_by uuid not null references public.profiles(user_id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.couple_members (
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (couple_id, user_id),
  unique (user_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  sender_id uuid not null references public.profiles(user_id) on delete cascade,
  body text not null default '',
  message_type text not null default 'text' check (message_type in ('text', 'image', 'system')),
  media_path text,
  reply_to uuid references public.messages(id) on delete set null,
  reply_preview text,
  created_at timestamptz not null default now()
);

create index if not exists messages_couple_created_idx on public.messages(couple_id, created_at);

create table if not exists public.memories (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  title text not null,
  description text not null default '',
  memory_date date,
  media_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists memories_couple_date_idx on public.memories(couple_id, memory_date desc);

create table if not exists public.special_dates (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  created_by uuid not null references public.profiles(user_id) on delete cascade,
  title text not null,
  event_date date not null,
  created_at timestamptz not null default now()
);

create index if not exists special_dates_couple_date_idx on public.special_dates(couple_id, event_date);

create table if not exists public.game_states (
  couple_id uuid not null references public.couples(id) on delete cascade,
  game_type text not null check (game_type in ('tictactoe', 'questions', 'roulette')),
  state jsonb not null default '{}'::jsonb,
  updated_by uuid not null references public.profiles(user_id) on delete cascade,
  updated_at timestamptz not null default now(),
  primary key (couple_id, game_type)
);

-- Funciones auxiliares seguras para RLS (evitan recursión en couple_members).
create or replace function public.is_duke_member(p_couple_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.couple_members
    where couple_id = p_couple_id and user_id = auth.uid()
  );
$$;

create or replace function public.shares_duke_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.couple_members mine
    join public.couple_members theirs on theirs.couple_id = mine.couple_id
    where mine.user_id = auth.uid() and theirs.user_id = p_user_id
  );
$$;

revoke all on function public.is_duke_member(uuid) from public;
revoke all on function public.shares_duke_with(uuid) from public;
grant execute on function public.is_duke_member(uuid) to authenticated;
grant execute on function public.shares_duke_with(uuid) to authenticated;

-- Perfil automático al crear una cuenta.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, display_name, avatar)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'display_name', ''), split_part(new.email, '@', 1), 'Duke'),
    coalesce(nullif(new.raw_user_meta_data->>'avatar', ''), upper(left(coalesce(new.raw_user_meta_data->>'display_name', 'D'), 1)), 'D')
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles
for each row execute procedure public.set_updated_at();

drop trigger if exists couples_updated_at on public.couples;
create trigger couples_updated_at before update on public.couples
for each row execute procedure public.set_updated_at();

drop trigger if exists memories_updated_at on public.memories;
create trigger memories_updated_at before update on public.memories
for each row execute procedure public.set_updated_at();

-- Crea un espacio y devuelve el registro creado.
create or replace function public.create_duke_couple(
  p_name text,
  p_relationship_date date,
  p_pin_hash text
)
returns setof public.couples
language plpgsql
security definer
set search_path = public
as $$
declare
  v_couple public.couples;
  v_code text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if exists (select 1 from public.couple_members where user_id = auth.uid()) then
    raise exception 'User already belongs to a Duke space';
  end if;

  if length(trim(coalesce(p_name, ''))) < 2 then
    raise exception 'A name is required';
  end if;

  if length(coalesce(p_pin_hash, '')) <> 64 then
    raise exception 'Invalid PIN';
  end if;

  loop
    v_code := 'DUKE-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    exit when not exists (select 1 from public.couples where invite_code = v_code);
  end loop;

  insert into public.couples (name, invite_code, pin_hash, relationship_date, created_by)
  values (trim(p_name), v_code, p_pin_hash, p_relationship_date, auth.uid())
  returning * into v_couple;

  insert into public.couple_members (couple_id, user_id)
  values (v_couple.id, auth.uid());

  return next v_couple;
end;
$$;

-- Une la segunda cuenta validando código, PIN y límite de dos integrantes.
create or replace function public.join_duke_couple(
  p_invite_code text,
  p_pin_hash text
)
returns setof public.couples
language plpgsql
security definer
set search_path = public
as $$
declare
  v_couple public.couples;
  v_count integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if exists (select 1 from public.couple_members where user_id = auth.uid()) then
    raise exception 'User already belongs to a Duke space';
  end if;

  select * into v_couple
  from public.couples
  where upper(invite_code) = upper(trim(p_invite_code))
    and pin_hash = p_pin_hash
  for update;

  if v_couple.id is null then
    raise exception 'Invalid invite code or PIN';
  end if;

  select count(*) into v_count from public.couple_members where couple_id = v_couple.id;
  if v_count >= 2 then
    raise exception 'This Duke space already has two members';
  end if;

  insert into public.couple_members (couple_id, user_id)
  values (v_couple.id, auth.uid());

  return next v_couple;
end;
$$;

revoke all on function public.create_duke_couple(text, date, text) from public;
revoke all on function public.join_duke_couple(text, text) from public;
grant execute on function public.create_duke_couple(text, date, text) to authenticated;
grant execute on function public.join_duke_couple(text, text) to authenticated;

-- Row Level Security.
alter table public.profiles enable row level security;
alter table public.couples enable row level security;
alter table public.couple_members enable row level security;
alter table public.messages enable row level security;
alter table public.memories enable row level security;
alter table public.special_dates enable row level security;
alter table public.game_states enable row level security;

-- Limpia políticas para permitir ejecutar nuevamente el script.
drop policy if exists "profiles_select_duke" on public.profiles;
drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_select_duke" on public.profiles for select to authenticated
using (user_id = auth.uid() or public.shares_duke_with(user_id));
create policy "profiles_update_self" on public.profiles for update to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "couples_select_members" on public.couples;
create policy "couples_select_members" on public.couples for select to authenticated
using (public.is_duke_member(id));

drop policy if exists "members_select_same_duke" on public.couple_members;
create policy "members_select_same_duke" on public.couple_members for select to authenticated
using (public.is_duke_member(couple_id));

drop policy if exists "messages_select_members" on public.messages;
drop policy if exists "messages_insert_self" on public.messages;
drop policy if exists "messages_delete_self" on public.messages;
create policy "messages_select_members" on public.messages for select to authenticated
using (public.is_duke_member(couple_id));
create policy "messages_insert_self" on public.messages for insert to authenticated
with check (public.is_duke_member(couple_id) and sender_id = auth.uid());
create policy "messages_delete_self" on public.messages for delete to authenticated
using (public.is_duke_member(couple_id) and sender_id = auth.uid());

drop policy if exists "memories_select_members" on public.memories;
drop policy if exists "memories_insert_self" on public.memories;
drop policy if exists "memories_update_self" on public.memories;
drop policy if exists "memories_delete_members" on public.memories;
create policy "memories_select_members" on public.memories for select to authenticated
using (public.is_duke_member(couple_id));
create policy "memories_insert_self" on public.memories for insert to authenticated
with check (public.is_duke_member(couple_id) and user_id = auth.uid());
create policy "memories_update_self" on public.memories for update to authenticated
using (public.is_duke_member(couple_id) and user_id = auth.uid())
with check (public.is_duke_member(couple_id) and user_id = auth.uid());
create policy "memories_delete_members" on public.memories for delete to authenticated
using (public.is_duke_member(couple_id));

drop policy if exists "dates_select_members" on public.special_dates;
drop policy if exists "dates_insert_self" on public.special_dates;
drop policy if exists "dates_delete_members" on public.special_dates;
create policy "dates_select_members" on public.special_dates for select to authenticated
using (public.is_duke_member(couple_id));
create policy "dates_insert_self" on public.special_dates for insert to authenticated
with check (public.is_duke_member(couple_id) and created_by = auth.uid());
create policy "dates_delete_members" on public.special_dates for delete to authenticated
using (public.is_duke_member(couple_id));

drop policy if exists "games_select_members" on public.game_states;
drop policy if exists "games_insert_members" on public.game_states;
drop policy if exists "games_update_members" on public.game_states;
create policy "games_select_members" on public.game_states for select to authenticated
using (public.is_duke_member(couple_id));
create policy "games_insert_members" on public.game_states for insert to authenticated
with check (public.is_duke_member(couple_id) and updated_by = auth.uid());
create policy "games_update_members" on public.game_states for update to authenticated
using (public.is_duke_member(couple_id))
with check (public.is_duke_member(couple_id) and updated_by = auth.uid());

-- Bucket privado para fotos del chat y recuerdos.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('duke-media', 'duke-media', false, 7340032, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "duke_media_select" on storage.objects;
drop policy if exists "duke_media_insert" on storage.objects;
drop policy if exists "duke_media_delete" on storage.objects;
create policy "duke_media_select" on storage.objects for select to authenticated
using (
  bucket_id = 'duke-media'
  and array_length(storage.foldername(name), 1) >= 1
  and public.is_duke_member(((storage.foldername(name))[1])::uuid)
);
create policy "duke_media_insert" on storage.objects for insert to authenticated
with check (
  bucket_id = 'duke-media'
  and array_length(storage.foldername(name), 1) >= 2
  and public.is_duke_member(((storage.foldername(name))[1])::uuid)
  and ((storage.foldername(name))[2])::uuid = auth.uid()
);
create policy "duke_media_delete" on storage.objects for delete to authenticated
using (
  bucket_id = 'duke-media'
  and array_length(storage.foldername(name), 1) >= 1
  and public.is_duke_member(((storage.foldername(name))[1])::uuid)
);

-- Activa sincronización Realtime.
do $$
declare
  t text;
begin
  foreach t in array array['messages','memories','special_dates','game_states','couple_members','profiles']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
