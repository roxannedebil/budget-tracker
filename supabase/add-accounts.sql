-- ============================================================
-- FIX: "Could not find table public.accounts in schema cache"
-- Run ALL of this in Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- 1. Create accounts table
create table if not exists public.accounts (
  account_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  account_type text not null check (account_type in ('bank', 'ewallet', 'cash')),
  created_at timestamptz not null default now()
);

-- 2. Add account columns to transactions
alter table public.transactions
  add column if not exists from_account_id uuid references public.accounts (account_id) on delete set null;

alter table public.transactions
  add column if not exists to_account_id uuid references public.accounts (account_id) on delete set null;

alter table public.transactions
  add column if not exists income_source text;

-- 3. Allow transfer type on transactions
alter table public.transactions drop constraint if exists transactions_type_check;
alter table public.transactions
  add constraint transactions_type_check
  check (type in ('income', 'expense', 'transfer'));

alter table public.transactions drop constraint if exists transactions_income_source_check;
alter table public.transactions
  add constraint transactions_income_source_check
  check (income_source is null or income_source in ('payroll', 'other'));

-- 4. API permissions (fixes 403 errors)
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.accounts to authenticated;
grant select, insert, update, delete on public.transactions to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- 5. Row level security for accounts
alter table public.accounts enable row level security;

drop policy if exists "Users can view own accounts" on public.accounts;
drop policy if exists "Users can insert own accounts" on public.accounts;
drop policy if exists "Users can update own accounts" on public.accounts;
drop policy if exists "Users can delete own accounts" on public.accounts;

create policy "Users can view own accounts"
  on public.accounts for select to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own accounts"
  on public.accounts for insert to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own accounts"
  on public.accounts for update to authenticated
  using (auth.uid() = user_id);

create policy "Users can delete own accounts"
  on public.accounts for delete to authenticated
  using (auth.uid() = user_id);

-- 6. Refresh Supabase API schema cache
notify pgrst, 'reload schema';
