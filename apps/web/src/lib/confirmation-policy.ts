export const CONFIRM_COOKIE = 'explainova-confirmation';
export const PENDING_EMAIL_COOKIE = 'explainova-pending-email';
export const RECOVERY_COOKIE = 'explainova-recovery';
export const CONFIRM_SECONDS = 600;

export function confirmationToken(value: unknown) {
  // Supabase may issue SHA-224/SHA-256 hashes, with a PKCE prefix for SSR signup.
  return typeof value === 'string' && /^(?:pkce_)?(?:[a-f0-9]{56}|[a-f0-9]{64})$/i.test(value) ? value : null;
}

export function readConfirmation(value: string | undefined, now = Date.now()) {
  if (!value || value.length > 1024) return null;
  try {
    const data = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    const tokenHash = confirmationToken(data.tokenHash);
    if (!tokenHash || !Number.isFinite(data.createdAt) || now - data.createdAt > CONFIRM_SECONDS * 1000 || data.createdAt > now + 30000) return null;
    return { tokenHash };
  } catch { return null; }
}

export function validEmail(email: string) {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function signupValidation(email: string, password: string, confirmation: string): string | null {
  if (!validEmail(email)) return 'Enter a valid email address.';
  return passwordValidation(password, confirmation);
}

export function passwordValidation(password: string, confirmation: string): string | null {
  if (password.length < 8) return 'Use a password with at least 8 characters.';
  if (password.length > 72 || new TextEncoder().encode(password).length > 72) return 'Please use a shorter password (up to 72 characters).';
  if (password !== confirmation) return 'Your passwords do not match.';
  return null;
}
