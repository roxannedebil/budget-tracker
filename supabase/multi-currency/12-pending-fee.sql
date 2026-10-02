-- Pending fee on destination + bundle header fields (run after 11-transfer-fee.sql).
-- Paste in Supabase Dashboard → SQL Editor → Run.
-- Success: "Success. No rows returned".
-- Verify: select column_name from information_schema.columns
--   where table_name = 'transfers' and column_name like 'pending_fee%';

alter table public.transfers
  add column if not exists pending_fee_major numeric,
  add column if not exists pending_fee_currency text,
  add column if not exists pending_fee_account_id uuid references public.accounts (account_id) on delete set null;

-- Extend bundle insert to store optional pending fee on header.
create or replace function public.create_transfer_bundle(
  p_header jsonb,
  p_transactions jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_tid uuid;
  elem jsonb;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_transactions is null or jsonb_array_length(p_transactions) = 0 then
    raise exception 'No transaction rows provided';
  end if;

  select nullif(
    coalesce(
      (select e->>'transfer_id' from jsonb_array_elements(p_transactions) e
       where e->>'transfer_id' is not null limit 1),
      (select e->>'transfer_group_id' from jsonb_array_elements(p_transactions) e
       where e->>'transfer_group_id' is not null limit 1)
    ),
    ''
  )::uuid into v_tid;

  if p_header is not null then
    insert into public.transfers (
      transfer_id,
      user_id,
      status,
      from_account_id,
      to_account_id,
      send_currency,
      receive_currency,
      date,
      notes,
      pending_fee_major,
      pending_fee_currency,
      pending_fee_account_id
    ) values (
      coalesce((p_header->>'transfer_id')::uuid, v_tid),
      v_uid,
      coalesce(p_header->>'status', 'completed'),
      nullif(p_header->>'from_account_id', '')::uuid,
      nullif(p_header->>'to_account_id', '')::uuid,
      upper(coalesce(p_header->>'send_currency', 'PHP')),
      upper(coalesce(p_header->>'receive_currency', 'PHP')),
      coalesce((p_header->>'date')::timestamptz, now()),
      nullif(p_header->>'notes', ''),
      nullif(p_header->>'pending_fee_major', '')::numeric,
      nullif(upper(p_header->>'pending_fee_currency'), ''),
      nullif(p_header->>'pending_fee_account_id', '')::uuid
    );
    v_tid := coalesce((p_header->>'transfer_id')::uuid, v_tid);
  end if;

  for elem in select * from jsonb_array_elements(p_transactions)
  loop
    if coalesce(elem->>'user_id', v_uid::text)::uuid <> v_uid then
      raise exception 'Transaction user mismatch';
    end if;

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
      v_uid,
      elem->>'type',
      (elem->>'amount')::numeric,
      (elem->>'amount_minor')::bigint,
      upper(coalesce(elem->>'currency', 'PHP')),
      nullif(elem->>'rate_to_base', '')::numeric,
      coalesce(elem->>'category', 'Transfer'),
      nullif(elem->>'subcategory', ''),
      nullif(elem->>'notes', ''),
      coalesce((elem->>'date')::timestamptz, now()),
      coalesce(elem->>'status', 'completed'),
      nullif(elem->>'from_account_id', '')::uuid,
      nullif(elem->>'to_account_id', '')::uuid,
      nullif(coalesce(elem->>'transfer_group_id', elem->>'transfer_id'), '')::uuid,
      nullif(elem->>'transfer_id', '')::uuid,
      nullif(elem->>'received_amount_minor', '')::bigint,
      nullif(elem->>'market_rate_estimate', '')::numeric,
      nullif(elem->>'effective_rate', '')::numeric,
      nullif(elem->>'income_source', '')
    );
  end loop;

  return v_tid;
end;
$$;

grant execute on function public.create_transfer_bundle(jsonb, jsonb) to authenticated;

-- On complete: insert transfer_in + optional deferred fee, clear pending fee fields.
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
  v_fee_rate numeric;
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
    where transfer_id = p_transfer_id and type = 'transfer_in' and user_id = v_uid
  ) then
    raise exception 'Transfer already has a transfer_in leg';
  end if;

  v_recv_currency := upper(coalesce(v_header.receive_currency, v_out.currency, 'PHP'));
  v_group := coalesce(v_out.transfer_group_id, p_transfer_id);

  insert into public.transactions (
    user_id, type, amount, amount_minor, currency, rate_to_base,
    category, subcategory, notes, date, status,
    from_account_id, to_account_id, transfer_group_id, transfer_id,
    received_amount_minor, market_rate_estimate, effective_rate, income_source
  ) values (
    v_out.user_id, 'transfer_in', p_receive_major, p_receive_minor, v_recv_currency,
    p_rate_to_base_receive, 'Transfer in', null, v_out.notes, v_out.date,
    'completed', null, coalesce(v_header.to_account_id, v_out.to_account_id),
    v_group, p_transfer_id, p_receive_minor, v_out.market_rate_estimate,
    p_effective_rate, null
  );

  update public.transactions
  set status = 'completed', effective_rate = p_effective_rate,
      received_amount_minor = p_receive_minor
  where transaction_id = v_out.transaction_id;

  if v_header.pending_fee_major is not null and v_header.pending_fee_major > 0
     and v_header.pending_fee_account_id is not null
     and not exists (
       select 1 from public.transactions
       where transfer_id = p_transfer_id and type = 'fee' and user_id = v_uid
     ) then
    v_fee_rate := null;
    insert into public.transactions (
      user_id, type, amount, amount_minor, currency, rate_to_base,
      category, subcategory, notes, date, status,
      from_account_id, to_account_id, transfer_group_id, transfer_id, income_source
    ) values (
      v_uid, 'fee', v_header.pending_fee_major,
      -abs(round(v_header.pending_fee_major * power(10, 2))::bigint),
      upper(coalesce(v_header.pending_fee_currency, 'PHP')),
      v_fee_rate, 'Fees', null, v_out.notes, v_out.date, 'completed',
      v_header.pending_fee_account_id, null, v_group, p_transfer_id, null
    );
  end if;

  update public.transfers
  set status = 'completed',
      pending_fee_major = null,
      pending_fee_currency = null,
      pending_fee_account_id = null
  where transfer_id = p_transfer_id;
end;
$$;

notify pgrst, 'reload schema';
