-- Supabase schema for BetterPvP Admin Console
-- Run with `supabase db push` or through the SQL editor.

create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

create table if not exists public.invite_codes (
  code text primary key,
  role text not null default 'admin',
  created_at timestamptz not null default timezone('utc', now()),
  created_by uuid references auth.users(id),
  used_at timestamptz,
  used_by uuid references auth.users(id)
);

create table if not exists public.items (
  id text primary key,
  name text not null default '',
  description text,
  tags text[],
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.loot_tables (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  definition jsonb not null,
  metadata jsonb,
  version integer not null default 1,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create table if not exists public.loot_table_guaranteed (
  loot_table_id uuid not null references public.loot_tables(id) on delete cascade,
  payload jsonb not null,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (loot_table_id, created_at)
);

create index if not exists items_created_at_idx on public.items (created_at desc);
create index if not exists loot_tables_updated_at_idx on public.loot_tables (updated_at desc);

alter table public.invite_codes enable row level security;
alter table public.items enable row level security;
alter table public.loot_tables enable row level security;
alter table public.loot_table_guaranteed enable row level security;

drop policy if exists "Invite codes readable by authenticated" on public.invite_codes;
create policy "Invite codes readable by authenticated" on public.invite_codes
  for select using (auth.role() = 'authenticated');

drop policy if exists "Invite codes insert for authenticated" on public.invite_codes;
create policy "Invite codes insert for authenticated" on public.invite_codes
  for insert with check (auth.role() = 'authenticated');

drop policy if exists "Invite codes update for authenticated" on public.invite_codes;
create policy "Invite codes update for authenticated" on public.invite_codes
  for update using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "Items readable by authenticated" on public.items;
create policy "Items readable by authenticated" on public.items
  for select using (auth.role() = 'authenticated');

drop policy if exists "Items upsert by authenticated" on public.items;
create policy "Items upsert by authenticated" on public.items
  for insert with check (auth.role() = 'authenticated');

drop policy if exists "Items update by authenticated" on public.items;
create policy "Items update by authenticated" on public.items
  for update using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "Loot tables readable by authenticated" on public.loot_tables;
create policy "Loot tables readable by authenticated" on public.loot_tables
  for select using (auth.role() = 'authenticated');

drop policy if exists "Loot tables insert by authenticated" on public.loot_tables;
create policy "Loot tables insert by authenticated" on public.loot_tables
  for insert with check (auth.role() = 'authenticated');

drop policy if exists "Loot tables update by authenticated" on public.loot_tables;
create policy "Loot tables update by authenticated" on public.loot_tables
  for update using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "Loot tables delete by authenticated" on public.loot_tables;
  create policy "Loot tables delete by authenticated" on public.loot_tables
    for delete using (auth.role() = 'authenticated');

drop policy if exists "Guaranteed loot readable by authenticated" on public.loot_table_guaranteed;
create policy "Guaranteed loot readable by authenticated" on public.loot_table_guaranteed
  for select using (auth.role() = 'authenticated');

drop policy if exists "Guaranteed loot write by authenticated" on public.loot_table_guaranteed;
create policy "Guaranteed loot write by authenticated" on public.loot_table_guaranteed
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create or replace function public.check_invite_code(code text)
returns table(role text) as $$
begin
  return query
    select invite_codes.role
    from invite_codes
    where invite_codes.code = check_invite_code.code
      and invite_codes.used_at is null
      and invite_codes.used_by is null;
end;
$$ language plpgsql security definer;
