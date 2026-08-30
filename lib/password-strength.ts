/**
 * Utilitas validasi kekuatan password.
 * Skor 0-4: Lemah (0), Cukup (1), Sedang (2), Kuat (3), Sangat Kuat (4).
 */

export interface PasswordStrengthResult {
  score: number; // 0-4
  label: string; // label Bahasa Indonesia
  checks: {
    length: boolean;
    uppercase: boolean;
    lowercase: boolean;
    number: boolean;
    symbol: boolean;
  };
}

export function evaluatePasswordStrength(password: string): PasswordStrengthResult {
  const checks = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /\d/.test(password),
    symbol: /[^A-Za-z0-9]/.test(password),
  };

  const passed = Object.values(checks).filter(Boolean).length;

  let score = 0;
  if (checks.length) score = 1;
  if (passed >= 3) score = 2;
  if (passed >= 4) score = 3;
  if (passed >= 5 && password.length >= 12) score = 4;

  const labels = ["Sangat lemah", "Lemah", "Sedang", "Kuat", "Sangat kuat"];

  return { score, label: labels[score], checks };
}

/** Validasi untuk Zod/form - mengembalikan pesan error atau null. */
export function validatePasswordStrength(password: string): string | null {
  if (password.length < 8) {
    return "Password minimal 8 karakter";
  }
  const result = evaluatePasswordStrength(password);
  if (result.score < 2) {
    return "Password terlalu lemah. Gunakan kombinasi huruf besar, huruf kecil, angka, dan simbol.";
  }
  return null;
}
