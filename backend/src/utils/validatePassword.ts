// Checks a plaintext password against the project's minimum security
// policy: at least 8 characters, containing at least one letter, one
// digit, and one special character. Returns null if valid, or a
// user-facing error string explaining what's missing if not.
//
// Shared between signup and the password-reset flow, so both paths
// enforce the exact same rule rather than risking two slightly
// different implementations drifting apart over time.
export function validatePassword(password: string): string | null {
  if (password.length < 8) {
    return "Password must be at least 8 characters long.";
  }

  const hasLetter = /[a-zA-Z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasSpecialChar = /[^a-zA-Z0-9]/.test(password);

  if (!hasLetter || !hasDigit || !hasSpecialChar) {
    return "Password must include at least one letter, one digit, and one special character.";
  }

  return null; // valid
}