import { createPortal } from "react-dom"

/** Render modals on document.body so they are not clipped by card/table overflow. */
export default function ModalPortal({ children }) {
  if (children == null) return null
  if (typeof document === "undefined") return null
  return createPortal(children, document.body)
}
