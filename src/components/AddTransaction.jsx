import "../App.css"

import { useEffect, useMemo, useState } from "react"
import { supabase } from "../supabaseClient"
import CategorySelect from "./CategorySelect"
import DatePicker from "./DatePicker"
import CurrencySelect from "./CurrencySelect"
import {
  getExpenseCategories,
  getIncomeCategories,
  persistCategorySelection,
} from "../utils/categories"
import {
  formatDisplayDate,
  getTodayDateInputValue,
  toStoredDate,
} from "../utils/formatDate"
import { resolveIncomeSource } from "../utils/incomeSource"
import { useCurrency } from "../context/CurrencyContext"
import {
  getAccountCurrencyOptions,
  getFundedAccountCurrencyOptions,
  accountShowsCurrencyPicker,
  accountSingleCurrencyHint,
  accountDefaultCurrency,
  accountAllowsSameAccountTransfer,
  isSameAccountTransferBlocked,
} from "../utils/accountCurrencies"
import { getAccountBalance } from "../utils/accountStats"
import {
  formatCurrency,
  isPositiveMoneyAmount,
} from "../utils/currency"
import { currencyInputPrefix } from "../utils/currencySymbol"
import { buildIncomeExpensePayload, resolveRateToBase } from "../utils/transactionPayload"
import {
  buildSimpleTransferRow,
  buildTransferHeader,
  buildPendingTransferOutRow,
  buildTransferRows,
  parseOptionalFeeMajor,
  shouldUseSplitTransfer,
} from "../utils/transferInsert"
import {
  FEE_CHARGE_FROM,
  FEE_CHARGE_TO,
  buildPendingFeeHeaderFields,
  buildTransferBalancePreview,
  buildTransferFeeRowForTransfer,
  defaultFeeCurrencyForSide,
  resolveFeeAccountId,
  shouldDeferFeeRow,
  validateFromBalanceForTransfer,
  validateToBalanceForFee,
  validateTransferFeeInput,
  buildFeeHelperText,
  computeTransferNetReceivePreview,
} from "../utils/transferFee"
import { buildFeePlanPayload, encodeFeePlanSubcategory } from "../utils/transferFeePlan"
import { createTransferBundle } from "../services/transferService"
import { getMarketTransferQuote } from "../services/rates/ratesService"
import {
  formatReadableExchangeRate,
  marketRateDeviationWarning,
  receivePerSendUnit,
} from "../utils/transferFx"
import FormSection, { FieldHint, InfoTip } from "./FormSection"
import TransferStepperNav from "./TransferStepperNav"
import Icon from "./icons/Icons"
import AccountSelect, { AccountNameWithColor } from "./AccountSelect"
import { accountColorStyleVars } from "../utils/accountColor"

function AddTransaction({ accounts, transactions, profile, onAdd }) {
  const { primary, ratesTable } = useCurrency()

  const [amount, setAmount] = useState("")
  const [currency, setCurrency] = useState(primary)
  const [type, setType] = useState("expense")
  const [category, setCategory] = useState("")
  const [subcategory, setSubcategory] = useState("")
  const [incomeCategory, setIncomeCategory] = useState("")
  const [incomeSubcategory, setIncomeSubcategory] = useState("")
  const [notes, setNotes] = useState("")
  const [date, setDate] = useState(() => getTodayDateInputValue())
  const [fromAccountId, setFromAccountId] = useState("")
  const [toAccountId, setToAccountId] = useState("")
  const [sendCurrency, setSendCurrency] = useState(primary)
  const [receiveCurrency, setReceiveCurrency] = useState(primary)
  const [receiveAmount, setReceiveAmount] = useState("")
  const [marketQuote, setMarketQuote] = useState(null)
  const [transferStatus, setTransferStatus] = useState("completed")
  const [showFee, setShowFee] = useState(false)
  const [feeAmount, setFeeAmount] = useState("")
  const [feeChargedTo, setFeeChargedTo] = useState(FEE_CHARGE_FROM)
  const [feeCurrency, setFeeCurrency] = useState(primary)
  const [transferStep, setTransferStep] = useState(1)
  const [transferFurthestStep, setTransferFurthestStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [transferFieldError, setTransferFieldError] = useState(null)
  const [categoryKey, setCategoryKey] = useState(0)

  useEffect(() => {
    setCurrency(primary)
    setSendCurrency(primary)
    setReceiveCurrency(primary)
  }, [primary])

  const fromAccount = accounts.find((a) => a.account_id === fromAccountId)
  const toAccount = accounts.find((a) => a.account_id === toAccountId)

  const fromCurrencyOptions = useMemo(
    () => getAccountCurrencyOptions(fromAccount),
    [fromAccount]
  )
  const fromFundedCurrencyOptions = useMemo(
    () => getFundedAccountCurrencyOptions(fromAccount, transactions),
    [fromAccount, transactions]
  )
  const toCurrencyOptions = useMemo(
    () => getAccountCurrencyOptions(toAccount),
    [toAccount]
  )
  const sendCur = (sendCurrency || "PHP").toUpperCase()
  const recvCur = (receiveCurrency || "PHP").toUpperCase()
  const transferReceiveCurrencyOptions = toCurrencyOptions
  const transferSendCurrencyOptions = useMemo(() => {
    if (
      type === "transfer" &&
      fromAccountId &&
      toAccountId &&
      fromAccountId === toAccountId
    ) {
      return fromCurrencyOptions
    }
    return fromFundedCurrencyOptions
  }, [
    type,
    fromAccountId,
    toAccountId,
    fromCurrencyOptions,
    fromFundedCurrencyOptions,
  ])
  const showFromCurrencyPicker = accountShowsCurrencyPicker(fromAccount)
  const showToCurrencyPicker = accountShowsCurrencyPicker(toAccount)
  const fromSingleCurrencyHint = accountSingleCurrencyHint(fromAccount)
  const toSingleCurrencyHint = accountSingleCurrencyHint(toAccount)
  const isCrossCurrency = sendCur !== recvCur
  const transferSendBalanceMajor = useMemo(() => {
    if (type !== "transfer" || !fromAccountId) return null
    return getAccountBalance(fromAccountId, transactions, sendCur)
  }, [type, fromAccountId, transactions, sendCur])

  useEffect(() => {
    if (!fromAccount) return
    const def = accountDefaultCurrency(fromAccount, primary)
    if (type === "expense") {
      setCurrency(def)
      return
    }
    if (type === "transfer") {
      const funded = getFundedAccountCurrencyOptions(fromAccount, transactions)
      setSendCurrency((prev) => {
        const cur = (prev || def).toUpperCase()
        if (funded.includes(cur)) return cur
        return funded[0] || def
      })
      return
    }
    setSendCurrency(def)
  }, [fromAccount, primary, type, transactions])

  useEffect(() => {
    if (toAccount) {
      const def = accountDefaultCurrency(toAccount, primary)
      setReceiveCurrency(def)
      if (type === "income") setCurrency(def)
    }
  }, [toAccount, primary, type])

  useEffect(() => {
    if (type !== "transfer" || !fromAccountId || !toAccountId) return
    if (
      fromAccountId === toAccountId &&
      isSameAccountTransferBlocked(fromAccountId, fromAccount)
    ) {
      setToAccountId("")
    }
  }, [type, fromAccountId, toAccountId, fromAccount])

  useEffect(() => {
    if (type !== "transfer" || !toAccountId || !toCurrencyOptions.length) return
    setReceiveCurrency((prev) => {
      const cur = (prev || "").toUpperCase()
      const kept = toCurrencyOptions.find((c) => c.toUpperCase() === cur)
      return kept || toCurrencyOptions[0]
    })
  }, [type, toAccountId, toCurrencyOptions])

  useEffect(() => {
    if (type !== "transfer" || !fromAccountId) return
    const sendOpts =
      fromAccountId === toAccountId && toAccountId
        ? fromCurrencyOptions
        : fromFundedCurrencyOptions
    if (!sendOpts.length) return
    setSendCurrency((prev) => {
      const cur = (prev || "").toUpperCase()
      const kept = sendOpts.find((c) => c.toUpperCase() === cur)
      return kept || sendOpts[0]
    })
  }, [
    type,
    fromAccountId,
    toAccountId,
    fromCurrencyOptions,
    fromFundedCurrencyOptions,
  ])

  useEffect(() => {
    if (!isCrossCurrency) setReceiveAmount("")
  }, [isCrossCurrency])

  useEffect(() => {
    if (type !== "transfer") return
    setTransferStep(1)
    setTransferFurthestStep(1)
  }, [type])

  useEffect(() => {
    const def = defaultFeeCurrencyForSide(feeChargedTo, sendCur, recvCur)
    setFeeCurrency(def)
  }, [feeChargedTo, sendCur, recvCur])

  useEffect(() => {
    let cancelled = false
    async function loadEstimate() {
      if (type !== "transfer" || !isPositiveMoneyAmount(amount) || !isCrossCurrency) {
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
  }, [type, amount, sendCur, recvCur, isCrossCurrency, primary])

  const transferFeeMajorPreview = useMemo(
    () => (showFee ? parseOptionalFeeMajor(feeAmount, true) : null),
    [showFee, feeAmount]
  )

  const feeDeferPreview = useMemo(
    () =>
      shouldDeferFeeRow({
        hasFee: transferFeeMajorPreview != null,
        chargedTo: feeChargedTo,
        transferStatus,
        isCrossCurrency,
      }),
    [transferFeeMajorPreview, feeChargedTo, transferStatus, isCrossCurrency]
  )

  const effectiveRecvPerSend = useMemo(
    () => receivePerSendUnit(amount, receiveAmount),
    [amount, receiveAmount]
  )

  const feeHelperAccountName = useMemo(() => {
    if (feeChargedTo === FEE_CHARGE_TO) return toAccount?.name
    return fromAccount?.name
  }, [feeChargedTo, fromAccount, toAccount])

  const feeCurDisplay = (
    feeCurrency || defaultFeeCurrencyForSide(feeChargedTo, sendCur, recvCur)
  ).toUpperCase()

  const netReceivePreview = useMemo(
    () =>
      computeTransferNetReceivePreview({
        sendMajor: amount,
        sendCurrency: sendCur,
        receiveCurrency: recvCur,
        receiveMajorGross: receiveAmount,
        isCrossCurrency,
        transferStatus,
        feeMajor: transferFeeMajorPreview,
        feeCurrency: feeCurDisplay,
        chargedTo: feeChargedTo,
        deferFee: feeDeferPreview,
        ratesTable,
        marketReceiveEstimateGross: marketQuote?.estimateMajor ?? null,
      }),
    [
      amount,
      sendCur,
      recvCur,
      receiveAmount,
      isCrossCurrency,
      transferStatus,
      transferFeeMajorPreview,
      feeCurDisplay,
      feeChargedTo,
      feeDeferPreview,
      ratesTable,
      marketQuote?.estimateMajor,
    ]
  )

  const transferBalancePreviewLines = useMemo(() => {
    if (type !== "transfer" || !fromAccount || !toAccount) return []
    if (!isPositiveMoneyAmount(amount)) return []
    return buildTransferBalancePreview({
      fromAccountName: fromAccount.name,
      toAccountName: toAccount.name,
      sendMajor: amount,
      sendCurrency: sendCur,
      receiveMajor: isCrossCurrency ? receiveAmount : amount,
      receiveCurrency: recvCur,
      isCrossCurrency,
      transferStatus,
      feeMajor: transferFeeMajorPreview,
      feeCurrency: feeCurrency,
      chargedTo: feeChargedTo,
      deferFee: feeDeferPreview,
      netReceiveMajor: netReceivePreview.netMajor,
      netReceiveCurrency: netReceivePreview.receiveCurrency,
    })
  }, [
    type,
    fromAccount,
    toAccount,
    amount,
    sendCur,
    receiveAmount,
    recvCur,
    isCrossCurrency,
    transferStatus,
    transferFeeMajorPreview,
    feeCurrency,
    feeChargedTo,
    feeDeferPreview,
    netReceivePreview.netMajor,
    netReceivePreview.receiveCurrency,
  ])

  const effectiveRateLabel = useMemo(() => {
    if (!isCrossCurrency || !effectiveRecvPerSend) return null
    return formatReadableExchangeRate({
      primary,
      sendCurrency: sendCur,
      receiveCurrency: recvCur,
      recvPerSend: effectiveRecvPerSend,
    })
  }, [isCrossCurrency, effectiveRecvPerSend, primary, sendCur, recvCur])

  const marketRateLabel = useMemo(() => {
    if (!marketQuote?.recvPerSend) return null
    return formatReadableExchangeRate({
      primary,
      sendCurrency: sendCur,
      receiveCurrency: recvCur,
      recvPerSend: marketQuote.recvPerSend,
    })
  }, [marketQuote, primary, sendCur, recvCur])

  const rateTypoWarning = useMemo(() => {
    if (!isCrossCurrency || !effectiveRecvPerSend || !marketQuote?.recvPerSend) return null
    return marketRateDeviationWarning({
      primary,
      sendCurrency: sendCur,
      receiveCurrency: recvCur,
      recvPerSendEffective: effectiveRecvPerSend,
      recvPerSendMarket: marketQuote.recvPerSend,
    })
  }, [isCrossCurrency, effectiveRecvPerSend, marketQuote, primary, sendCur, recvCur])

  const expenseCategories = useMemo(
    () => getExpenseCategories(transactions),
    [transactions, categoryKey]
  )

  const incomeCategories = useMemo(
    () => getIncomeCategories(transactions),
    [transactions, categoryKey]
  )

  const resetForm = () => {
    setAmount("")
    setReceiveAmount("")
    setMarketQuote(null)
    setCategory("")
    setSubcategory("")
    setIncomeCategory("")
    setIncomeSubcategory("")
    setNotes("")
    setType("expense")
    setFromAccountId("")
    setToAccountId("")
    setTransferStatus("completed")
    setShowFee(false)
    setFeeAmount("")
    setFeeChargedTo(FEE_CHARGE_FROM)
    setFeeCurrency(primary)
    setTransferStep(1)
    setTransferFurthestStep(1)
    setTransferFieldError(null)
    setError("")
    setDate(getTodayDateInputValue())
    setCurrency(primary)
  }

  const handleCategoryChange = (cat, sub, meta) => {
    setCategory(cat)
    setSubcategory(sub)
    if (meta?.added) setCategoryKey((k) => k + 1)
  }

  const handleIncomeCategoryChange = (cat, sub, meta) => {
    setIncomeCategory(cat)
    setIncomeSubcategory(sub)
    if (meta?.added) setCategoryKey((k) => k + 1)
  }

  const validateTransferStep1Fields = () => {
    if (!fromAccountId || !toAccountId) {
      return { field: "toAccount", message: "Choose both accounts." }
    }
    if (fromAccountId === toAccountId) {
      if (!accountAllowsSameAccountTransfer(fromAccount)) {
        return {
          field: "toAccount",
          message:
            "Choose a different to account—single-currency accounts cannot transfer to themselves.",
        }
      }
      if (sendCur === recvCur) {
        return {
          field: "receiveCurrency",
          message: "Choose different send and receive currencies.",
        }
      }
    }
    if (!fromCurrencyOptions.includes(sendCur)) {
      return {
        field: "sendCurrency",
        message: "Send currency is not on the from account.",
      }
    }
    if (!fromFundedCurrencyOptions.includes(sendCur)) {
      return {
        field: "sendCurrency",
        message: "No balance in the send currency on this account.",
      }
    }
    if (!toCurrencyOptions.includes(recvCur)) {
      return {
        field: "receiveCurrency",
        message: "Receive currency is not on the to account.",
      }
    }
    return null
  }

  const validateTransferStep = (step) => {
    if (step === 1) {
      return validateTransferStep1Fields()
    }
    if (step === 2) {
      if (!isPositiveMoneyAmount(amount)) {
        return "Enter an amount sent greater than zero."
      }
      if (
        isCrossCurrency &&
        transferStatus === "completed" &&
        !isPositiveMoneyAmount(receiveAmount)
      ) {
        return "Enter the amount that arrived."
      }
      return validateTransferFeeInput({
        showFee,
        feeAmount,
        chargedTo: feeChargedTo,
        feeCurrency,
        fromAccount,
        toAccount,
      })
    }
    return null
  }

  const applyTransferValidationResult = (err) => {
    if (!err) {
      setTransferFieldError(null)
      setError("")
      return true
    }
    if (typeof err === "object" && err.field && err.message) {
      setTransferFieldError(err)
      setError("")
      return false
    }
    setTransferFieldError(null)
    setError(typeof err === "string" ? err : err.message || "")
    return false
  }

  const goTransferStep = (next) => {
    const err = validateTransferStep(transferStep)
    if (!applyTransferValidationResult(err)) return
    setTransferStep(next)
    setTransferFurthestStep((prev) => Math.max(prev, next))
  }

  const goTransferStepBack = () => {
    setTransferFieldError(null)
    setError("")
    setTransferStep((s) => Math.max(1, s - 1))
  }

  const jumpTransferStep = (n) => {
    setTransferFieldError(null)
    setError("")
    setTransferStep(n)
  }

  const clearTransferStep1Errors = () => setTransferFieldError(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")

    if (type === "transfer" && transferStep < 3) {
      goTransferStep(transferStep + 1)
      return
    }

    if (type === "income") {
      if (!toAccountId) {
        setError("Select which account to add money to.")
        return
      }
      if (!incomeCategory) {
        setError("Select or add an income category.")
        return
      }
    }

    if (type === "expense") {
      if (!fromAccountId) {
        setError("Select which account to spend from.")
        return
      }
      if (!category) {
        setError("Select a category.")
        return
      }
    }

    if (type === "transfer") {
      const step1Err = validateTransferStep1Fields()
      if (step1Err) {
        applyTransferValidationResult(step1Err)
        setTransferStep(1)
        return
      }
    }

    if (!isPositiveMoneyAmount(amount)) {
      setError("Enter an amount greater than zero.")
      return
    }

    if (
      type === "transfer" &&
      isCrossCurrency &&
      transferStatus === "completed" &&
      !isPositiveMoneyAmount(receiveAmount)
    ) {
      setError("Enter the amount that arrived, greater than zero.")
      return
    }

    const feeMajor =
      type === "transfer" ? parseOptionalFeeMajor(feeAmount, showFee) : null
    if (type === "transfer") {
      const feeErr = validateTransferFeeInput({
        showFee,
        feeAmount,
        chargedTo: feeChargedTo,
        feeCurrency,
        fromAccount,
        toAccount,
      })
      if (feeErr) {
        setError(feeErr)
        return
      }

      const deferFee = shouldDeferFeeRow({
        hasFee: feeMajor != null,
        chargedTo: feeChargedTo,
        transferStatus,
        isCrossCurrency,
      })

      const fromBalErr = validateFromBalanceForTransfer({
        fromAccountId,
        sendCurrency: sendCur,
        sendMajor: amount,
        feeMajor,
        feeCurrency,
        chargedTo: feeChargedTo,
        deferFee,
        transactions,
        getBalance: getAccountBalance,
      })
      if (fromBalErr) {
        setError(fromBalErr)
        return
      }

      const toBalErr = validateToBalanceForFee({
        toAccountId,
        feeMajor,
        feeCurrency,
        receiveCurrency: recvCur,
        chargedTo: feeChargedTo,
        deferFee,
        transferStatus,
        transactions,
        getBalance: getAccountBalance,
      })
      if (toBalErr) {
        setError(toBalErr)
        return
      }
    }

    setSubmitting(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    const incomeSource =
      type === "income" ? resolveIncomeSource(type, incomeCategory) : null

    if (type === "expense" && category) {
      persistCategorySelection("expense", category, subcategory)
    }

    if (type === "income" && incomeCategory) {
      persistCategorySelection("income", incomeCategory, incomeSubcategory)
    }

    const storedDate = date ? toStoredDate(date) : new Date().toISOString()

    let rows = []
    let insertError = null
    let transferBundle = null

    if (type === "transfer") {
      const sendMajor = Number(amount)
      const recvMajor = isCrossCurrency ? Number(receiveAmount) : sendMajor
      const hasFee = feeMajor != null
      const feeAccountId = resolveFeeAccountId(feeChargedTo, fromAccountId, toAccountId)
      const feeCur = (feeCurrency || sendCur).toUpperCase()
      const deferFee = shouldDeferFeeRow({
        hasFee,
        chargedTo: feeChargedTo,
        transferStatus,
        isCrossCurrency,
      })
      const split = shouldUseSplitTransfer({
        sendCurrency: sendCur,
        receiveCurrency: recvCur,
        status: transferStatus,
      })

      const appendFeeNow = (list, transferId) => {
        if (!hasFee || deferFee) return list
        return [
          ...list,
          buildTransferFeeRowForTransfer({
            userId: user?.id,
            transferId,
            feeMajor,
            feeCurrency: feeCur,
            feeAccountId,
            date: storedDate,
            notes,
            rateToBase: resolveRateToBase(feeCur, primary, ratesTable),
            status: transferStatus,
          }),
        ]
      }

      const pendingFeeFields = buildPendingFeeHeaderFields({
        feeMajor,
        feeCurrency: feeCur,
        feeAccountId,
        transferStatus,
      })

      if (split) {
        const transferId = crypto.randomUUID()
        const header = buildTransferHeader({
          transferId,
          userId: user?.id,
          status: transferStatus,
          fromAccountId,
          toAccountId,
          sendCurrency: sendCur,
          receiveCurrency: recvCur,
          date: storedDate,
          notes,
          pendingFeeMajor: pendingFeeFields.pending_fee_major,
          pendingFeeCurrency: pendingFeeFields.pending_fee_currency,
          pendingFeeAccountId: pendingFeeFields.pending_fee_account_id,
        })

        if (transferStatus === "pending") {
          const pendingReceivePreview = computeTransferNetReceivePreview({
            sendMajor: amount,
            sendCurrency: sendCur,
            receiveCurrency: recvCur,
            receiveMajorGross: receiveAmount,
            isCrossCurrency,
            transferStatus: "completed",
            feeMajor,
            feeCurrency: feeCur,
            chargedTo: feeChargedTo,
            deferFee,
            ratesTable,
            marketReceiveEstimateGross: marketQuote?.estimateMajor ?? null,
          })
          const plannedReceiveMajor =
            pendingReceivePreview.grossMajor ??
            (isCrossCurrency ? marketQuote?.estimateMajor : sendMajor)

          const feePlanSubcategory = hasFee
            ? encodeFeePlanSubcategory(
                null,
                buildFeePlanPayload({
                  feeMajor,
                  feeCurrency: feeCur,
                  chargedTo: feeChargedTo,
                  netReceiveMajor: pendingReceivePreview.netMajor,
                  grossReceiveMajor: plannedReceiveMajor,
                })
              )
            : null

          rows = appendFeeNow(
            [
              buildPendingTransferOutRow({
                userId: user?.id,
                transferId,
                sendMajor,
                sendCurrency: sendCur,
                receiveCurrency: recvCur,
                receiveMajor: plannedReceiveMajor,
                fromAccountId,
                toAccountId,
                notes,
                date: storedDate,
                marketRateEstimate:
                  marketQuote?.estimateMajor ?? plannedReceiveMajor ?? null,
                effectiveRate: null,
                rateToBaseSend: resolveRateToBase(sendCur, primary, ratesTable),
                subcategory: feePlanSubcategory,
              }),
            ],
            transferId
          )
        } else {
          rows = appendFeeNow(
            buildTransferRows({
              userId: user?.id,
              transferId,
              sendMajor,
              receiveMajor: recvMajor,
              sendCurrency: sendCur,
              receiveCurrency: recvCur,
              fromAccountId,
              toAccountId,
              notes,
              date: storedDate,
              status: transferStatus,
              marketRateEstimate: marketQuote?.estimateMajor ?? null,
              effectiveRate: effectiveRecvPerSend,
              rateToBaseSend: resolveRateToBase(sendCur, primary, ratesTable),
              rateToBaseReceive: resolveRateToBase(recvCur, primary, ratesTable),
            }),
            transferId
          )
        }
        transferBundle = { header, transactions: rows }
      } else if (hasFee) {
        const transferId = crypto.randomUUID()
        const header = buildTransferHeader({
          transferId,
          userId: user?.id,
          status: "completed",
          fromAccountId,
          toAccountId,
          sendCurrency: sendCur,
          receiveCurrency: recvCur,
          date: storedDate,
          notes,
        })
        rows = appendFeeNow(
          [
            buildSimpleTransferRow({
              userId: user?.id,
              amountMajor: sendMajor,
              currency: sendCur,
              fromAccountId,
              toAccountId,
              notes,
              date: storedDate,
              rateToBase: resolveRateToBase(sendCur, primary, ratesTable),
              transferId,
            }),
          ],
          transferId
        )
        transferBundle = { header, transactions: rows }
      } else {
        rows = [
          buildSimpleTransferRow({
            userId: user?.id,
            amountMajor: sendMajor,
            currency: sendCur,
            fromAccountId,
            toAccountId,
            notes,
            date: storedDate,
            rateToBase: resolveRateToBase(sendCur, primary, ratesTable),
          }),
        ]
      }
    } else if (type === "income") {
      rows = [
        buildIncomeExpensePayload({
          type: "income",
          amountMajor: amount,
          currency,
          primary,
          ratesTable,
          fields: {
            user_id: user?.id,
            category: incomeCategory,
            subcategory: incomeSubcategory || null,
            notes,
            date: storedDate,
            income_source: incomeSource,
            from_account_id: null,
            to_account_id: toAccountId,
          },
        }),
      ]
    } else {
      rows = [
        buildIncomeExpensePayload({
          type: "expense",
          amountMajor: amount,
          currency,
          primary,
          ratesTable,
          fields: {
            user_id: user?.id,
            category,
            subcategory: subcategory || null,
            notes,
            date: storedDate,
            income_source: null,
            from_account_id: fromAccountId,
            to_account_id: null,
          },
        }),
      ]
    }

    if (transferBundle) {
      const { error } = await createTransferBundle(transferBundle)
      insertError = error
    } else if (rows.length > 0) {
      const { error } = await supabase.from("transactions").insert(rows)
      insertError = error
    }

    setSubmitting(false)

    if (insertError) {
      setError(insertError.message)
      return
    }

    resetForm()
    setCategoryKey((k) => k + 1)
    onAdd()
  }

  return (
    <div className="card txn-form-card module-card">
      <div className="card-header txn-card-header">
        <h2>New Transaction</h2>
        <div className="type-toggle-segmented" role="group" aria-label="Transaction type">
          <button
            type="button"
            className={type === "expense" ? "active expense" : ""}
            onClick={() => setType("expense")}
          >
            <span className="type-dot expense"></span> Expense
          </button>
          <button
            type="button"
            className={type === "income" ? "active income" : ""}
            onClick={() => setType("income")}
          >
            <span className="type-dot income"></span> Income
          </button>
          <button
            type="button"
            className={type === "transfer" ? "active transfer" : ""}
            onClick={() => setType("transfer")}
          >
            <span className="type-dot transfer"></span> Transfer
          </button>
        </div>
      </div>

      {accounts.length === 0 ? (
        <p className="inline-alert error">Add an account first.</p>
      ) : (
        <form
          onSubmit={handleSubmit}
          className={`transaction-form-grid txn-form-layout${
            type === "transfer" ? " transfer-form-compact" : " txn-form-simple"
          }`}
        >
          {type === "expense" && (
            <>
              <div className="txn-form-row">
                <label className="form-field">
                  <span>Date</span>
                  <DatePicker value={date} onChange={setDate} />
                </label>

                <AccountSelect
                  label="Spend from"
                  value={fromAccountId}
                  onChange={setFromAccountId}
                  accounts={accounts}
                  required
                />

                <div className="txn-form-currency-cell">
                  {showFromCurrencyPicker && (
                    <>
                      <CurrencySelect
                        label="Currency"
                        value={currency}
                        onChange={setCurrency}
                        allowedCodes={fromCurrencyOptions}
                      />
                      <FieldHint>Amount is recorded in this currency.</FieldHint>
                    </>
                  )}
                </div>
              </div>

              <div className="txn-form-row">
                <CategorySelect
                  key={categoryKey}
                  kind="expense"
                  category={category}
                  subcategory={subcategory}
                  categories={expenseCategories}
                  transactions={transactions}
                  onChange={handleCategoryChange}
                  placeholder="Select category"
                />

                <label className="form-field">
                  <span>Amount</span>
                  <div className="amount-input">
                    <span className="currency">{currencyInputPrefix(currency)}</span>
                    <input
                      type="number"
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      min="0.01"
                      step="0.01"
                      required
                    />
                  </div>
                </label>
              </div>
            </>
          )}

          {type === "income" && (
            <>
              <div className="txn-form-row">
                <label className="form-field">
                  <span>Date</span>
                  <DatePicker value={date} onChange={setDate} />
                </label>

                <AccountSelect
                  label="Add to account"
                  value={toAccountId}
                  onChange={setToAccountId}
                  accounts={accounts}
                  required
                />

                <div className="txn-form-currency-cell">
                  {showToCurrencyPicker && (
                    <>
                      <CurrencySelect
                        label="Currency"
                        value={currency}
                        onChange={setCurrency}
                        allowedCodes={toCurrencyOptions}
                      />
                      <FieldHint>Amount is recorded in this currency.</FieldHint>
                    </>
                  )}
                </div>
              </div>

              <div className="txn-form-row">
                <CategorySelect
                  key={categoryKey}
                  kind="income"
                  category={incomeCategory}
                  subcategory={incomeSubcategory}
                  categories={incomeCategories}
                  transactions={transactions}
                  onChange={handleIncomeCategoryChange}
                  placeholder="Select category"
                />

                <label className="form-field">
                  <span>Amount</span>
                  <div className="amount-input">
                    <span className="currency">{currencyInputPrefix(currency)}</span>
                    <input
                      type="number"
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      min="0.01"
                      step="0.01"
                      required
                    />
                  </div>
                </label>
              </div>
            </>
          )}

          {type === "transfer" && (
            <>
              <TransferStepperNav
                step={transferStep}
                furthestStep={transferFurthestStep}
                onStepChange={jumpTransferStep}
              />

              {(transferStep === 1 || transferStep === 2) && (
              <div
                className={`transfer-step-meta-row${
                  transferStep === 2 ? " transfer-step-meta-row-recap" : ""
                }`}
              >
                {transferStep === 1 ? (
                  <label className="form-field transfer-step-date">
                    <span>Date</span>
                    <DatePicker
                      value={date}
                      onChange={(v) => {
                        setDate(v)
                        clearTransferStep1Errors()
                      }}
                    />
                  </label>
                ) : (
                  <div className="transfer-recap-card" aria-label="Transfer summary from step 1">
                    <div className="transfer-recap-grid">
                      <div className="transfer-recap-segment">
                        <span className="transfer-recap-kicker">Date</span>
                        <span className="transfer-recap-primary">
                          {date ? formatDisplayDate(date) : "—"}
                        </span>
                      </div>

                      <div className="transfer-recap-divider" aria-hidden="true" />

                      <div className="transfer-recap-segment transfer-recap-segment-route">
                        <span className="transfer-recap-kicker">From</span>
                        <div className="transfer-recap-route-body">
                          <AccountNameWithColor
                            account={fromAccount}
                            nameClassName="transfer-recap-primary"
                          />
                          <span className="transfer-recap-currency">{sendCur}</span>
                        </div>
                      </div>

                      <div className="transfer-recap-flow" aria-hidden="true">
                        <Icon name="chevron-right" size={20} />
                      </div>

                      <div className="transfer-recap-segment transfer-recap-segment-route">
                        <span className="transfer-recap-kicker">To</span>
                        <div className="transfer-recap-route-body">
                          <AccountNameWithColor
                            account={toAccount}
                            nameClassName="transfer-recap-primary"
                          />
                          <span className="transfer-recap-currency">{recvCur}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              )}

              {transferStep === 1 && (
              <>
              <div className="transfer-step1-shell">
                <div className="transfer-step1-split">
                  <section
                    className={`transfer-step1-pane transfer-step1-pane-from${
                      fromAccount ? " has-account-color" : ""
                    }`}
                    style={fromAccount ? accountColorStyleVars(fromAccount) : undefined}
                    aria-labelledby="transfer-from-head"
                  >
                    <header className="transfer-step1-pane-head">
                      <span className="transfer-step1-badge" id="transfer-from-head">
                        From
                      </span>
                    </header>
                    <div className="transfer-step1-pane-fields">
                      <div className="transfer-step1-cell">
                        <AccountSelect
                          label="Account"
                          value={fromAccountId}
                          onChange={(v) => {
                            setFromAccountId(v)
                            clearTransferStep1Errors()
                          }}
                          accounts={accounts}
                          required
                          disabledOption={(a) =>
                            isSameAccountTransferBlocked(toAccountId, a)
                          }
                        />
                        {fromSingleCurrencyHint && (
                          <span className="form-hint muted transfer-step1-field-hint">
                            {fromSingleCurrencyHint}
                          </span>
                        )}
                        {fromAccountId && fromFundedCurrencyOptions.length === 0 && (
                          <span className="form-hint muted inline-alert warning transfer-step1-field-hint">
                            Insufficient balance. Please add funds to this account or select
                            a different account to send from.
                          </span>
                        )}
                      </div>

                      <div className="transfer-step1-cell">
                        {showFromCurrencyPicker && transferSendCurrencyOptions.length > 0 ? (
                          <CurrencySelect
                            label="Send in currency"
                            value={sendCurrency}
                            onChange={(v) => {
                              setSendCurrency(v)
                              clearTransferStep1Errors()
                            }}
                            allowedCodes={transferSendCurrencyOptions}
                          />
                        ) : (
                          <div className="form-field transfer-step1-currency-fixed">
                            <span>Send in currency</span>
                            <div
                              className="transfer-step1-currency-badge"
                              aria-label={`Send in ${sendCur}`}
                            >
                              {fromAccountId ? sendCur : "—"}
                            </div>
                          </div>
                        )}
                        {fromAccountId &&
                          fromFundedCurrencyOptions.includes(sendCur) &&
                          transferSendBalanceMajor != null && (
                            <FieldHint>
                              Available to send:{" "}
                              {formatCurrency(transferSendBalanceMajor, sendCur)}
                            </FieldHint>
                          )}
                        {transferFieldError?.field === "sendCurrency" && (
                          <span
                            className="form-hint inline-alert error transfer-step1-field-hint"
                            role="alert"
                          >
                            {transferFieldError.message}
                          </span>
                        )}
                      </div>
                    </div>
                  </section>

                  <div className="transfer-step1-connector" aria-hidden="true">
                    <Icon name="chevron-right" size={20} />
                  </div>

                  <section
                    className={`transfer-step1-pane transfer-step1-pane-to${
                      toAccount ? " has-account-color" : ""
                    }`}
                    style={toAccount ? accountColorStyleVars(toAccount) : undefined}
                    aria-labelledby="transfer-to-head"
                  >
                    <header className="transfer-step1-pane-head">
                      <span className="transfer-step1-badge transfer-step1-badge-to" id="transfer-to-head">
                        To
                      </span>
                    </header>
                    <div className="transfer-step1-pane-fields">
                      <div className="transfer-step1-cell">
                        <AccountSelect
                          label="Account"
                          value={toAccountId}
                          onChange={(v) => {
                            setToAccountId(v)
                            clearTransferStep1Errors()
                          }}
                          accounts={accounts}
                          required
                          disabledOption={(a) =>
                            isSameAccountTransferBlocked(fromAccountId, a)
                          }
                        />
                        {toSingleCurrencyHint && (
                          <span className="form-hint muted transfer-step1-field-hint">
                            {toSingleCurrencyHint}
                          </span>
                        )}
                        {transferFieldError?.field === "toAccount" && (
                          <span
                            className="form-hint inline-alert error transfer-step1-field-hint"
                            role="alert"
                          >
                            {transferFieldError.message}
                          </span>
                        )}
                      </div>

                      <div className="transfer-step1-cell">
                        {showToCurrencyPicker && transferReceiveCurrencyOptions.length > 0 ? (
                          <CurrencySelect
                            label="Receive in currency"
                            value={receiveCurrency}
                            onChange={(v) => {
                              setReceiveCurrency(v)
                              clearTransferStep1Errors()
                            }}
                            allowedCodes={transferReceiveCurrencyOptions}
                          />
                        ) : (
                          <div className="form-field transfer-step1-currency-fixed">
                            <span>Receive in currency</span>
                            <div
                              className="transfer-step1-currency-badge"
                              aria-label={`Receive in ${recvCur}`}
                            >
                              {toAccountId ? recvCur : "—"}
                            </div>
                          </div>
                        )}
                        {transferFieldError?.field === "receiveCurrency" && (
                          <span
                            className="form-hint inline-alert error transfer-step1-field-hint"
                            role="alert"
                          >
                            {transferFieldError.message}
                          </span>
                        )}
                      </div>
                    </div>
                  </section>
                </div>
              </div>
              </>
              )}

              {transferStep === 2 && (
              <FormSection title="Amounts">
              <div className="transfer-amount-stack">
                <div className="transfer-step2-group transfer-step2-group-from">
                  <header className="transfer-step2-side-head">
                    <span className="transfer-step2-side-badge">From</span>
                    <AccountNameWithColor
                      account={fromAccount}
                      nameClassName="transfer-step2-side-account"
                    />
                    <span className="transfer-step2-side-meta">{sendCur}</span>
                  </header>

                <section className="transfer-amount-block" aria-labelledby="transfer-sent-heading">
                  <h3 id="transfer-sent-heading" className="transfer-amount-block-title">
                    Amount sent
                  </h3>
                  <div className="transfer-amount-row-grid">
                    <label className="form-field transfer-amount-field-grow">
                      <span className="sr-only">Amount sent</span>
                      <div className="amount-input">
                        <span className="currency">{currencyInputPrefix(sendCur)}</span>
                        <input
                          type="number"
                          placeholder="0.00"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          min="0.01"
                          step="0.01"
                          required
                        />
                      </div>
                    </label>
                    <div className="form-field transfer-amount-currency-locked">
                      <span>Currency</span>
                      <div
                        className="transfer-step1-currency-badge"
                        aria-label={`Send currency ${sendCur}`}
                      >
                        {sendCur}
                      </div>
                    </div>
                  </div>
                  {fromAccountId &&
                    fromFundedCurrencyOptions.includes(sendCur) &&
                    transferSendBalanceMajor != null && (
                      <FieldHint>
                        Available: {formatCurrency(transferSendBalanceMajor, sendCur)}
                      </FieldHint>
                    )}
                </section>
                </div>

                <div className="transfer-step2-group transfer-step2-group-to">
                  <header className="transfer-step2-side-head transfer-step2-side-head-to">
                    <span className="transfer-step2-side-badge transfer-step2-side-badge-to">To</span>
                    <AccountNameWithColor
                      account={toAccount}
                      nameClassName="transfer-step2-side-account"
                    />
                    <span className="transfer-step2-side-meta">{recvCur}</span>
                  </header>

                {isCrossCurrency && (
                  <section
                    className="transfer-amount-block"
                    aria-labelledby="transfer-arrived-heading"
                  >
                    <h3 id="transfer-arrived-heading" className="transfer-amount-block-title">
                      Gross amount arriving
                      <InfoTip
                        label="Gross amount arriving"
                        text="What lands in the destination account before any fee charged to that account. Used for your exchange rate and saved with pending transfers."
                      />
                    </h3>
                    <div className="transfer-amount-row-grid">
                      <label className="form-field transfer-amount-field-grow">
                        <span className="sr-only">Gross amount arriving</span>
                        <div className="amount-input">
                          <span className="currency">{currencyInputPrefix(recvCur)}</span>
                          <input
                            type="number"
                            placeholder="0.00"
                            value={receiveAmount}
                            onChange={(e) => setReceiveAmount(e.target.value)}
                            min="0.01"
                            step="0.01"
                            required={isCrossCurrency && transferStatus === "completed"}
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
                    <div className="transfer-fx-summary transfer-fx-summary-inline">
                      <h4 className="transfer-fx-summary-title">Exchange rate</h4>
                      {marketQuote?.estimateMajor != null ? (
                        <p className="transfer-fx-summary-line">
                          <span className="transfer-fx-summary-label">Market estimate</span>
                          <span className="transfer-fx-summary-value">
                            ≈ {formatCurrency(marketQuote.estimateMajor, recvCur)}
                          </span>
                        </p>
                      ) : (
                        <p className="transfer-fx-summary-line muted">
                          <span className="transfer-fx-summary-label">Market estimate</span>
                          <span className="transfer-fx-summary-value">—</span>
                        </p>
                      )}
                      <p className="transfer-fx-summary-line">
                        <span className="transfer-fx-summary-label">Rate you got</span>
                        <span className="transfer-fx-summary-value">
                          {effectiveRateLabel || "—"}
                        </span>
                      </p>
                    </div>
                    {rateTypoWarning && (
                      <p className="inline-alert warning">{rateTypoWarning}</p>
                    )}
                  </section>
                )}

                <section
                  className="transfer-amount-block transfer-net-receive-block"
                  aria-labelledby="transfer-net-heading"
                  aria-live="polite"
                >
                  <h3 id="transfer-net-heading" className="transfer-net-receive-label">
                    Amount you&apos;ll receive
                    <InfoTip
                      label="Net amount received"
                      text="What the To account keeps after a fee charged to that account. A fee on the From account is on top of the send and does not reduce this amount. Different fee currencies are converted using your app exchange rates."
                    />
                  </h3>
                  <p
                    className={`transfer-net-receive-value${
                      netReceivePreview.note === "estimate" ||
                      netReceivePreview.note === "pendingEstimate"
                        ? " transfer-net-receive-value-estimate"
                        : ""
                    }`}
                  >
                    {netReceivePreview.netMajor != null
                      ? formatCurrency(
                          netReceivePreview.netMajor,
                          netReceivePreview.receiveCurrency
                        )
                      : "—"}
                  </p>
                  <p className="transfer-net-receive-meta muted">
                    {transferFeeMajorPreview != null ? "After fee · " : ""}
                    credited to {toAccount?.name || "To account"} · {recvCur}
                  </p>
                  {netReceivePreview.note === "needReceive" && isCrossCurrency && (
                    <FieldHint>
                      Enter amount sent and gross amount arriving to calculate net
                      receive.
                    </FieldHint>
                  )}
                  {(netReceivePreview.note === "noRate" ||
                    netReceivePreview.note === "pendingNoRate") && (
                    <FieldHint>
                      Fee in another currency could not be converted—showing gross receive.
                      Add rates in Settings for an exact net.
                    </FieldHint>
                  )}
                </section>

                <label className="form-field transfer-status-field">
                  <span>
                    Status{" "}
                    <InfoTip
                      label="Transfer status help"
                      text={
                        isCrossCurrency
                          ? "Completed means the money has already arrived—send and receive are recorded together. Pending means you have sent money but it is still in transit; only the send hits your balance until you finish the transfer from Transactions."
                          : "Completed means the transfer is done—both accounts update right away. Pending means you have paid out but the other side is not credited yet; finish it later with the check button on Transactions."
                      }
                    />
                  </span>
                  <select
                    value={transferStatus}
                    onChange={(e) => setTransferStatus(e.target.value)}
                  >
                    <option value="completed">Completed</option>
                    <option value="pending">Pending</option>
                  </select>
                  <FieldHint>
                    {transferStatus === "pending"
                      ? isCrossCurrency
                        ? "Money is on the way. Your From account updates now; the amounts above are saved so you can confirm the receive later (Transactions → check icon)."
                        : "Money is on the way. Only the send is recorded now—when it lands, open Transactions and tap the check icon to credit the other account."
                      : isCrossCurrency
                        ? "Money has arrived. Send, receive, and any fee update your balances as soon as you submit."
                        : "Transfer is done. Both accounts and any fee update as soon as you submit."}
                  </FieldHint>
                </label>
                </div>

                {!showFee && (
                  <div className="transfer-fee-add-row">
                    <button
                      type="button"
                      className="btn-sm ghost transfer-fee-add-btn"
                      onClick={() => setShowFee(true)}
                    >
                      + Add fee
                    </button>
                  </div>
                )}

                {showFee && (
                  <div className="transfer-step2-group transfer-fee-section transfer-fee-band">
                    <header className="transfer-step2-side-head transfer-step2-side-head-fee">
                      <span className="transfer-step2-side-badge">Fee</span>
                      <InfoTip
                        label="How transfer fees work"
                        text={buildFeeHelperText(feeHelperAccountName, feeCurDisplay)}
                      />
                    </header>
                    <div className="transfer-fee-fields-row">
                      <label className="form-field">
                        <span>Charged to</span>
                        <select
                          value={feeChargedTo}
                          onChange={(e) => setFeeChargedTo(e.target.value)}
                        >
                          <option value={FEE_CHARGE_FROM}>
                            {fromAccount?.name || "From account"}
                          </option>
                          <option value={FEE_CHARGE_TO}>
                            {toAccount?.name || "To account"}
                          </option>
                        </select>
                      </label>
                      <div className="form-field transfer-amount-currency-locked">
                        <span>Fee currency</span>
                        <div
                          className="transfer-step1-currency-badge"
                          aria-label={`Fee currency ${feeCurDisplay}`}
                        >
                          {feeCurDisplay}
                        </div>
                      </div>
                      <label className="form-field">
                        <span>Fee amount</span>
                        <div className="amount-input">
                          <span className="currency">
                            {currencyInputPrefix(feeCurDisplay)}
                          </span>
                          <input
                            type="number"
                            placeholder="0.00"
                            value={feeAmount}
                            onChange={(e) => setFeeAmount(e.target.value)}
                            min="0.01"
                            step="0.01"
                          />
                        </div>
                      </label>
                    </div>
                    <button
                      type="button"
                      className="btn-sm ghost transfer-fee-remove"
                      onClick={() => {
                        setShowFee(false)
                        setFeeAmount("")
                      }}
                    >
                      Remove fee
                    </button>
                  </div>
                )}
              </div>
              </FormSection>
              )}

              {transferStep === 3 && (
              <FormSection title="Review" className="transfer-review-section">
                <div className="transfer-review-stack form-field-full">
                  {!isPositiveMoneyAmount(amount) ? (
                    <p className="muted transfer-review-empty">
                      Go back to <strong>Amounts</strong> to enter how much you&apos;re sending.
                    </p>
                  ) : (
                    <>
                      <FieldHint className="transfer-review-intro-hint">
                        Check the summary below. Tap <strong>Back</strong> to change amounts,
                        fees, or status—then save when it looks right.
                      </FieldHint>
                      <div className="transfer-review-card">
                      <div className="transfer-review-date-bar">
                        <span className="transfer-recap-kicker">Date</span>
                        <span className="transfer-recap-primary">
                          {date ? formatDisplayDate(date) : "—"}
                        </span>
                      </div>
                      <div className="transfer-review-amounts">
                        <div className="transfer-step2-group transfer-step2-group-from transfer-review-panel">
                          <header className="transfer-step2-side-head">
                            <span className="transfer-step2-side-badge">From</span>
                            <AccountNameWithColor
                              account={fromAccount}
                              nameClassName="transfer-step2-side-account"
                            />
                            <span className="transfer-step2-side-meta">{sendCur}</span>
                          </header>
                          <dl className="transfer-review-facts">
                            <div className="transfer-review-fact">
                              <dt>Amount sent</dt>
                              <dd>{formatCurrency(Number(amount), sendCur)}</dd>
                            </div>
                            {showFee &&
                              transferFeeMajorPreview != null &&
                              feeChargedTo === FEE_CHARGE_FROM && (
                                <>
                                  <div className="transfer-review-fact transfer-review-fact-fee">
                                    <dt>Fee (charged here)</dt>
                                    <dd>
                                      {formatCurrency(
                                        transferFeeMajorPreview,
                                        feeCurDisplay
                                      )}
                                    </dd>
                                  </div>
                                  <div className="transfer-review-fact transfer-review-fact-total">
                                    <dt>Total</dt>
                                    <dd>
                                      {feeCurDisplay === sendCur
                                        ? formatCurrency(
                                            Number(amount) + transferFeeMajorPreview,
                                            sendCur
                                          )
                                        : formatCurrency(Number(amount), sendCur)}
                                    </dd>
                                  </div>
                                </>
                              )}
                          </dl>
                        </div>

                        <div className="transfer-step2-group transfer-step2-group-to transfer-review-panel">
                          <header className="transfer-step2-side-head transfer-step2-side-head-to">
                            <span className="transfer-step2-side-badge transfer-step2-side-badge-to">
                              To
                            </span>
                            <AccountNameWithColor
                              account={toAccount}
                              nameClassName="transfer-step2-side-account"
                            />
                            <span className="transfer-step2-side-meta">{recvCur}</span>
                          </header>
                          <dl className="transfer-review-facts">
                            {isCrossCurrency && (
                              <div className="transfer-review-fact">
                                <dt>
                                  Amount landing in account
                                  <InfoTip
                                    label="Amount landing in account"
                                    text="The full amount that hits the destination account before any fee taken from that account."
                                  />
                                </dt>
                                <dd>
                                  {isPositiveMoneyAmount(receiveAmount)
                                    ? formatCurrency(Number(receiveAmount), recvCur)
                                    : marketQuote?.estimateMajor != null
                                      ? `≈ ${formatCurrency(marketQuote.estimateMajor, recvCur)}`
                                      : "—"}
                                </dd>
                              </div>
                            )}
                            {showFee &&
                              transferFeeMajorPreview != null &&
                              feeChargedTo === FEE_CHARGE_TO && (
                                <div className="transfer-review-fact transfer-review-fact-fee">
                                  <dt>Fee (charged here)</dt>
                                  <dd>
                                    {formatCurrency(
                                      transferFeeMajorPreview,
                                      feeCurDisplay
                                    )}
                                  </dd>
                                </div>
                              )}
                            <div className="transfer-review-fact transfer-review-fact-highlight">
                              <dt>
                                You&apos;ll receive
                                <InfoTip
                                  label="Amount you'll receive"
                                  text="What actually stays in the destination account. A fee on the sending account is separate and does not reduce this number."
                                />
                              </dt>
                              <dd className="transfer-review-net-value">
                                {netReceivePreview.netMajor != null
                                  ? formatCurrency(
                                      netReceivePreview.netMajor,
                                      netReceivePreview.receiveCurrency
                                    )
                                  : "—"}
                              </dd>
                            </div>
                            <div className="transfer-review-fact">
                              <dt>Status</dt>
                              <dd>
                                <span
                                  className={`transfer-review-status-pill${
                                    transferStatus === "pending"
                                      ? " transfer-review-status-pill-pending"
                                      : ""
                                  }`}
                                >
                                  {transferStatus === "pending" ? "Pending" : "Completed"}
                                </span>
                              </dd>
                            </div>
                          </dl>
                        </div>
                      </div>
                      {isCrossCurrency ? (
                        <div className="transfer-fx-summary form-field-full">
                          <h3 className="transfer-fx-summary-title">Exchange rate</h3>
                          <p className="transfer-fx-summary-line">
                            <span className="transfer-fx-summary-label">Market estimate</span>
                            <span className="transfer-fx-summary-value">
                              {marketQuote?.estimateMajor != null
                                ? `≈ ${formatCurrency(marketQuote.estimateMajor, recvCur)}`
                                : "—"}
                            </span>
                          </p>
                          <p className="transfer-fx-summary-line">
                            <span className="transfer-fx-summary-label">Rate you got</span>
                            <span className="transfer-fx-summary-value">
                              {effectiveRateLabel || "—"}
                            </span>
                          </p>
                          <FieldHint>
                            Market estimate is a reference; rate you got is from the amounts you
                            entered.
                          </FieldHint>
                        </div>
                      ) : null}
                      </div>

                      {transferBalancePreviewLines.length > 0 && (
                        <section
                          className="transfer-review-impact"
                          aria-labelledby="transfer-impact-heading"
                        >
                          <h3 id="transfer-impact-heading" className="transfer-review-impact-title">
                            What happens to your balances
                          </h3>
                          <FieldHint className="transfer-review-impact-hint">
                            Preview of balance changes based on your status and amounts.
                          </FieldHint>
                          <ul
                            className="transfer-review-impact-list"
                            aria-live="polite"
                          >
                            {transferBalancePreviewLines.map((line) => (
                              <li key={line}>{line}</li>
                            ))}
                          </ul>
                        </section>
                      )}
                    </>
                  )}

                  <label className="form-field transfer-review-notes">
                    <span>Notes</span>
                    <input
                      type="text"
                      placeholder="Optional notes for this transfer"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </label>
                </div>
              </FormSection>
              )}

              <div
                className={`transfer-stepper-actions form-field-full${
                  transferStep === 3 ? " transfer-stepper-actions-save" : ""
                }`}
              >
                <div className="transfer-stepper-actions-leading">
                  {transferStep > 1 && (
                    <button
                      type="button"
                      className="btn-secondary btn-sm"
                      onClick={goTransferStepBack}
                    >
                      Back
                    </button>
                  )}
                </div>
                <div className="transfer-stepper-actions-trailing">
                  {transferStep < 3 && (
                    <button
                      type="button"
                      className="submit-btn primary transfer"
                      onClick={() => goTransferStep(transferStep + 1)}
                    >
                      Continue
                    </button>
                  )}
                  {transferStep === 3 && (
                    <div className="transfer-save-action-group">
                      {isPositiveMoneyAmount(amount) && (
                        <span className="transfer-save-action-hint muted">
                          {transferStatus === "pending"
                            ? "This transfer will be saved. Confirm it in Transactions later to update both accounts."
                            : "This will update both account balances immediately upon saving."}
                        </span>
                      )}
                      <button
                        type="submit"
                        className="submit-btn primary transfer"
                        disabled={submitting}
                      >
                        {submitting ? "Submitting…" : "Save transfer"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {type !== "transfer" && (
            <label className="form-field form-field-full txn-form-notes">
              <span>Notes</span>
              <input
                type="text"
                placeholder="Optional notes or description"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
              <FieldHint>Optonal notes for your records.</FieldHint>
            </label>
          )}

          <div className="txn-form-footer">
            {type === "transfer" &&
              fromAccountId &&
              fromFundedCurrencyOptions.length === 0 && (
                <p className="txn-submit-blocker muted">
                  Insufficient balance. Please add funds to this account or select a different
                  account to send from.
                </p>
              )}
            {type !== "transfer" && (
            <button
              type="submit"
              className={`submit-btn primary ${type}`}
              disabled={submitting}
            >
              {submitting ? "Submitting…" : "Submit"}
            </button>
            )}
          </div>

          {error &&
            !(type === "transfer" && transferStep === 1 && transferFieldError) && (
            <p className="inline-alert error form-row-alert" role="alert" aria-live="assertive">
              {error}
            </p>
          )}
        </form>
      )}
    </div>
  )
}

export default AddTransaction
