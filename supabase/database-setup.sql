-- ============================================================
-- Budget Tracker — Supabase database setup
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- ------------------------------------------------------------
-- 1. PROFILES (extends built-in auth.users)
-- Supabase already stores login credentials in auth.users.
-- This table stores extra app data for each user.
-- ------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  email text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-create a profile when someone signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- ------------------------------------------------------------
-- 2. TRANSACTIONS
-- If the table already exists WITHOUT user_id, run this file instead:
--   supabase/migrate-add-user-id.sql
-- ------------------------------------------------------------

create table if not exists public.transactions (
  transaction_id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete cascade,
  amount numeric(12, 2) not null,
  type text not null check (type in ('income', 'expense')),
  category text not null,
  notes text,
  date timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Add user_id when table was created before auth (no-op if column exists)
alter table public.transactions
  add column if not exists user_id uuid references auth.users (id) on delete cascade;

-- ------------------------------------------------------------
-- 3. ROW LEVEL SECURITY (users only see their own data)
-- ------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.transactions enable row level security;

-- Table grants (required for API access — fixes 403 errors)
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.transactions to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- Profiles policies
drop policy if exists "Users can view own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;

create policy "Users can view own profile"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

-- Transactions policies (requires user_id column — run migrate-add-user-id.sql first if needed)
drop policy if exists "Users can view own transactions" on public.transactions;
drop policy if exists "Users can insert own transactions" on public.transactions;
drop policy if exists "Users can update own transactions" on public.transactions;
drop policy if exists "Users can delete own transactions" on public.transactions;

create policy "Users can view own transactions"
  on public.transactions for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own transactions"
  on public.transactions for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own transactions"
  on public.transactions for update
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can delete own transactions"
  on public.transactions for delete
  to authenticated
  using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- TABLE REFERENCE (what each field is for)
-- ------------------------------------------------------------
--
-- auth.users (built-in — do NOT create manually)
--   id              uuid        Primary key for each account
--   email           text        Login email (must be unique)
--   encrypted_password         Stored securely by Supabase
--   email_confirmed_at         Set when user confirms email
--   created_at      timestamptz When account was created
--
-- public.profiles
--   id              uuid        Same as auth.users.id
--   full_name       text        Display name from sign-up form
--   email           text        Copy of user email
--   created_at      timestamptz Profile creation time
--   updated_at      timestamptz Last profile update
--
-- public.transactions
--   transaction_id  bigint      Auto-increment primary key
--   user_id         uuid        Owner of this transaction
--   amount          numeric     Transaction amount
--   type            text        'income' or 'expense'
--   category        text        e.g. Food, Salary
--   notes           text        Optional description
--   date            timestamptz When the transaction happened
--   created_at      timestamptz When row was inserted
--
-- ------------------------------------------------------------
-- SUPABASE AUTH SETTINGS (Dashboard → Authentication)
-- ------------------------------------------------------------
-- 1. Enable Email provider (Authentication → Providers → Email)
-- 2. Optional: turn OFF "Confirm email" for faster testing
-- 3. Set Site URL to http://localhost:5173 for local dev
