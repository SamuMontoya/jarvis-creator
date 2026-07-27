// Groq's SDK throws APIError instances with `.status` and, for 429s, a
// `retry-after` response header — surface that as an actionable message
// instead of a generic "try again" that hides an external quota problem.
export function formatGroqError(err, fallbackMessage) {
  if (err?.status !== 429) return fallbackMessage;

  const retryAfterSec = Number(err?.headers?.get?.('retry-after'));
  if (Number.isFinite(retryAfterSec) && retryAfterSec > 0) {
    const minutes = Math.max(1, Math.ceil(retryAfterSec / 60));
    return `Se alcanzó el límite diario de la IA (Groq). Intenta de nuevo en unos ${minutes} minuto${minutes === 1 ? '' : 's'}.`;
  }

  return 'Se alcanzó el límite diario de la IA (Groq). Intenta de nuevo más tarde.';
}
