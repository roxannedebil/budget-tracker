-- Optional transfer fees + atomic create bundle.
-- Paste in Supabase Dashboard → SQL Editor → Run (after 09-transfer-lifecycle.sql).
-- Success: "Success. No rows returned". Verify:
--   select proname from pg_proc where proname = 'create_transfer_bundle';

-- Allow fee and split transfer types (no-op if already applied).
alter table public.transactions drop constraint if exists transactions_type_check;
alter table public.transactions
  add constraint transactions_type_check
  check (type in (
    'income', 'expense', 'transfer',
    'transfer_out', 'transfer_in', 'fee'
  ));

-- Insert transfers header (optional) + all leg rows in one transaction.
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
      notes
    ) values (
      coalesce((p_header->>'transfer_id')::uuid, v_tid),
      v_uid,
      coalesce(p_header->>'status', 'completed'),
      nullif(p_header->>'from_account_id', '')::uuid,
      nullif(p_header->>'to_account_id', '')::uuid,
      upper(coalesce(p_header->>'send_currency', 'PHP')),
      upper(coalesce(p_header->>'receive_currency', 'PHP')),
      coalesce((p_header->>'date')::timestamptz, now()),
      nullif(p_header->>'notes', '')
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

notify pgrst, 'reload schema';
