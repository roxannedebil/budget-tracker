import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildPendingTransferOutRow,
  buildSimpleTransferRow,
  buildTransferHeader,
  buildTransferRows,
  parseOptionalFeeMajor,
  shouldUseSplitTransfer,
} from "./transferInsert.js"
import {
  buildTransferFeeRowForTransfer,
  defaultFeeCurrencyForSide,
  feeCurrencyOptionsForSide,
  shouldDeferFeeRow,
  buildPendingFeeHeaderFields,
  computeTransferNetReceivePreview,
  buildTransferBalancePreview,
  validateTransferFeeInput,
  FEE_CHARGE_FROM,
  FEE_CHARGE_TO,
} from "./transferFee.js"
import {
  buildFeePlanPayload,
  encodeFeePlanSubcategory,
  parseFeePlanFromSubcategory,
} from "./transferFeePlan.js"
import {
  formatTransferDeleteConfirmMessage,
  getTransferDeleteBalanceEffects,
  getTransferLegs,
  resolveTransferActionTarget,
} from "./transferLifecycle.js"
import { buildTransferFeeRow } from "./transferInsert.js"

const USER = "00000000-0000-4000-8000-000000000001"
const FROM = "00000000-0000-4000-8000-000000000010"
const TO = "00000000-0000-4000-8000-000000000011"
const TID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const DATE = "2026-01-15T00:00:00.000Z"

const fromAccount = {
  account_id: FROM,
  name: "Bank",
  default_currency: "USD",
  allow_multiple_currencies: true,
  account_currencies: ["EUR"],
}
const toAccount = {
  account_id: TO,
  name: "Wallet",
  default_currency: "EUR",
  allow_multiple_currencies: false,
}

describe("transfer fee on top", () => {
  it("net receive: same currency, fee on To subtracts in receive currency", () => {
    const preview = computeTransferNetReceivePreview({
      sendMajor: 2267.77,
      sendCurrency: "PHP",
      receiveCurrency: "PHP",
      isCrossCurrency: false,
      transferStatus: "completed",
      feeMajor: 50,
      feeCurrency: "PHP",
      chargedTo: FEE_CHARGE_TO,
      deferFee: false,
      ratesTable: { base: "USD", rates: { PHP: 56 } },
    })
    assert.equal(preview.netMajor, 2217.77)
  })

  it("net receive: deferred fee on To still subtracts in pending preview", () => {
    const preview = computeTransferNetReceivePreview({
      sendMajor: 200,
      sendCurrency: "USD",
      receiveCurrency: "EUR",
      receiveMajorGross: 180,
      isCrossCurrency: true,
      transferStatus: "pending",
      feeMajor: 3,
      feeCurrency: "EUR",
      chargedTo: FEE_CHARGE_TO,
      deferFee: true,
      ratesTable: null,
    })
    assert.equal(preview.netMajor, 177)
    assert.equal(preview.feeDeductionMajor, 3)
  })

  it("net receive: fee on From does not reduce amount received", () => {
    const preview = computeTransferNetReceivePreview({
      sendMajor: 100,
      sendCurrency: "USD",
      receiveCurrency: "USD",
      isCrossCurrency: false,
      transferStatus: "completed",
      feeMajor: 5,
      feeCurrency: "USD",
      chargedTo: FEE_CHARGE_FROM,
      deferFee: false,
      ratesTable: null,
    })
    assert.equal(preview.netMajor, 100)
  })

  it("parseOptionalFeeMajor: blank means no fee; filled must be > 0", () => {
    assert.equal(parseOptionalFeeMajor("", true), null)
    assert.equal(parseOptionalFeeMajor("2.5", true), 2.5)
    assert.equal(parseOptionalFeeMajor("0", true), null)
  })

  it("cross-currency completed: send and receive unchanged by fee; rate = recv/sent", () => {
    const sent = 100
    const recv = 90
    const legs = buildTransferRows({
      userId: USER,
      transferId: TID,
      sendMajor: sent,
      receiveMajor: recv,
      sendCurrency: "USD",
      receiveCurrency: "EUR",
      fromAccountId: FROM,
      toAccountId: TO,
      notes: "wire",
      date: DATE,
      status: "completed",
      effectiveRate: recv / sent,
      rateToBaseSend: 1,
      rateToBaseReceive: 1.1,
    })
    const feeRow = buildTransferFeeRowForTransfer({
      userId: USER,
      transferId: TID,
      feeMajor: 5,
      feeCurrency: "USD",
      feeAccountId: FROM,
      date: DATE,
      notes: "wire",
      rateToBase: 1,
      status: "completed",
    })

    assert.equal(legs[0].amount, 100)
    assert.equal(legs[1].amount, 90)
    assert.equal(legs[0].effective_rate, 0.9)
    assert.equal(feeRow.type, "fee")
    assert.equal(feeRow.from_account_id, FROM)
  })

  it("fee currency options only from charged account", () => {
    assert.deepEqual(feeCurrencyOptionsForSide(FEE_CHARGE_FROM, fromAccount, toAccount), [
      "USD",
      "EUR",
    ])
    assert.deepEqual(feeCurrencyOptionsForSide(FEE_CHARGE_TO, fromAccount, toAccount), ["EUR"])
    assert.equal(defaultFeeCurrencyForSide(FEE_CHARGE_FROM, "USD", "EUR"), "USD")
    assert.equal(defaultFeeCurrencyForSide(FEE_CHARGE_TO, "USD", "EUR"), "EUR")
  })

  it("validateTransferFeeInput rejects currency not on account", () => {
    const err = validateTransferFeeInput({
      showFee: true,
      feeAmount: "10",
      chargedTo: FEE_CHARGE_TO,
      feeCurrency: "USD",
      fromAccount,
      toAccount,
    })
    assert.ok(err)
  })

  it("pending transfers defer fee leg until complete", () => {
    assert.equal(
      shouldDeferFeeRow({
        hasFee: true,
        transferStatus: "pending",
      }),
      true
    )
    assert.equal(
      shouldDeferFeeRow({
        hasFee: true,
        transferStatus: "completed",
      }),
      false
    )

    const pendingFromFeeHeader = buildPendingFeeHeaderFields({
      feeMajor: 5,
      feeCurrency: "USD",
      feeAccountId: FROM,
      transferStatus: "pending",
    })
    assert.equal(pendingFromFeeHeader.pending_fee_major, 5)

    const sub = encodeFeePlanSubcategory(
      null,
      buildFeePlanPayload({
        feeMajor: 10,
        feeCurrency: "PHP",
        chargedTo: FEE_CHARGE_TO,
        netReceiveMajor: 990,
        grossReceiveMajor: 1000,
      })
    )
    const parsed = parseFeePlanFromSubcategory(sub)
    assert.equal(parsed.feeMajor, 10)
    assert.equal(parsed.netReceiveMajor, 990)

    const pendingFields = buildPendingFeeHeaderFields({
      feeMajor: 3,
      feeCurrency: "EUR",
      feeAccountId: TO,
      transferStatus: "pending",
    })
    assert.equal(pendingFields.pending_fee_major, 3)
    assert.equal(pendingFields.pending_fee_currency, "EUR")

    const header = buildTransferHeader({
      transferId: TID,
      userId: USER,
      status: "pending",
      fromAccountId: FROM,
      toAccountId: TO,
      sendCurrency: "USD",
      receiveCurrency: "EUR",
      date: DATE,
      notes: null,
      pendingFeeMajor: pendingFields.pending_fee_major,
      pendingFeeCurrency: pendingFields.pending_fee_currency,
      pendingFeeAccountId: pendingFields.pending_fee_account_id,
    })
    assert.equal(header.pending_fee_account_id, TO)

    const out = buildPendingTransferOutRow({
      userId: USER,
      transferId: TID,
      sendMajor: 200,
      sendCurrency: "USD",
      receiveCurrency: "EUR",
      receiveMajor: null,
      fromAccountId: FROM,
      toAccountId: TO,
      notes: "pending",
      date: DATE,
      rateToBaseSend: 1,
    })
    assert.equal(out.amount, 200)
  })

  it("same-currency with fee uses header + transfer + fee rows", () => {
    assert.equal(
      shouldUseSplitTransfer({
        sendCurrency: "EUR",
        receiveCurrency: "EUR",
        status: "completed",
      }),
      false
    )
    const transfer = buildSimpleTransferRow({
      userId: USER,
      amountMajor: 1000,
      currency: "EUR",
      fromAccountId: FROM,
      toAccountId: TO,
      notes: null,
      date: DATE,
      rateToBase: 1,
      transferId: TID,
    })
    const fee = buildTransferFeeRowForTransfer({
      userId: USER,
      transferId: TID,
      feeMajor: 15,
      feeCurrency: "EUR",
      feeAccountId: TO,
      date: DATE,
      rateToBase: 1,
      status: "completed",
    })
    assert.equal(transfer.amount, 1000)
    assert.equal(fee.from_account_id, TO)
  })

  it("balance preview: from debits sent + fee when fee on from in send currency", () => {
    const lines = buildTransferBalancePreview({
      fromAccountName: "Bank",
      toAccountName: "Wallet",
      sendMajor: 100,
      sendCurrency: "USD",
      receiveMajor: 90,
      receiveCurrency: "EUR",
      isCrossCurrency: true,
      transferStatus: "completed",
      feeMajor: 5,
      feeCurrency: "USD",
      chargedTo: FEE_CHARGE_FROM,
      deferFee: false,
    })
    assert.ok(lines.some((l) => l.includes("decrease by") && l.includes("105")))
    assert.ok(lines.some((l) => l.includes("increase by")))
  })

  it("delete confirm includes fee balance effects", () => {
    const legs = [
      {
        type: "transfer_out",
        amount: 100,
        amount_minor: -10000,
        currency: "USD",
        from_account_id: FROM,
        to_account_id: TO,
        transfer_id: TID,
      },
      {
        type: "transfer_in",
        amount: 90,
        amount_minor: 9000,
        currency: "EUR",
        from_account_id: null,
        to_account_id: TO,
        transfer_id: TID,
      },
      {
        type: "fee",
        amount: 5,
        amount_minor: -500,
        currency: "USD",
        category: "Fees",
        from_account_id: FROM,
        transfer_id: TID,
      },
    ]
    const anchor = resolveTransferActionTarget(legs[2], legs)
    assert.equal(anchor.type, "transfer_out")
    const grouped = getTransferLegs(anchor, legs)
    assert.equal(grouped.length, 3)
    const msg = formatTransferDeleteConfirmMessage(legs[2], legs, [
      { account_id: FROM, name: "Bank" },
      { account_id: TO, name: "Wallet" },
    ])
    assert.match(msg, /fee rows/i)
  })

  it("legacy fee rows still use buildTransferFeeRow shape", () => {
    const fee = buildTransferFeeRow({
      userId: USER,
      transferId: TID,
      feeMajor: 5,
      sendCurrency: "USD",
      fromAccountId: FROM,
      date: DATE,
      rateToBase: 1,
      status: "completed",
    })
    assert.equal(fee.type, "fee")
    assert.equal(fee.category, "Fees")
  })
})
