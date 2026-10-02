-- Transfer lifecycle: header table + atomic complete/delete RPCs.
-- Paste in Supabase Dashboard → SQL Editor → Run.
-- Success: "Success. No rows returned" (or similar). Then verify:
--   select proname from pg_proc where proname in ('complete_pending_transfer','delete_transfer');

-- ---------------------------------------------------------------------------
-- 1) Transfers header (one row per multi-leg transfer)
-- ---------------------------------------------------------------------------
create table if not exists public.transfers (
  transfer_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'completed')),
  from_account_id uuid references public.accounts (account_id) on delete set null,
  to_account_id uuid references public.accounts (account_id) on delete set null,
  send_currency text not null default 'PHP',
  receive_currency text not null default 'PHP',
  date timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists transfers_user_id_idx on public.transfers (user_id);

alter table public.transfers enable row level security;

drop policy if exists "Users can view own transfers" on public.transfers;
drop policy if exists "Users can insert own transfers" on public.transfers;
drop policy if exists "Users can update own transfers" on public.transfers;
drop policy if exists "Users can delete own transfers" on public.transfers;

create policy "Users can view own transfers"
  on public.transfers for select
  using (auth.uid() = user_id);

create policy "Users can insert own transfers"
  on public.transfers for insert
  with check (auth.uid() = user_id);

create policy "Users can update own transfers"
  on public.transfers for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own transfers"
  on public.transfers for delete
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.transfers to authenticated;

-- Link legs to header (keeps transfer_group_id in sync in the app)
alter table public.transactions
  add column if not exists transfer_id uuid references public.transfers (transfer_id) on delete cascade;

create index if not exists transactions_transfer_id_idx on public.transactions (transfer_id);

-- ---------------------------------------------------------------------------
-- 2) Block completed → pending on transfer legs and header
-- ---------------------------------------------------------------------------
create or replace function public.prevent_transfer_revert_to_pending()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if TG_TABLE_NAME = 'transactions' then
    if old.status = 'completed' and new.status = 'pending'
       and new.type in ('transfer', 'transfer_out', 'transfer_in') then
      raise exception 'Completed transfers cannot be set back to pending';
    end if;
  elsif TG_TABLE_NAME = 'transfers' then
    if old.status = 'completed' and new.status = 'pending' then
      raise exception 'Completed transfers cannot be set back to pending';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_transfer_revert_txn on public.transactions;
create trigger trg_prevent_transfer_revert_txn
  before update of status on public.transactions
  for each row
  execute function public.prevent_transfer_revert_to_pending();

drop trigger if exists trg_prevent_transfer_revert_header on public.transfers;
create trigger trg_prevent_transfer_revert_header
  before update of status on public.transfers
  for each row
  execute function public.prevent_transfer_revert_to_pending();

-- ---------------------------------------------------------------------------
-- 3) Complete pending transfer (insert transfer_in; update out + header)
-- ---------------------------------------------------------------------------
create or replace function public.complete_pending_transfer(
  p_transfer_id uuid,
  p_receive_major numeric,
  p_receive_minor bigint,
  p_effective_rate numeric,
  p_rate_to_base_receive numeric default null
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_header public.transfers%rowtype;
  v_out public.transactions%rowtype;
  v_recv_currency text;
  v_group uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_receive_major is null or p_receive_major <= 0 then
    raise exception 'Received amount must be greater than zero';
  end if;

  select * into v_header
  from public.transfers
  where transfer_id = p_transfer_id and user_id = v_uid
  for update;

  if not found then
    raise exception 'Transfer not found';
  end if;

  if v_header.status <> 'pending' then
    raise exception 'Transfer is not pending';
  end if;

  select * into v_out
  from public.transactions
  where transfer_id = p_transfer_id
    and type = 'transfer_out'
    and user_id = v_uid
  for update;

  if not found then
    raise exception 'Pending transfer_out leg not found';
  end if;

  if exists (
    select 1 from public.transactions
    where transfer_id = p_transfer_id
      and type = 'transfer_in'
      and user_id = v_uid
  ) then
    raise exception 'Transfer already has a transfer_in leg';
  end if;

  v_recv_currency := upper(coalesce(v_header.receive_currency, v_out.currency, 'PHP'));
  v_group := coalesce(v_out.transfer_group_id, p_transfer_id);

  insert into public.transactions (
    user_id,
    type,
    amount,
    amount_minor,
    currency,
    rate_to_base,
    category,
    subcategory,
    notes,
    date,
    status,
    from_account_id,
    to_account_id,
    transfer_group_id,
    transfer_id,
    received_amount_minor,
    market_rate_estimate,
    effective_rate,
    income_source
  ) values (
    v_out.user_id,
    'transfer_in',
    p_receive_major,
    p_receive_minor,
    v_recv_currency,
    p_rate_to_base_receive,
    'Transfer in',
    null,
    v_out.notes,
    v_out.date,
    'completed',
    null,
    coalesce(v_header.to_account_id, v_out.to_account_id),
    v_group,
    p_transfer_id,
    p_receive_minor,
    v_out.market_rate_estimate,
    p_effective_rate,
    null
  );

  update public.transactions
  set
    status = 'completed',
    effective_rate = p_effective_rate,
    received_amount_minor = p_receive_minor
  where transaction_id = v_out.transaction_id;

  update public.transfers
  set status = 'completed'
  where transfer_id = p_transfer_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4) Delete whole transfer (or single legacy transfer row)
-- ---------------------------------------------------------------------------
create or replace function public.delete_transfer(p_transaction_id bigint)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.transactions%rowtype;
  v_tid uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_row
  from public.transactions
  where transaction_id = p_transaction_id
    and user_id = v_uid;

  if not found then
    raise exception 'Transaction not found';
  end if;

  v_tid := coalesce(v_row.transfer_id, v_row.transfer_group_id);

  -- Legacy single-row transfer
  if v_tid is null and v_row.type = 'transfer' then
    delete from public.transactions
    where transaction_id = p_transaction_id
      and user_id = v_uid;
    return;
  end if;

  if v_tid is null then
    raise exception 'Use delete_transfer only for transfer groups or legacy transfer rows';
  end if;

  delete from public.transactions
  where user_id = v_uid
    and (
      transfer_id = v_tid
      or transfer_group_id = v_tid
    );

  delete from public.transfers
  where transfer_id = v_tid
    and user_id = v_uid;
end;
$$;

grant execute on function public.complete_pending_transfer(
  uuid, numeric, bigint, numeric, numeric
) to authenticated;

grant execute on function public.delete_transfer(bigint) to authenticated;

notify pgrst, 'reload schema';
