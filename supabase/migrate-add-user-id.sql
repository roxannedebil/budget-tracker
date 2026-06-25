-- ============================================================
-- FIX: Add user_id to existing transactions table
-- Run this in Supabase → SQL Editor (fixes error 42703)
-- ============================================================

-- 1. Add the missing column
alter table public.transactions
  add column if not exists user_id uuid references auth.users (id) on delete cascade;

-- 2. Remove old test rows that have no owner (created before login existed)
delete from public.transactions
where user_id is null;

-- 3. Drop policies that may have failed or reference user_id incorrectly
drop policy if exists "Users can view own transactions" on public.transactions;
drop policy if exists "Users can insert own transactions" on public.transactions;
drop policy if exists "Users can update own transactions" on public.transactions;
drop policy if exists "Users can delete own transactions" on public.transactions;

-- 4. Enable RLS (safe to run again)
alter table public.transactions enable row level security;

-- 5. Re-create policies now that user_id exists
create policy "Users can view own transactions"
  on public.transactions for select
  using (auth.uid() = user_id);

create policy "Users can insert own transactions"
  on public.transactions for insert
  with check (auth.uid() = user_id);

create policy "Users can update own transactions"
  on public.transactions for update
  using (auth.uid() = user_id);

create policy "Users can delete own transactions"
  on public.transactions for delete
  using (auth.uid() = user_id);

-- 6. Optional: require user_id on every new row (run only after step 2 succeeds)
-- alter table public.transactions alter column user_id set not null;
