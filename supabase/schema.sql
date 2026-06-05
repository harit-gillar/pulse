-- Pulse — Supabase schema
-- Paste this into the Supabase SQL editor and run.

create table if not exists public.daily_snapshots (
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  data jsonb not null,
  fetched_at timestamptz not null default now(),
  primary key (user_id, date)
);

alter table public.daily_snapshots enable row level security;

drop policy if exists "users read own snapshots" on public.daily_snapshots;
create policy "users read own snapshots"
  on public.daily_snapshots for select
  using (auth.uid() = user_id);

drop policy if exists "users write own snapshots" on public.daily_snapshots;
create policy "users write own snapshots"
  on public.daily_snapshots for insert
  with check (auth.uid() = user_id);

drop policy if exists "users update own snapshots" on public.daily_snapshots;
create policy "users update own snapshots"
  on public.daily_snapshots for update
  using (auth.uid() = user_id);

create index if not exists daily_snapshots_user_date_idx
  on public.daily_snapshots (user_id, date desc);

-- ─────────────────────────────────────────────────────────────
-- Google refresh tokens — server-only. RLS is enabled with NO
-- policies, so the anon/authenticated keys can never read this;
-- only the service-role key (used server-side) bypasses RLS.
-- ─────────────────────────────────────────────────────────────
create table if not exists public.user_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  provider_refresh_token text,
  updated_at timestamptz not null default now()
);

alter table public.user_tokens enable row level security;
-- (intentionally no policies — service role only)
