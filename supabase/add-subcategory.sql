-- Add optional subcategory column to transactions
-- Run in Supabase Dashboard → SQL Editor

alter table public.transactions
  add column if not exists subcategory text;
