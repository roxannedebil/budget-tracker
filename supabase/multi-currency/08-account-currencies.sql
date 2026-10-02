-- Run once in Supabase SQL Editor: extra currencies per account (when multi-currency enabled)
alter table public.accounts
  add column if not exists account_currencies jsonb not null default '[]'::jsonb;

comment on column public.accounts.account_currencies is
  'ISO codes besides default_currency allowed on this account when allow_multiple_currencies is true';

notify pgrst, 'reload schema';
