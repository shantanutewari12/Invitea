-- Regalia: initial schema.
--
-- Security model (read this before changing anything):
--   * RLS is enabled on EVERY table in `public`.
--   * Signed-in hosts may only READ their own rows (select policies below). They have no
--     INSERT/UPDATE/DELETE policies and no write grants: every write goes through a Next.js
--     route handler (service role) that validates input with Zod, enforces plan limits and
--     checks ownership. A host therefore cannot bypass the guest cap, store an unvalidated
--     invite spec, or grant themselves a paid plan with a direct PostgREST call.
--   * `anon` can read nothing. Guests never touch the database directly: the public viewer
--     endpoints look a token up server-side (service role) and return minimal fields.
--   * `upsert_rsvp` and `consume_rate_limit` are SECURITY DEFINER and executable by the
--     service role only.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- URL-safe random token (about 126 bits for 21 chars). Used for common links and as a default
-- for guest tokens; the application normally generates guest tokens with nanoid(21).
create or replace function public.regalia_token(p_length int default 21)
returns text
language sql
volatile
set search_path = ''
as $$
  select substr(translate(encode(extensions.gen_random_bytes(48), 'base64'), E'+/=\n', '-_'), 1, p_length);
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text check (display_name is null or char_length(display_name) <= 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  event_type text not null check (
    event_type in ('wedding', 'birthday', 'anniversary', 'baby_shower', 'naming_ceremony', 'first_haircut', 'housewarming', 'custom')
  ),
  status text not null default 'draft' check (status in ('draft', 'published')),
  display_mode text not null default 'animated' check (display_mode in ('animated', 'static')),
  -- Validated, sanitised InviteSpec (schemaVersion 1). Never HTML or code.
  spec jsonb not null check (jsonb_typeof(spec) = 'object' and octet_length(spec::text) <= 65536),
  -- Bumped on every change to published content so devices know to refresh their offline copy.
  version int not null default 1 check (version >= 1),
  -- Custom link for paid invites (/i/<slug>). Same shape as lib/token-format SLUG_PATTERN.
  slug text unique check (slug is null or slug ~ '^[a-z0-9][a-z0-9-]{2,39}$'),
  -- Generic-greeting link for the whole invite (QR on a poster, a family WhatsApp group).
  common_token text not null unique default public.regalia_token(21)
    check (common_token ~ '^[A-Za-z0-9_-]{16,64}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);
create index invites_owner_idx on public.invites (owner_id, created_at desc);

-- The ceremonies / sessions of an invite (ceremony, reception, ...).
create table public.invite_events (
  id uuid primary key default gen_random_uuid(),
  invite_id uuid not null references public.invites (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  starts_at timestamptz not null,
  timezone text not null check (char_length(timezone) between 1 and 64),
  venue_name text not null default '' check (char_length(venue_name) <= 120),
  address text not null default '' check (char_length(address) <= 240),
  map_url text not null default '' check (map_url = '' or map_url ~ '^https://'),
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index invite_events_invite_idx on public.invite_events (invite_id, sort);

create table public.guests (
  id uuid primary key default gen_random_uuid(),
  invite_id uuid not null references public.invites (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  -- Optional, E.164-ish digits; only used to build wa.me share links for the host.
  phone text check (phone is null or phone ~ '^\+?[0-9]{7,15}$'),
  token text not null unique default public.regalia_token(21)
    check (token ~ '^[A-Za-z0-9_-]{16,64}$'),
  max_party_size int not null default 1 check (max_party_size between 1 and 20),
  -- Empty array = invited to every event of the invite.
  invited_event_ids uuid[] not null default '{}',
  first_opened_at timestamptz,
  last_opened_at timestamptz,
  created_at timestamptz not null default now()
);
create index guests_invite_idx on public.guests (invite_id);

create table public.rsvps (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid not null unique references public.guests (id) on delete cascade,
  invite_id uuid not null references public.invites (id) on delete cascade,
  status text not null check (status in ('yes', 'no', 'maybe')),
  party_size int not null check (party_size between 0 and 20),
  message text not null default '' check (char_length(message) <= 500),
  -- Key of the request that wrote this row (client-generated UUID from the offline outbox).
  idempotency_key text not null check (char_length(idempotency_key) between 16 and 100),
  -- When the guest pressed "send" on their device; orders replies that arrive out of order.
  client_submitted_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index rsvps_invite_idx on public.rsvps (invite_id);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  invite_id uuid not null references public.invites (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  razorpay_order_id text not null unique,
  -- Unique: the same payment can only ever be recorded once, however often its webhook is replayed.
  razorpay_payment_id text unique,
  amount_minor int not null check (amount_minor > 0),
  currency text not null default 'INR' check (char_length(currency) = 3),
  status text not null default 'created' check (status in ('created', 'paid', 'failed')),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index orders_invite_idx on public.orders (invite_id, status);
create index orders_owner_idx on public.orders (owner_id);

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  invite_id uuid not null references public.invites (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('image', 'audio')),
  content_type text not null check (content_type in ('image/webp', 'image/png', 'image/jpeg', 'audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/ogg')),
  storage_path text not null unique,
  bytes int not null check (bytes > 0 and bytes <= 5242880),
  created_at timestamptz not null default now()
);
create index assets_invite_idx on public.assets (invite_id);

-- One row per AI generation attempt: usage accounting and debugging (no prompts are stored).
create table public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  invite_id uuid references public.invites (id) on delete set null,
  provider text not null,
  model text not null,
  outcome text not null check (outcome in ('success', 'retried', 'fallback', 'error')),
  prompt_chars int not null default 0,
  latency_ms int not null default 0,
  created_at timestamptz not null default now()
);
create index ai_usage_user_idx on public.ai_usage (user_id, created_at desc);

-- Fixed-window counters behind consume_rate_limit().
create table public.rate_limits (
  key text not null,
  window_start bigint not null,
  count int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (key, window_start)
);
create index rate_limits_updated_idx on public.rate_limits (updated_at);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger invites_touch before update on public.invites
  for each row execute function public.touch_updated_at();
create trigger rsvps_touch before update on public.rsvps
  for each row execute function public.touch_updated_at();

-- Every new auth user gets a profile row.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- RPC: idempotent RSVP upsert (guest token -> one RSVP row per guest)
-- ---------------------------------------------------------------------------
-- Returns: created | updated | duplicate | stale | invalid_party_size | not_found
--   duplicate  the same Idempotency-Key was already applied (a retry)
--   stale      a newer reply (by client_submitted_at) is already stored
-- The guest row is locked first so concurrent requests for one guest serialise: a reply is
-- applied exactly once no matter how many devices or retries deliver it.
create or replace function public.upsert_rsvp(
  p_token text,
  p_key text,
  p_status text,
  p_party_size int,
  p_message text,
  p_client_submitted_at timestamptz
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_guest public.guests%rowtype;
  v_rsvp public.rsvps%rowtype;
begin
  select g.* into v_guest from public.guests g where g.token = p_token for update;
  if not found then
    return 'not_found';
  end if;

  perform 1 from public.invites i where i.id = v_guest.invite_id and i.status = 'published';
  if not found then
    return 'not_found';
  end if;

  if p_party_size < 0 or p_party_size > v_guest.max_party_size then
    return 'invalid_party_size';
  end if;

  select r.* into v_rsvp from public.rsvps r where r.guest_id = v_guest.id;

  if not found then
    insert into public.rsvps (guest_id, invite_id, status, party_size, message, idempotency_key, client_submitted_at)
    values (v_guest.id, v_guest.invite_id, p_status, p_party_size, coalesce(p_message, ''), p_key, p_client_submitted_at);
    return 'created';
  end if;

  if v_rsvp.idempotency_key = p_key then
    return 'duplicate';
  end if;

  if v_rsvp.client_submitted_at >= p_client_submitted_at then
    return 'stale';
  end if;

  update public.rsvps
     set status = p_status,
         party_size = p_party_size,
         message = coalesce(p_message, ''),
         idempotency_key = p_key,
         client_submitted_at = p_client_submitted_at
   where id = v_rsvp.id;
  return 'updated';
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: create or update an invite and replace its events in ONE transaction.
-- The events come from p_spec -> 'events' (each with an id assigned by the server), so the
-- spec and the invite_events rows can never drift apart.
-- p_invite_id null  -> insert a new draft. Otherwise update, but only when p_owner owns it.
-- Returns the invite id, or null when the invite does not exist or belongs to someone else.
-- ---------------------------------------------------------------------------
create or replace function public.save_invite(
  p_owner uuid,
  p_invite_id uuid,
  p_event_type text,
  p_display_mode text,
  p_spec jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_event jsonb;
  v_ids uuid[] := '{}';
  v_sort int := 0;
begin
  if p_invite_id is null then
    insert into public.invites (owner_id, event_type, display_mode, spec)
    values (p_owner, p_event_type, p_display_mode, p_spec)
    returning id into v_id;
  else
    update public.invites
       set event_type = p_event_type,
           display_mode = p_display_mode,
           spec = p_spec,
           version = version + 1
     where id = p_invite_id and owner_id = p_owner
    returning id into v_id;
    if v_id is null then
      return null;
    end if;
  end if;

  for v_event in select e.value from jsonb_array_elements(p_spec -> 'events') as e loop
    insert into public.invite_events (id, invite_id, title, starts_at, timezone, venue_name, address, map_url, sort)
    values (
      (v_event ->> 'id')::uuid,
      v_id,
      v_event ->> 'title',
      (v_event ->> 'startsAt')::timestamptz,
      v_event ->> 'timezone',
      coalesce(v_event ->> 'venueName', ''),
      coalesce(v_event ->> 'address', ''),
      coalesce(v_event ->> 'mapUrl', ''),
      v_sort
    )
    on conflict (id) do update
      set title = excluded.title,
          starts_at = excluded.starts_at,
          timezone = excluded.timezone,
          venue_name = excluded.venue_name,
          address = excluded.address,
          map_url = excluded.map_url,
          sort = excluded.sort
      where public.invite_events.invite_id = v_id;
    v_ids := v_ids || (v_event ->> 'id')::uuid;
    v_sort := v_sort + 1;
  end loop;

  delete from public.invite_events where invite_id = v_id and id <> all (v_ids);
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: fixed-window rate limiter. Returns true while the caller is within `p_max`.
-- ---------------------------------------------------------------------------
create or replace function public.consume_rate_limit(p_key text, p_window_seconds int, p_max int)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window bigint := floor(extract(epoch from now()) / greatest(p_window_seconds, 1))::bigint;
  v_count int;
begin
  insert into public.rate_limits as rl (key, window_start, count)
  values (p_key, v_window, 1)
  on conflict (key, window_start) do update
    set count = rl.count + 1, updated_at = now()
  returning rl.count into v_count;

  -- Occasional housekeeping so the table stays small.
  if random() < 0.01 then
    delete from public.rate_limits where updated_at < now() - interval '2 days';
  end if;

  return v_count <= p_max;
end;
$$;

revoke all on function public.upsert_rsvp(text, text, text, int, text, timestamptz) from public, anon, authenticated;
revoke all on function public.consume_rate_limit(text, int, int) from public, anon, authenticated;
revoke all on function public.save_invite(uuid, uuid, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.upsert_rsvp(text, text, text, int, text, timestamptz) to service_role;
grant execute on function public.consume_rate_limit(text, int, int) to service_role;
grant execute on function public.save_invite(uuid, uuid, text, text, jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.invites enable row level security;
alter table public.invite_events enable row level security;
alter table public.guests enable row level security;
alter table public.rsvps enable row level security;
alter table public.orders enable row level security;
alter table public.assets enable row level security;
alter table public.ai_usage enable row level security;
alter table public.rate_limits enable row level security; -- no policies: service role only

create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy invites_select_own on public.invites
  for select to authenticated
  using (owner_id = (select auth.uid()));

create policy invite_events_select_own on public.invite_events
  for select to authenticated
  using (exists (
    select 1 from public.invites i where i.id = invite_events.invite_id and i.owner_id = (select auth.uid())
  ));

create policy guests_select_own on public.guests
  for select to authenticated
  using (exists (
    select 1 from public.invites i where i.id = guests.invite_id and i.owner_id = (select auth.uid())
  ));

create policy rsvps_select_own on public.rsvps
  for select to authenticated
  using (exists (
    select 1 from public.invites i where i.id = rsvps.invite_id and i.owner_id = (select auth.uid())
  ));

create policy assets_select_own on public.assets
  for select to authenticated
  using (owner_id = (select auth.uid()));

create policy orders_select_own on public.orders
  for select to authenticated
  using (owner_id = (select auth.uid()));

create policy ai_usage_select_own on public.ai_usage
  for select to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Privileges: least privilege on top of RLS
-- ---------------------------------------------------------------------------

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

grant select on public.profiles, public.invites, public.invite_events, public.guests,
  public.rsvps, public.orders, public.assets, public.ai_usage to authenticated;
-- Hosts may rename themselves; nothing else on their profile.
grant update (display_name) on public.profiles to authenticated;

grant all on all tables in schema public to service_role;

-- Tables created by future migrations start with no access for anon/authenticated.
alter default privileges in schema public revoke all on tables from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Storage: one private bucket. No policies on storage.objects: clients get no direct access.
-- Hosts upload through server-issued signed upload URLs; guests read assets only through the
-- token-scoped route handler.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'invite-assets',
  'invite-assets',
  false,
  5242880,
  array['image/webp', 'image/png', 'image/jpeg', 'audio/mpeg', 'audio/mp4', 'audio/ogg']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
