-- Adds avatar_url to profiles (fixes "column not in schema cache")
-- Run in: Supabase Dashboard → SQL Editor → New query → Run

alter table public.profiles
  add column if not exists avatar_url text;

-- Refresh API schema cache so the app sees the new column immediately
notify pgrst, 'reload schema';
