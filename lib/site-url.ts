// Resolve the canonical public URL for this deployment.
//
// Priority:
//   1. NEXT_PUBLIC_APP_URL — explicit canonical URL (production).
//      e.g. "https://umbra-roof-care.vercel.app"
//   2. VERCEL_URL — automatic per-deploy URL Vercel sets in every
//      preview + production environment. Always missing the protocol,
//      so we prefix `https://`.
//   3. http://localhost:3000 — local dev fallback.
//
// Always returns a value with no trailing slash so callers can append
// paths directly.
export function getSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL;
  if (explicit) return stripTrailingSlash(explicit);

  const vercel = process.env.VERCEL_URL;
  if (vercel) return `https://${stripTrailingSlash(vercel)}`;

  return "http://localhost:3000";
}

function stripTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}
