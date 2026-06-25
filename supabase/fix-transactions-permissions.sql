-- ============================================================
-- FIX: 403 "permission denied" on transactions table
-- Run in Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- 1. Ensure user_id column exists
alter table public.transactions
  add column if not exists user_id uuid references auth.users (id) on delete cascade;

-- 2. Table-level grants (often missing when table was created manually)
grant usage on schema public to anon, authenticated;

grant select, insert, update, delete
  on public.transactions to authenticated;

grant select, insert, update, delete
  on public.profiles to authenticated;

-- Identity/serial column needs sequence access for inserts
grant usage, select on all sequences in schema public to authenticated;

-- 3. Enable RLS
alter table public.transactions enable row level security;
alter table public.profiles enable row level security;

-- 4. Remove old policies (safe to re-run)
drop policy if exists "Users can view own transactions" on public.transactions;
drop policy if exists "Users can insert own transactions" on public.transactions;
drop policy if exists "Users can update own transactions" on public.transactions;
drop policy if exists "Users can delete own transactions" on public.transactions;

drop policy if exists "Users can view own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;

-- 5. Re-create transaction policies
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

-- 6. Profile policies
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

-- 7. Backfill profiles for users created before the trigger existed
insert into public.profiles (id, full_name, email)
select
  u.id,
  coalesce(u.raw_user_meta_data->>'full_name', ''),
  u.email
from auth.users u
where not exists (
  select 1 from public.profiles p where p.id = u.id
);
