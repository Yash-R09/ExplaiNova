export function authErrorKind(error: unknown): 'unavailable' | 'rate_limit' | 'invalid' {
  if (!error || typeof error !== 'object') return 'unavailable';
  const { name, status, code } = error as { name?: string; status?: number; code?: string };
  if (status === 429 || ['over_request_rate_limit', 'over_email_send_rate_limit'].includes(code ?? '')) return 'rate_limit';
  if (name === 'AuthRetryableFetchError' || status === 0 || (status !== undefined && status >= 500) || ['request_timeout', 'unexpected_failure', 'hook_timeout', 'hook_timeout_after_retry'].includes(code ?? '')) return 'unavailable';
  return 'invalid';
}

export function authErrorMessage(error: unknown, operation: 'sign-in' | 'sign-up' | 'resend' | 'confirm' | 'recovery') {
  const kind = authErrorKind(error);
  if (kind === 'rate_limit') return 'Too many attempts. Please wait before trying again.';
  if (kind === 'unavailable') {
    const label = { 'sign-in': 'Sign-in', 'sign-up': 'Account creation', resend: 'Confirmation email', confirm: 'Email confirmation', recovery: 'Password recovery' }[operation];
    return `${label} is temporarily unavailable. Please try again later.`;
  }
  return {
    'sign-in': 'Unable to sign in. Check your credentials and email confirmation.',
    'sign-up': 'Unable to create an account. Check your email and password, then try again.',
    resend: 'Unable to request a confirmation link. Please try again later.',
    confirm: 'This confirmation link is invalid, expired, or already used. Request a new link.',
    recovery: 'Unable to request a reset link. Please try again later.',
  }[operation];
}
