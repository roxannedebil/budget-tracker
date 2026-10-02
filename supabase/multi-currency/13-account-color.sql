-- Account accent color for UI (run in Supabase SQL Editor if not applied yet)
alter table public.accounts
  add column if not exists color_hex text;

comment on column public.accounts.color_hex is 'Optional #RRGGBB accent for cards and labels';

notify pgrst, 'reload schema';
