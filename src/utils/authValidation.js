export function validateEmail(email) {
  const trimmed = email.trim()

  if (!trimmed) {
    return "Email is required"
  }

  if (!trimmed.includes("@")) {
    return "Email must contain an @ symbol"
  }

  const [local, domain] = trimmed.split("@")

  if (!local || !domain) {
    return "Enter a valid email address"
  }

  if (!domain.includes(".")) {
    return "Enter a valid email address"
  }

  return null
}

export function validatePassword(password, { isSignUp = false } = {}) {
  if (!password) {
    return "Password is required"
  }

  if (isSignUp && password.length < 6) {
    return "Password must be at least 6 characters"
  }

  return null
}

export function validateName(name, { isSignUp = false, required = false } = {}) {
  if (!isSignUp && !required) return null

  if (!name.trim()) {
    return "Full name is required"
  }

  return null
}
