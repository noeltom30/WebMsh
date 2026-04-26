export const AUTH_ERROR_MESSAGES = {
  google_not_configured: 'Google sign-in is not configured on this server yet.',
  google_missing_code: 'Google sign-in did not return an authorization code.',
  google_invalid_state: 'Google sign-in session expired. Please try again.',
  google_exchange_failed: 'Google sign-in failed while validating credentials.',
  google_profile_incomplete: 'Google profile data is incomplete for sign-in.',
  google_account_creation_failed: 'Unable to create or link your Google account.',
}

export function getPasswordStrengthScore(password) {
  let score = 0
  if (password.length >= 12) score += 1
  if (/[a-z]/.test(password)) score += 1
  if (/[A-Z]/.test(password)) score += 1
  if (/\d/.test(password)) score += 1
  if (/[^A-Za-z0-9]/.test(password)) score += 1
  return score
}

export function strengthLabel(score) {
  if (score <= 1) return 'Weak'
  if (score === 2) return 'Fair'
  if (score === 3) return 'Good'
  if (score === 4) return 'Strong'
  return 'Excellent'
}
