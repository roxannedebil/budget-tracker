-- Primary (display) currency per user — run once in Supabase SQL Editor
-- Success: "Success. No rows returned" (or row counts on INSERT). Then reload schema if needed.

create table if not exists public.settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  base_currency text not null default 'PHP',
  primary_setup_completed boolean not null default false,
  updated_at timestamptz not null default now()
);

comment on table public.settings is 'Per-user preferences; base_currency is display-only for totals and defaults';
comment on column public.settings.base_currency is 'ISO 4217 code for net worth / converted totals and new-account default';
comment on column public.settings.primary_setup_completed is 'True after first-run pick (existing users backfilled to true)';

alter table public.settings enable row level security;

grant select, insert, update on public.settings to authenticated;

drop policy if exists "Users can view own settings" on public.settings;
drop policy if exists "Users can insert own settings" on public.settings;
drop policy if exists "Users can update own settings" on public.settings;

create policy "Users can view own settings"
  on public.settings for select to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own settings"
  on public.settings for insert to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own settings"
  on public.settings for update to authenticated
  using (auth.uid() = user_id);

-- Existing users: PHP + skip first-run modal (does not change stored transaction amounts)
-- If profiles.primary_currency exists, copy it; otherwise PHP (safe if column missing: use only p.id)
insert into public.settings (user_id, base_currency, primary_setup_completed)
select p.id, 'PHP', true
from public.profiles p
on conflict (user_id) do update
set primary_setup_completed = true, updated_at = now();

-- Users with data but no profile row yet
insert into public.settings (user_id, base_currency, primary_setup_completed)
select distinct t.user_id, 'PHP', true
from public.transactions t
where t.user_id is not null
on conflict (user_id) do nothing;

insert into public.settings (user_id, base_currency, primary_setup_completed)
select distinct a.user_id, 'PHP', true
from public.accounts a
where a.user_id is not null
on conflict (user_id) do nothing;

-- New sign-ups: row with setup incomplete (base_currency PHP until they confirm in app)
create or replace function public.handle_new_user_settings()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.settings (user_id, base_currency, primary_setup_completed)
  values (new.id, 'PHP', false)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_settings on auth.users;

create trigger on_auth_user_created_settings
  after insert on auth.users
  for each row
  execute function public.handle_new_user_settings();

notify pgrst, 'reload schema';
