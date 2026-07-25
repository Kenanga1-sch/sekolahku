/**
 * Helper to resolve the correct URL for the school logo across the application.
 * Ensures fallbacks to '/logo.png' whenever logo is missing, empty, or unresolvable.
 */
export function getSchoolLogo(logoPath?: string | null): string {
  if (!logoPath || typeof logoPath !== "string") {
    return "/logo.png";
  }
  const trimmed = logoPath.trim();
  if (!trimmed) {
    return "/logo.png";
  }
  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("data:")
  ) {
    return trimmed;
  }
  if (trimmed.startsWith("/")) {
    return trimmed;
  }
  if (trimmed.startsWith("uploads/")) {
    return `/${trimmed}`;
  }
  if (trimmed === "logo.png") {
    return "/logo.png";
  }
  return `/uploads/${trimmed}`;
}
