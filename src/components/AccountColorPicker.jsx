import { useEffect, useId, useRef, useState } from "react"
import Icon from "./icons/Icons"
import { isPartialHexInput, normalizeAccountColorHex } from "../utils/accountColor"

const PRESETS = [
  "#EF4444",
  "#F97316",
  "#EAB308",
  "#22C55E",
  "#14B8A6",
  "#3B82F6",
  "#6366F1",
  "#A855F7",
  "#EC4899",
  "#64748B",
]

const FALLBACK_PICKER = "#3B82F6"

function AccountColorPicker({ value, onChange }) {
  const normalized = normalizeAccountColorHex(value)
  const nativeRef = useRef(null)
  const hexId = useId()
  const [hexDraft, setHexDraft] = useState(normalized ?? "")
  const [hexInvalid, setHexInvalid] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setHexDraft(normalized ?? "")
    setHexInvalid(false)
  }, [normalized])

  const swatchColor = normalized ?? FALLBACK_PICKER
  const nativeValue = normalized ?? FALLBACK_PICKER

  const commitHex = (raw) => {
    const trimmed = String(raw).trim()
    if (!trimmed) {
      onChange(null)
      setHexDraft("")
      setHexInvalid(false)
      return
    }
    if (!isPartialHexInput(trimmed)) {
      setHexInvalid(true)
      return
    }
    const hex = normalizeAccountColorHex(trimmed)
    if (!hex) {
      setHexInvalid(true)
      return
    }
    setHexInvalid(false)
    setHexDraft(hex)
    onChange(hex)
  }

  const handleHexChange = (e) => {
    const next = e.target.value
    if (!isPartialHexInput(next)) return
    setHexDraft(next)
    setHexInvalid(false)
    const hex = normalizeAccountColorHex(next)
    if (hex) onChange(hex)
  }

  const handleHexBlur = () => {
    if (!hexDraft.trim()) {
      onChange(null)
      setHexInvalid(false)
      return
    }
    commitHex(hexDraft)
  }

  const openNativePicker = () => {
    nativeRef.current?.click()
  }

  const copyHex = async () => {
    const text = normalized ?? normalizeAccountColorHex(hexDraft)
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      /* ignore */
    }
  }

  const canCopy = Boolean(normalized ?? normalizeAccountColorHex(hexDraft))

  return (
    <div className="account-color-picker">
      <div className="account-color-picker-main">
        <button
          type="button"
          className="account-color-swatch"
          style={{ background: swatchColor }}
          onClick={openNativePicker}
          aria-label="Open color picker"
          title="Choose color"
        />
        <input
          ref={nativeRef}
          type="color"
          className="account-color-native-input"
          value={nativeValue}
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            const hex = normalizeAccountColorHex(e.target.value)
            if (hex) onChange(hex)
          }}
        />

        <div className="account-color-hex-field">
          <label className="sr-only" htmlFor={hexId}>
            Hex color
          </label>
          <input
            id={hexId}
            type="text"
            className={`account-color-hex-input${hexInvalid ? " invalid" : ""}`}
            placeholder="#303D4D"
            value={hexDraft}
            onChange={handleHexChange}
            onBlur={handleHexBlur}
            spellCheck={false}
            maxLength={7}
            autoComplete="off"
            aria-invalid={hexInvalid}
          />
          <button
            type="button"
            className="account-color-copy-btn"
            onClick={copyHex}
            disabled={!canCopy}
            aria-label={copied ? "Copied" : "Copy hex color"}
            title={copied ? "Copied" : "Copy hex"}
          >
            <Icon name="clipboard" size={16} />
          </button>
        </div>
      </div>

      {hexInvalid && (
        <p className="form-hint inline-alert error account-color-hex-error" role="alert">
          Enter a valid 6-digit hex code, e.g. #303D4D
        </p>
      )}

      <div className="account-color-presets" role="list" aria-label="Suggested colors">
        {PRESETS.map((hex) => (
          <button
            key={hex}
            type="button"
            role="listitem"
            className={`account-color-preset${normalized === hex ? " selected" : ""}`}
            style={{ background: hex }}
            title={hex}
            aria-label={hex}
            aria-pressed={normalized === hex}
            onClick={() => onChange(hex)}
          />
        ))}
      </div>

      {normalized && (
        <button
          type="button"
          className="btn-sm ghost account-color-reset"
          onClick={() => onChange(null)}
        >
          Use automatic color
        </button>
      )}
    </div>
  )
}

export default AccountColorPicker
