# Multi-currency migrations (run in order)

You already applied these in the Supabase SQL Editor. Files are kept here for reference.

| Order | File |
|-------|------|
| 00 | `00-backup-snapshot.sql` |
| 01 | `01-add-columns.sql` |
| 02 | `02-backfill-amount-minor.sql` |
| 04 | `04-triggers-sync-and-sign.sql` |
| 03 | `03-balances-view.sql` |
| 05 | `05-types-and-transfer-columns.sql` |
| 07 | `07-fx-cache-rls.sql` |
| 08 | `08-account-currencies.sql` |
| 09 | `09-transfer-lifecycle.sql` — transfers header + complete/delete RPCs |
| 10 | `10-user-settings.sql` — `settings.base_currency` + first-run flag |
| 11 | `11-transfer-fee.sql` — `fee` type + `create_transfer_bundle` RPC |
| 12 | `12-pending-fee.sql` — pending fee on `transfers` + updated bundle/complete RPCs |
| 13 | `13-account-color.sql` — optional `accounts.color_hex` for account colors |
| 06 | `06-split-legacy-transfers.sql` — **only after app deploy + explicit OK** |

Step **06** is not included until you approve splitting legacy `transfer` rows.
