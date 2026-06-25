import { useState } from "react"
import {
  addExpenseCategory,
  addIncomeCategory,
} from "../utils/categories"

const ADD_NEW = "__add_new__"

function CategorySelect({
  value,
  categories,
  onChange,
  required = true,
  kind = "expense",
  placeholder = "Select category",
}) {
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState("")

  const handleSelect = (e) => {
    const picked = e.target.value
    if (picked === ADD_NEW) {
      setAdding(true)
      setNewName("")
      return
    }
    setAdding(false)
    onChange(picked)
  }

  const confirmNew = () => {
    const addFn = kind === "income" ? addIncomeCategory : addExpenseCategory
    const added = addFn(newName)
    if (added) {
      onChange(added, { added: true })
      setAdding(false)
      setNewName("")
    }
  }

  const cancelNew = () => {
    setAdding(false)
    setNewName("")
    onChange("")
  }

  if (adding) {
    return (
      <div className="category-add-row">
        <input
          type="text"
          className="category-new-input"
          placeholder="Type a new category"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              confirmNew()
            }
            if (e.key === "Escape") cancelNew()
          }}
          autoFocus
        />
        <button type="button" className="chip-action save" onClick={confirmNew}>
          Save
        </button>
        <button type="button" className="chip-action" onClick={cancelNew}>
          Cancel
        </button>
      </div>
    )
  }

  return (
    <select value={value} onChange={handleSelect} required={required && !value}>
      <option value="">{placeholder}</option>
      {categories.map((cat) => (
        <option key={cat} value={cat}>
          {cat}
        </option>
      ))}
      <option value={ADD_NEW}>+ Add new category</option>
    </select>
  )
}

export default CategorySelect
