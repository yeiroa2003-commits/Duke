-- DUKE 2.0 - MIGRACIÓN PARA ACCESO PRIVADO Y MÁXIMO DOS CUENTAS
-- Ejecuta este archivo en Neon SQL Editor si ya ejecutaste neon/schema.sql anteriormente.

begin;

create or replace function public.enforce_two_duke_users()
returns trigger
language plpgsql
as $$
declare
  v_count integer;
begin
  if new.is_active = true then
    lock table public.users in share row exclusive mode;
    select count(*) into v_count from public.users where is_active = true;
    if v_count >= 2 then
      raise exception 'TWO_USERS_MAXIMUM';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists users_limit_two on public.users;
create trigger users_limit_two
before insert on public.users
for each row execute function public.enforce_two_duke_users();

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

  if exists (select 1 from public.couples where is_active = true) then
    raise exception 'COUPLE_ALREADY_EXISTS';
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
      select 1 from public.couples c
      where c.invite_code = v_code
    );
  end loop;

  insert into public.couples (
    name, invite_code, pin_hash, relationship_date, created_by
  ) values (
    trim(p_name), v_code, crypt(p_pin, gen_salt('bf', 10)), p_relationship_date, p_user_id
  ) returning * into v_couple;

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
  select v_couple.id, v_couple.name, v_couple.invite_code, v_couple.relationship_date;
end;
$$;

commit;
