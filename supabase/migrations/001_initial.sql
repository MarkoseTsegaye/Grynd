-- Grynd — initial schema
--
-- One table per persisted store, mirroring the local Zustand shape so future
-- server-side features (aggregates, leaderboards, analytics) don't need a
-- migration to escape JSONB blobs. Every mutable row carries `updated_at`
-- (ms since epoch) for last-write-wins conflict resolution and a nullable
-- `deleted_at` so deletes propagate across devices instead of getting
-- resurrected by the next pull.
--
-- Row-level security is enabled on every table and scoped to `auth.uid()`.
-- Anonymous sessions (`supabase.auth.signInAnonymously()`) get a real UID
-- and see only their own rows, same as identified users.

set search_path = public;

-- Splits: named exercise lists the user cycles through.
create table if not exists splits (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  name text not null,
  exercise_ids text[] not null default '{}',
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint,
  primary key (user_id, id)
);
create index if not exists splits_user_updated_idx on splits (user_id, updated_at);

-- Exercises: catalog of movements. Attributes may be null (unset).
create table if not exists exercises (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  name text not null,
  notes text,
  unilateral boolean,
  plate_loaded boolean,
  updated_at bigint not null,
  deleted_at bigint,
  primary key (user_id, id)
);
create index if not exists exercises_user_updated_idx on exercises (user_id, updated_at);

-- Sessions: one workout instance. `exercises` stays as JSONB because the
-- shape (plates as int→int map, effort as a discriminated object with legacy
-- fields) doesn't earn the joins and we always read a whole session at once.
create table if not exists sessions (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  split_id text not null,
  split_name text not null,
  started_at bigint not null,
  completed_at bigint,
  exercises jsonb not null default '[]'::jsonb,
  current_exercise_index int,
  paused_at bigint,
  updated_at bigint not null,
  deleted_at bigint,
  primary key (user_id, id)
);
create index if not exists sessions_user_updated_idx on sessions (user_id, updated_at);
create index if not exists sessions_user_started_idx on sessions (user_id, started_at desc);

-- Cycles: singleton per user (upsert-only). Days list + current position.
create table if not exists cycles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  days jsonb not null default '[]'::jsonb,
  current_index int not null default 0,
  last_advanced_at bigint,
  updated_at bigint not null
);

-- Prefs: singleton per user (upsert-only).
create table if not exists prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  weight_unit text not null default 'lbs' check (weight_unit in ('kg', 'lbs')),
  auto_advance_cycle boolean not null default true,
  default_rest_seconds int not null default 90,
  updated_at bigint not null
);

-- Weight entries: one row per calendar day, keyed by `date_key` = 'YYYY-MM-DD'.
create table if not exists weight_entries (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  date_key text not null,
  logged_at bigint not null,
  weight_lbs real not null,
  updated_at bigint not null,
  deleted_at bigint,
  primary key (user_id, id)
);
create index if not exists weight_entries_user_updated_idx on weight_entries (user_id, updated_at);
create index if not exists weight_entries_user_date_idx on weight_entries (user_id, date_key);

-- RLS: users see and mutate only their own rows.
alter table splits enable row level security;
alter table exercises enable row level security;
alter table sessions enable row level security;
alter table cycles enable row level security;
alter table prefs enable row level security;
alter table weight_entries enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['splits', 'exercises', 'sessions', 'cycles', 'prefs', 'weight_entries']
  loop
    execute format('drop policy if exists %I_select_own on %I', t, t);
    execute format('drop policy if exists %I_insert_own on %I', t, t);
    execute format('drop policy if exists %I_update_own on %I', t, t);
    execute format('drop policy if exists %I_delete_own on %I', t, t);

    execute format(
      'create policy %I_select_own on %I for select using (auth.uid() = user_id)',
      t, t
    );
    execute format(
      'create policy %I_insert_own on %I for insert with check (auth.uid() = user_id)',
      t, t
    );
    execute format(
      'create policy %I_update_own on %I for update using (auth.uid() = user_id) with check (auth.uid() = user_id)',
      t, t
    );
    execute format(
      'create policy %I_delete_own on %I for delete using (auth.uid() = user_id)',
      t, t
    );
  end loop;
end
$$;
