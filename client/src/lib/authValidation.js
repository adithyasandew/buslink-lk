/** Mirrors the server's registration rules (server/src/routes/auth.js) so users see problems before submitting. */
export function validateRegistration({ name, email, phone, password, confirm }) {
  const errors = {}
  const n = name.trim()
  if (n.length < 2 || n.length > 80) errors.name = 'Enter your full name (2–80 characters)'
  if (!/^\S+@\S+\.\S+$/.test(email.trim())) errors.email = 'Enter a valid email address'
  if (phone.trim() && !/^\+?[0-9 -]{9,15}$/.test(phone.trim())) errors.phone = 'Enter a valid phone number, e.g. 077 123 4567'
  if (password.length < 8) errors.password = 'Use at least 8 characters'
  else if (password.length > 100) errors.password = 'Use 100 characters or fewer'
  if (confirm !== password) errors.confirm = 'Passwords do not match'
  return errors
}
