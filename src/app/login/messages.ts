/**
 * Plain-language copy for auth errors. Server routes redirect with a short code
 * (`/login?error=<code>`) and never with raw provider text, so the UI only ever
 * shows these strings.
 */
export const AUTH_ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: 'Email or password is incorrect.',
  google_sign_in_failed: "Google sign-in didn't complete. Please try again.",
  reset_link_expired: 'That reset link has expired or was already used. Request a new one.',
  demo_unavailable: 'Demo sign-in is not available here.',
};

export const GENERIC_AUTH_ERROR = "We couldn't sign you in. Please try again.";

/** Maps a `?error=` code from the URL to friendly copy. Unknown codes never leak through. */
export function authErrorMessage(code: string | null | undefined): string | null {
  if (!code) return null;
  return AUTH_ERROR_MESSAGES[code] ?? GENERIC_AUTH_ERROR;
}

/** Maps a sign-in error from the Supabase client to friendly copy. */
export function friendlySignInError(message: string | undefined): string {
  const m = (message ?? '').toLowerCase();
  if (m.includes('invalid login credentials')) return AUTH_ERROR_MESSAGES.invalid_credentials;
  if (m.includes('email not confirmed')) return "Your account isn't active yet. Ask a Founder Admin to set it up.";
  if (m.includes('too many requests') || m.includes('rate limit')) return 'Too many attempts. Wait a minute and try again.';
  return GENERIC_AUTH_ERROR;
}

/** Maps a password-update error from the Supabase client to friendly copy. */
export function friendlyPasswordError(message: string | undefined): string {
  const m = (message ?? '').toLowerCase();
  if (m.includes('session')) return AUTH_ERROR_MESSAGES.reset_link_expired;
  if (m.includes('different from the old password') || m.includes('same password')) {
    return 'Choose a password that is different from your previous one.';
  }
  if (m.includes('at least') || m.includes('weak') || m.includes('short')) {
    return 'That password is too weak. Use at least 6 characters.';
  }
  return "We couldn't update your password. Request a new reset link and try again.";
}
