-- Account accent color (hex, e.g. #3B82F6)
alter table public.accounts
  add column if not exists color_hex text;

comment on column public.accounts.color_hex is 'Optional #RRGGBB accent for UI';

notify pgrst, 'reload schema';
