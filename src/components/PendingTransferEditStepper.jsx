import { useEffect, useMemo, useRef, useState } from "react"
import { supabase } from "../supabaseClient"
import CurrencySelect from "./CurrencySelect"
import DatePicker from "./DatePicker"
import FormSection, { FieldHint, InfoTip } from "./FormSection"
import AccountSelect from "./AccountSelect"
import TransferStepperNav from "./TransferStepperNav"
import { useCurrency } from "../context/CurrencyContext"
import {
  getAccountCurrencyOptions,
  getFundedAccountCurrencyOptions,
  accountShowsCurrencyPicker,
  accountSingleCurrencyHint,
  accountDefaultCurrency,
} from "../utils/accountCurrencies"
import { getAccountBalance } from "../utils/accountStats"
import {
  formatCurrency,
  isPositiveMoneyAmount,
  majorToMinor,
  minorToMajor,
  signedMinorForType,
} from "../utils/currency"
import { currencyInputPrefix } from "../utils/currencySymbol"
import { toStoredDate } from "../utils/formatDate"
import { resolveRateToBase } from "../utils/transactionPayload"
import { getMarketTransferQuote } from "../services/rates/ratesService"
import {
  formatReadableExchangeRate,
  marketRateDeviationWarning,
  receivePerSendUnit,
} from "../utils/transferFx"
import {
  buildTransferBalancePreview,
  buildFeeHelperText,
  computeTransferNetReceivePreview,
  defaultFeeCurrencyForSide,
  feeCurrencyOptionsForSide,
  FEE_CHARGE_FROM,
  FEE_CHARGE_TO,
  shouldDeferFeeRow,
  resolveEffectivePendingFee,
  resolvePersistedPendingFee,
  syncPendingTransferFee,
} from "../utils/transferFee"
import { resolvePendingReceiveCurrency } from "../utils/transferLifecycle"
import { completePendingTransfer } from "../services/transferService"
import {
  categoryForTransferType,
  parseOptionalFeeMajor,
  TRANSFER_CATEGORY_OUT,
} from "../utils/transferInsert"
import {
  buildFeePlanPayload,
  encodeFeePlanSubcategory,
  FEE_PLAN_PREFIX,
} from "../utils/transferFeePlan"

export default function PendingTransferEditStepper({
  accounts,
  transactions,
  transferLegs,
  transferKey,
  transferHeader,
  transferHeaderLoaded = true,
  linkedFeeRow = null,
  linkedTransferOut = null,
  pendingTransferDataLoaded = true,
  focusComplete = false,
  onClose,
  onSaved,
}) {
  const { primary, ratesTable } = useCurrency()
  const out = useMemo(() => {
    if (linkedTransferOut) return linkedTransferOut
    return transferLegs.find((t) => t.type === "transfer_out")
  }, [transferLegs, linkedTransferOut])
  const existingFee = useMemo(() => {
    if (pendingTransferDataLoaded && linkedFeeRow) return linkedFeeRow
    return transferLegs.find((t) => t.type === "fee")
  }, [transferLegs, linkedFeeRow, pendingTransferDataLoaded])

  const [transferStep, setTransferStep] = useState(focusComplete ? 3 : 1)
  const [transferFurthestStep, setTransferFurthestStep] = useState(
    focusComplete ? 3 : 1
  )
  const [fromAccountId, setFromAccountId] = useState("")
  const [toAccountId, setToAccountId] = useState("")
  const [sendCurrency, setSendCurrency] = useState(primary)
  const [receiveCurrency, setReceiveCurrency] = useState(primary)
  const [amount, setAmount] = useState("")
  const [receiveAmount, setReceiveAmount] = useState("")
  const [notes, setNotes] = useState("")
  const [date, setDate] = useState("")
  const [category, setCategory] = useState(TRANSFER_CATEGORY_OUT)
  const [subcategory, setSubcategory] = useState("")
  const [showFee, setShowFee] = useState(false)
  const [feeAmount, setFeeAmount] = useState("")
  const [feeChargedTo, setFeeChargedTo] = useState(FEE_CHARGE_FROM)
  const [feeCurrency, setFeeCurrency] = useState(primary)
  const [marketQuote, setMarketQuote] = useState(null)
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const [completing, setCompleting] = useState(false)
  const completeSectionRef = useRef(null)

  useEffect(() => {
    if (!out) return
    setFromAccountId(out.from_account_id || "")
    setToAccountId(out.to_account_id || "")
    setSendCurrency((out.currency || primary).toUpperCase())
    const sendDisplay = Math.abs(Number(out.amount))
    setAmount(Number.isFinite(sendDisplay) && sendDisplay > 0 ? String(sendDisplay) : "")
    setNotes(out.notes || "")
    setDate(out.date ? out.date.slice(0, 10) : "")
    setCategory(out.category || categoryForTransferType("transfer_out"))
    setSubcategory(out.subcategory || "")
    if (transferHeader?.receive_currency) {
      setReceiveCurrency(String(transferHeader.receive_currency).toUpperCase())
    }
    const persisted = resolvePersistedPendingFee(existingFee, transferHeader, out)
    if (persisted) {
      setShowFee(true)
      setFeeAmount(String(persisted.major))
      setFeeCurrency(persisted.currency)
      setFeeChargedTo(persisted.chargedTo)
    } else if (pendingTransferDataLoaded && transferHeaderLoaded) {
      setShowFee(false)
      setFeeAmount("")
    }

    const recvForPlan = (
      transferHeader?.receive_currency ||
      out.currency ||
      primary
    ).toUpperCase()
    if (out.received_amount_minor != null && out.received_amount_minor !== "") {
      setReceiveAmount(String(minorToMajor(out.received_amount_minor, recvForPlan)))
    } else if (
      out.market_rate_estimate != null &&
      Number(out.market_rate_estimate) > 0
    ) {
      setReceiveAmount(String(out.market_rate_estimate))
    } else {
      setReceiveAmount("")
    }
  }, [out, transferHeader, transferHeaderLoaded, pendingTransferDataLoaded, existingFee, primary])

  const fromAccount = accounts.find((a) => a.account_id === fromAccountId)
  const toAccount = accounts.find((a) => a.account_id === toAccountId)
  const sendCur = (sendCurrency || "PHP").toUpperCase()
  const recvCur = (receiveCurrency || "PHP").toUpperCase()
  const isCrossCurrency = sendCur !== recvCur

  useEffect(() => {
    if (toAccount) {
      const def = accountDefaultCurrency(toAccount, primary)
      if (!transferHeader?.receive_currency) setReceiveCurrency(def)
    }
  }, [toAccount, primary, transferHeader])


  const pendingReceiveCurrency = useMemo(
    () =>
      resolvePendingReceiveCurrency({
        transferHeader,
        transferOut: out,
        toAccount,
        primary,
      }),
    [transferHeader, out, toAccount, primary]
  )

  const pendingIsCrossCurrency = isCrossCurrency

  useEffect(() => {
    let cancelled = false
    async function loadEstimate() {
      if (!isPositiveMoneyAmount(amount) || !pendingIsCrossCurrency) {
        setMarketQuote(null)
        return
      }
      const {
        data: { user },
      } = await supabase.auth.getUser()
      const quote = await getMarketTransferQuote({
        userId: user?.id,
        primary,
        fromCurrency: sendCur,
        toCurrency: recvCur,
        sendMajor: Number(amount),
      })
      if (!cancelled) setMarketQuote(quote)
    }
    loadEstimate()
    return () => {
      cancelled = true
    }
  }, [amount, sendCur, recvCur, pendingIsCrossCurrency, primary])

  useEffect(() => {
    if (transferStep !== 3 || !focusComplete) return undefined
    const id = requestAnimationFrame(() => {
      completeSectionRef.current?.scrollIntoView({ block: "start" })
    })
    return () => cancelAnimationFrame(id)
  }, [transferStep, focusComplete])

  const persistedFee = useMemo(
    () => resolvePersistedPendingFee(existingFee, transferHeader, out),
    [existingFee, transferHeader, out]
  )

  const effectiveFee = useMemo(
    () =>
      resolveEffectivePendingFee({
        showFee,
        feeAmount,
        feeCurrency,
        feeChargedTo,
        persistedFee,
      }),
    [showFee, feeAmount, feeCurrency, feeChargedTo, persistedFee]
  )

  const feeMajorPreview = effectiveFee?.major ?? null
  const feeChargedToEffective = effectiveFee?.chargedTo ?? feeChargedTo
  const feeCurrencyEffective = effectiveFee?.currency ?? feeCurrency

  const feeDeferPreview = shouldDeferFeeRow({
    hasFee: feeMajorPreview != null,
    chargedTo: feeChargedToEffective,
    transferStatus: "pending",
    isCrossCurrency: pendingIsCrossCurrency,
  })
  const netReceivePreview = useMemo(
    () =>
      computeTransferNetReceivePreview({
        sendMajor: amount,
        sendCurrency: sendCur,
        receiveCurrency: recvCur,
        receiveMajorGross: receiveAmount,
        isCrossCurrency: pendingIsCrossCurrency,
        transferStatus: "pending",
        feeMajor: feeMajorPreview,
        feeCurrency: feeCurrencyEffective,
        chargedTo: feeChargedToEffective,
        deferFee: feeDeferPreview,
        ratesTable,
        marketReceiveEstimateGross: marketQuote?.estimateMajor ?? null,
      }),
    [
      amount,
      sendCur,
      recvCur,
      receiveAmount,
      pendingIsCrossCurrency,
      feeMajorPreview,
      feeCurrencyEffective,
      feeChargedToEffective,
      feeDeferPreview,
      ratesTable,
      marketQuote,
    ]
  )
  const feeCurrencyOptions = feeCurrencyOptionsForSide(feeChargedTo, fromAccount, toAccount)
  const showFeeCurrencyPicker = feeCurrencyOptions.length >= 2
  const fromFundedCurrencyOptions = useMemo(
    () => getFundedAccountCurrencyOptions(fromAccount, transactions),
    [fromAccount, transactions]
  )

  const previewLines = useMemo(() => {
    if (!fromAccount || !toAccount || !isPositiveMoneyAmount(amount)) return []
    return buildTransferBalancePreview({
      fromAccountName: fromAccount.name,
      toAccountName: toAccount.name,
      sendMajor: amount,
      sendCurrency: sendCur,
      receiveMajor: pendingIsCrossCurrency ? receiveAmount : amount,
      receiveCurrency: recvCur,
      isCrossCurrency: pendingIsCrossCurrency,
      transferStatus: "pending",
      feeMajor: feeMajorPreview,
      feeCurrency: feeCurrencyEffective,
      chargedTo: feeChargedToEffective,
      deferFee: feeDeferPreview,
      netReceiveMajor: netReceivePreview.netMajor,
      netReceiveCurrency: netReceivePreview.receiveCurrency,
    })
  }, [
    fromAccount,
    toAccount,
    amount,
    sendCur,
    receiveAmount,
    recvCur,
    pendingIsCrossCurrency,
    feeMajorPreview,
    feeCurrencyEffective,
    feeChargedToEffective,
    feeDeferPreview,
    netReceivePreview.netMajor,
    netReceivePreview.receiveCurrency,
  ])

  const marketEstimateMajor = useMemo(() => {
    if (!pendingIsCrossCurrency) return null
    if (marketQuote?.estimateMajor != null && Number(marketQuote.estimateMajor) > 0) {
      return Number(marketQuote.estimateMajor)
    }
    if (out?.market_rate_estimate != null && Number(out.market_rate_estimate) > 0) {
      return Number(out.market_rate_estimate)
    }
    return null
  }, [pendingIsCrossCurrency, marketQuote, out?.market_rate_estimate])

  const displayRecvPerSend = useMemo(() => {
    if (!pendingIsCrossCurrency) return null
    const fromAmounts = receivePerSendUnit(
      amount,
      receiveAmount || netReceivePreview.grossMajor
    )
    if (fromAmounts != null) return fromAmounts
    if (out?.effective_rate != null && Number(out.effective_rate) > 0) {
      return Number(out.effective_rate)
    }
    return null
  }, [
    amount,
    receiveAmount,
    pendingIsCrossCurrency,
    netReceivePreview.grossMajor,
    out?.effective_rate,
  ])

  const displayRateLabel = useMemo(
    () =>
      displayRecvPerSend != null
        ? formatReadableExchangeRate({
            primary,
            sendCurrency: sendCur,
            receiveCurrency: pendingReceiveCurrency,
            recvPerSend: displayRecvPerSend,
          })
        : null,
    [displayRecvPerSend, primary, sendCur, pendingReceiveCurrency]
  )

  const resolveGrossReceiveMajor = () => {
    const sendMajor = Math.abs(Number(amount))
    if (!Number.isFinite(sendMajor) || sendMajor <= 0) return null
    if (!pendingIsCrossCurrency) return sendMajor
    if (isPositiveMoneyAmount(receiveAmount)) return Number(receiveAmount)
    if (netReceivePreview.grossMajor != null && netReceivePreview.grossMajor > 0) {
      return netReceivePreview.grossMajor
    }
    if (out?.received_amount_minor != null && out.received_amount_minor !== "") {
      return minorToMajor(out.received_amount_minor, pendingReceiveCurrency)
    }
    return null
  }

  const validateStep = (step) => {
    if (step === 1) {
      if (!fromAccountId || !toAccountId) return "Choose both accounts."
      if (fromAccountId === toAccountId && sendCur === recvCur) {
        return "Use different accounts or currencies."
      }
      return null
    }
    if (step === 2) {
      if (!isPositiveMoneyAmount(amount)) return "Enter amount sent."
      if (pendingIsCrossCurrency && resolveGrossReceiveMajor() == null) {
        return "Enter the amount you expect to arrive (or use the market estimate)."
      }
      if (netReceivePreview.netMajor == null || netReceivePreview.netMajor <= 0) {
        return "Enter amounts so we can show what the receiving account will get."
      }
      return null
    }
    if (step === 3) {
      if (resolveGrossReceiveMajor() == null) {
        return "Go back to Amounts and confirm the receive amount."
      }
      return null
    }
    return null
  }

  const goStep = (next) => {
    setError("")
    const err = validateStep(transferStep)
    if (err) {
      setError(err)
      return
    }
    setTransferStep(next)
    setTransferFurthestStep((prev) => Math.max(prev, next))
  }

  const goStepBack = () => {
    setError("")
    setTransferStep((s) => Math.max(1, s - 1))
  }

  const jumpStep = (n) => {
    setError("")
    setTransferStep(n)
  }

  const isTransfersTableMissing = (error) => {
    const msg = error?.message || ""
    return (
      /relation\s+"?public\.transfers"?\s+does not exist/i.test(msg) ||
      /relation\s+"?transfers"?\s+does not exist/i.test(msg) ||
      (/transfers/i.test(msg) && /does not exist|schema cache/i.test(msg)) ||
      /pending_fee/i.test(msg)
    )
  }

  const withTransferFeeSqlHint = (error) => {
    if (!error?.message) return error
    const msg = error.message
    if (/fee|transactions_type_check|type check|violates check constraint/i.test(msg)) {
      return {
        ...error,
        message: `${msg} Run supabase/multi-currency/11-transfer-fee.sql in the Supabase SQL Editor (adds the fee type).`,
      }
    }
    return error
  }

  const persistPendingDetails = async () => {
    if (!out?.transaction_id) throw new Error("Pending leg not found.")
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user?.id) throw new Error("Not authenticated.")

    const storedDate = date ? toStoredDate(date) : out.date
    const sendMajor = Number(amount)
    const grossReceive = resolveGrossReceiveMajor()
    const feePlanSubcategory =
      effectiveFee != null
        ? encodeFeePlanSubcategory(
            null,
            buildFeePlanPayload({
              feeMajor: effectiveFee.major,
              feeCurrency: feeCurrencyEffective,
              chargedTo: feeChargedToEffective,
              netReceiveMajor: netReceivePreview.netMajor,
              grossReceiveMajor: grossReceive,
            })
          )
        : subcategory?.startsWith(FEE_PLAN_PREFIX)
          ? null
          : subcategory || null

    const payload = {
      amount: sendMajor,
      amount_minor: signedMinorForType("transfer_out", sendMajor, sendCur),
      currency: sendCur,
      from_account_id: fromAccountId,
      to_account_id: toAccountId,
      date: storedDate,
      notes: notes || null,
      category: category || categoryForTransferType("transfer_out"),
      subcategory: feePlanSubcategory,
      rate_to_base: resolveRateToBase(sendCur, primary, ratesTable),
      received_amount_minor:
        grossReceive != null
          ? majorToMinor(grossReceive, pendingReceiveCurrency)
          : null,
      market_rate_estimate: marketQuote?.estimateMajor ?? out?.market_rate_estimate ?? null,
    }
    const { error: outErr } = await supabase
      .from("transactions")
      .update(payload)
      .eq("transaction_id", out.transaction_id)
    if (outErr) throw outErr

    if (transferKey) {
      await supabase
        .from("transfers")
        .update({
          from_account_id: fromAccountId,
          to_account_id: toAccountId,
          send_currency: sendCur,
          receive_currency: recvCur,
          date: storedDate,
          notes: notes || null,
        })
        .eq("transfer_id", transferKey)
    }

    try {
      await syncPendingTransferFee({
        supabaseClient: supabase,
        userId: user.id,
        transferKey,
        showFee: effectiveFee != null,
        feeAmount:
          effectiveFee?.major != null ? String(effectiveFee.major) : feeAmount,
        feeChargedTo: feeChargedToEffective,
        feeCurrency: feeCurrencyEffective,
        sendCur,
        recvCur,
        fromAccountId,
        toAccountId,
        storedDate,
        notes,
        ratesTable,
        primary,
        existingFeeRow: existingFee,
        isTransfersTableMissing,
        withTransferFeeSqlHint,
      })
    } catch (feeErr) {
      throw feeErr instanceof Error ? feeErr : new Error(feeErr?.message || "Could not save fee.")
    }
  }

  const handleSaveDetails = async (e) => {
    e?.preventDefault?.()
    setError("")
    const err = validateStep(1) || validateStep(2)
    if (err) {
      setError(err)
      return
    }
    setSaving(true)
    try {
      await persistPendingDetails()
      onSaved?.()
      onClose()
    } catch (saveErr) {
      setError(saveErr.message || "Could not save.")
    } finally {
      setSaving(false)
    }
  }

  const handleComplete = async () => {
    setError("")
    if (!out || !transferKey) return
    const stepErr = validateStep(3)
    if (stepErr) {
      setError(stepErr)
      return
    }
    if (!focusComplete) {
      try {
        await persistPendingDetails()
      } catch (saveErr) {
        setError(saveErr.message)
        return
      }
    }

    const sendMajor = Number(amount)
    const recvMajor = resolveGrossReceiveMajor()
    if (recvMajor == null || recvMajor <= 0) {
      setError("Go back to Amounts and set the receive amount before completing.")
      return
    }

    const effectiveRate = pendingIsCrossCurrency
      ? receivePerSendUnit(sendMajor, recvMajor)
      : 1
    const recvMinor = signedMinorForType("transfer_in", recvMajor, pendingReceiveCurrency)

    setCompleting(true)
    const { error: completeError } = await completePendingTransfer({
      transferId: transferKey,
      receiveMajor: recvMajor,
      receiveMinor: recvMinor,
      effectiveRate,
      rateToBaseReceive: resolveRateToBase(pendingReceiveCurrency, primary, ratesTable),
      transferOut: out,
      transferHeader,
      toAccount,
      primary,
      ratesTable,
    })
    setCompleting(false)

    if (completeError) {
      setError(completeError.message)
      return
    }
    onSaved?.()
    onClose()
  }

  if (!out) {
    return <p className="inline-alert error">Pending transfer leg not found.</p>
  }

  return (
    <form
      className="transaction-form-grid transfer-form-compact"
      onSubmit={handleSaveDetails}
    >
      {!focusComplete && (
        <p className="form-field form-field-full">
          <span className="badge transfer">Pending</span>{" "}
          <span className="muted">
            This transfer is in transit: the send is already on your books. When the money
            lands, review the amounts below and tap Complete—or delete the transfer if the
            send should be undone.
          </span>
        </p>
      )}

      {!focusComplete && (
        <TransferStepperNav
          step={transferStep}
          furthestStep={transferFurthestStep}
          onStepChange={jumpStep}
        />
      )}

      {!focusComplete && transferStep === 1 && (
        <>
          <FormSection title="From">
            <AccountSelect
              label="Account"
              value={fromAccountId}
              onChange={setFromAccountId}
              accounts={accounts}
              required
            />
            {accountSingleCurrencyHint(fromAccount) && (
              <span className="form-hint muted">{accountSingleCurrencyHint(fromAccount)}</span>
            )}
            {accountShowsCurrencyPicker(fromAccount) && (
              <CurrencySelect
                label="Send currency"
                value={sendCurrency}
                onChange={setSendCurrency}
                allowedCodes={getAccountCurrencyOptions(fromAccount)}
              />
            )}
          </FormSection>
          <FormSection title="To">
            <AccountSelect
              label="Account"
              value={toAccountId}
              onChange={setToAccountId}
              accounts={accounts}
              required
            />
            {accountShowsCurrencyPicker(toAccount) && (
              <CurrencySelect
                label="Receive currency"
                value={receiveCurrency}
                onChange={setReceiveCurrency}
                allowedCodes={getAccountCurrencyOptions(toAccount)}
              />
            )}
          </FormSection>
        </>
      )}

      {!focusComplete && transferStep === 2 && (
        <FormSection title="Amounts">
          <label className="form-field">
            <span>Amount sent</span>
            <div className="amount-input">
              <span className="currency">{currencyInputPrefix(sendCur)}</span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min="0.01"
                step="0.01"
                required
              />
            </div>
            {fromAccountId && fromFundedCurrencyOptions.includes(sendCur) && (
              <FieldHint>
                Available:{" "}
                {formatCurrency(
                  getAccountBalance(fromAccountId, transactions, sendCur),
                  sendCur
                )}
              </FieldHint>
            )}
          </label>

          {pendingIsCrossCurrency && (
            <section
              className="transfer-amount-block form-field-full"
              aria-labelledby="pending-expected-arrive-heading"
            >
              <h3
                id="pending-expected-arrive-heading"
                className="transfer-amount-block-title"
              >
                Amount you expect to arrive
                <InfoTip
                  label="Expected gross amount"
                  text="What should land in the destination account before any fee charged to that account. This is saved and used when you complete the transfer."
                />
              </h3>
              <div className="transfer-amount-row-grid">
                <label className="form-field transfer-amount-field-grow">
                  <span className="sr-only">Amount you expect to arrive</span>
                  <div className="amount-input">
                    <span className="currency">{currencyInputPrefix(recvCur)}</span>
                    <input
                      type="number"
                      placeholder="0.00"
                      value={receiveAmount}
                      onChange={(e) => setReceiveAmount(e.target.value)}
                      min="0.01"
                      step="0.01"
                      required={pendingIsCrossCurrency}
                    />
                  </div>
                </label>
                <div className="form-field transfer-amount-currency-locked">
                  <span>Currency</span>
                  <div
                    className="transfer-step1-currency-badge"
                    aria-label={`Receive currency ${recvCur}`}
                  >
                    {recvCur}
                  </div>
                </div>
              </div>
              {marketQuote && (
                <p className="transfer-fx-estimate-inline muted">
                  Market estimate ≈ {formatCurrency(marketQuote.estimateMajor, recvCur)}
                  <InfoTip
                    label="About the market estimate"
                    text="For typo checking only—you can type your own expected amount."
                  />
                </p>
              )}
            </section>
          )}

          <section
            className="transfer-amount-block transfer-net-receive-block form-field-full"
            aria-labelledby="pending-net-receive-heading"
            aria-live="polite"
          >
            <h3 id="pending-net-receive-heading" className="transfer-net-receive-label">
              Amount you&apos;ll receive
              <InfoTip
                label="Net amount received"
                text="What the To account keeps after a fee charged to that account. Completing the transfer credits this amount (fees are handled separately)."
              />
            </h3>
            <p className="transfer-net-receive-value">
              {netReceivePreview.netMajor != null
                ? formatCurrency(
                    netReceivePreview.netMajor,
                    netReceivePreview.receiveCurrency
                  )
                : "—"}
            </p>
            <p className="transfer-net-receive-meta muted">
              {feeMajorPreview != null ? "After fee · " : ""}
              credited to {toAccount?.name || "To account"} · {recvCur}
              {feeDeferPreview && feeMajorPreview != null
                ? " · Fee will be applied when you complete"
                : ""}
            </p>
            {netReceivePreview.note === "pendingPreview" && (
              <FieldHint>
                We&apos;ll save this with the transfer. On the next step you&apos;ll
                confirm it before the money is credited.
              </FieldHint>
            )}
            {(netReceivePreview.note === "estimate" ||
              netReceivePreview.note === "pendingEstimate") && (
              <FieldHint>
                Based on market or exchange rates; adjust the expected amount above if
                needed.
              </FieldHint>
            )}
            {netReceivePreview.note === "needReceive" && pendingIsCrossCurrency && (
              <FieldHint>Enter the amount you expect to arrive above.</FieldHint>
            )}
          </section>

          {!showFee ? (
            <div className="form-field form-field-full">
              <button type="button" className="btn-sm ghost" onClick={() => setShowFee(true)}>
                + Add fee
              </button>
            </div>
          ) : (
            <div className="form-field form-field-full transfer-fee-block">
              <label className="form-field">
                <span>Fee amount</span>
                <input
                  type="number"
                  value={feeAmount}
                  onChange={(e) => setFeeAmount(e.target.value)}
                  min="0.01"
                  step="0.01"
                />
              </label>
              <label className="form-field">
                <span>Charged to</span>
                <select
                  value={feeChargedTo}
                  onChange={(e) => {
                    const side = e.target.value
                    setFeeChargedTo(side)
                    setFeeCurrency(defaultFeeCurrencyForSide(side, sendCur, recvCur))
                  }}
                >
                  <option value={FEE_CHARGE_FROM}>
                    {fromAccount?.name || "From account"}
                  </option>
                  <option value={FEE_CHARGE_TO}>
                    {toAccount?.name || "To account"}
                  </option>
                </select>
              </label>
              {showFeeCurrencyPicker && (
                <CurrencySelect
                  label="Fee currency"
                  value={feeCurrency}
                  onChange={setFeeCurrency}
                  allowedCodes={feeCurrencyOptions}
                />
              )}
              <FieldHint>
                {buildFeeHelperText(
                  feeChargedTo === FEE_CHARGE_TO ? toAccount?.name : fromAccount?.name,
                  feeCurrency
                )}
              </FieldHint>
            </div>
          )}

          <label className="form-field">
            <span>Date</span>
            <DatePicker value={date} onChange={setDate} />
          </label>
        </FormSection>
      )}

      {(focusComplete || transferStep === 3) && (
        <FormSection title={focusComplete ? "Confirm receive" : "Review and complete"}>
          <FieldHint className="transfer-review-intro-hint">
            {focusComplete ? (
              feeMajorPreview != null ? (
                <>
                  Fee was saved with this transfer. Check that the amount below is what{" "}
                  {toAccount?.name || "the receiving account"} keeps after the fee, then tap{" "}
                  <strong>Complete transfer</strong>.
                </>
              ) : (
                <>
                  Confirm what landed in {toAccount?.name || "the receiving account"}, then tap{" "}
                  <strong>Complete transfer</strong>.
                </>
              )
            ) : (
              <>
                The money has arrived—confirm the amounts below, then tap{" "}
                <strong>Complete transfer</strong> to credit the destination account.
              </>
            )}
          </FieldHint>
          {!focusComplete && previewLines.length > 0 ? (
            <section
              className="transfer-review-impact form-field-full"
              aria-labelledby="pending-complete-impact-heading"
            >
              <h3 id="pending-complete-impact-heading" className="transfer-review-impact-title">
                What will change
              </h3>
              <FieldHint className="transfer-review-impact-hint">
                Completing applies these updates to your balances.
              </FieldHint>
              <ul
                className="transfer-review-impact-list transfer-balance-preview"
                ref={completeSectionRef}
              >
                {previewLines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </section>
          ) : !focusComplete ? (
            <ul className="transfer-balance-preview form-field-full" ref={completeSectionRef} />
          ) : null}

          <div
            className="transfer-net-receive-card transfer-complete-confirm form-field-full"
            ref={focusComplete ? completeSectionRef : undefined}
          >
            <p className="transfer-complete-confirm-lead">
              {feeMajorPreview != null && feeChargedToEffective === FEE_CHARGE_TO
                ? "Is this what you received after the fee?"
                : "Is this what you received from this transfer?"}
            </p>
            {feeMajorPreview != null && feeChargedToEffective === FEE_CHARGE_TO ? (
              <p className="transfer-complete-after-fee-badge">After fee</p>
            ) : null}
            <p className="transfer-net-receive-value transfer-complete-confirm-amount">
              {netReceivePreview.netMajor != null
                ? formatCurrency(
                    netReceivePreview.netMajor,
                    netReceivePreview.receiveCurrency
                  )
                : "—"}
            </p>
            {focusComplete &&
            transferKey &&
            !pendingTransferDataLoaded ? (
              <FieldHint>Loading your saved transfer and fee…</FieldHint>
            ) : null}
            {feeMajorPreview != null &&
            feeChargedToEffective === FEE_CHARGE_TO &&
            netReceivePreview.feeDeductionMajor > 0 &&
            netReceivePreview.grossMajor != null ? (
              <dl className="transfer-complete-fee-breakdown">
                <div className="transfer-complete-fee-breakdown-row">
                  <dt>Amount arrived</dt>
                  <dd>
                    {formatCurrency(
                      netReceivePreview.grossMajor,
                      netReceivePreview.receiveCurrency
                    )}
                  </dd>
                </div>
                <div className="transfer-complete-fee-breakdown-row transfer-complete-fee-breakdown-deduct">
                  <dt>
                    Fee
                    {feeDeferPreview ? " (deducted when you complete)" : ""}
                  </dt>
                  <dd className="expense-text">
                    −
                    {formatCurrency(
                      netReceivePreview.feeDeductionMajor,
                      netReceivePreview.receiveCurrency
                    )}
                  </dd>
                </div>
                <div className="transfer-complete-fee-breakdown-row transfer-complete-fee-breakdown-total">
                  <dt>You receive (after fee)</dt>
                  <dd>
                    {formatCurrency(
                      netReceivePreview.netMajor,
                      netReceivePreview.receiveCurrency
                    )}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="muted transfer-complete-confirm-meta">
                {toAccount?.name || "Destination account"} ·{" "}
                {netReceivePreview.receiveCurrency}
                {feeMajorPreview != null && feeChargedToEffective === FEE_CHARGE_FROM ? (
                  <> · Sending-account fee—not taken from this receive amount</>
                ) : null}
              </p>
            )}
            <FieldHint>
              {focusComplete
                ? "Not correct? Close and edit the pending transfer (pencil icon) to change amounts or fee."
                : "Should match what you planned on the Amounts step. Tap Back to edit before completing if anything looks off."}
            </FieldHint>
          </div>

          {pendingIsCrossCurrency &&
          (marketEstimateMajor != null || displayRateLabel) ? (
            <div className="transfer-fx-summary form-field-full">
              <h3 className="transfer-fx-summary-title">Exchange rate</h3>
              {marketEstimateMajor != null ? (
                <p className="transfer-fx-summary-line">
                  <span className="transfer-fx-summary-label">Market estimate</span>
                  <span className="transfer-fx-summary-value">
                    ≈ {formatCurrency(marketEstimateMajor, recvCur)}
                  </span>
                </p>
              ) : null}
              {displayRateLabel ? (
                <p className="transfer-fx-summary-line">
                  <span className="transfer-fx-summary-label">Rate you got</span>
                  <span className="transfer-fx-summary-value">{displayRateLabel}</span>
                </p>
              ) : null}
              <FieldHint>
                Market estimate is for comparison; rate you got comes from your saved send and
                receive amounts.
              </FieldHint>
            </div>
          ) : null}

          {!focusComplete && (
            <label className="form-field form-field-full">
              <span>Notes</span>
              <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </label>
          )}

        </FormSection>
      )}

      <div className="transfer-stepper-actions form-field-full">
        <div className="transfer-stepper-actions-leading">
          {!focusComplete && transferStep > 1 && (
            <button type="button" className="btn-secondary btn-sm" onClick={goStepBack}>
              Back
            </button>
          )}
        </div>
        <div className="transfer-stepper-actions-trailing">
          {!focusComplete && transferStep < 3 && (
            <button
              type="button"
              className="submit-btn primary transfer"
              onClick={() => goStep(transferStep + 1)}
            >
              Continue
            </button>
          )}
          {(focusComplete || transferStep === 3) && (
            <button
              type="button"
              className="submit-btn primary transfer"
              disabled={
                completing ||
                saving ||
                (Boolean(transferKey) && !pendingTransferDataLoaded)
              }
              onClick={handleComplete}
            >
              {completing ? "Completing…" : "Complete transfer"}
            </button>
          )}
        </div>
      </div>

      {!focusComplete && transferStep < 3 && (
        <div className="txn-form-footer modal-form-actions form-field-full">
          <button type="submit" className="btn-secondary btn-sm" disabled={saving}>
            {saving ? "Saving…" : "Save and close"}
          </button>
        </div>
      )}

      {error && (
        <p className="inline-alert error form-row-alert" role="alert">
          {error}
        </p>
      )}
    </form>
  )
}
