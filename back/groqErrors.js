// Groq's SDK throws APIError instances with `.status`. Two distinct external
// limits show up as two distinct statuses — surface each as an actionable
// message instead of a generic "try again" that hides which one it was:
//   429 — a time-based quota (daily/per-minute requests) was used up; the
//         `retry-after` header says how long until it resets.
//   413 — this single request (prompt + completion budget) is bigger than
//         the account's tokens-per-minute ceiling; waiting doesn't help,
//         only a shorter idea/answers or a smaller completion budget does.
export function formatGroqError(err, fallbackMessage) {
  if (err?.status === 413) {
    return 'La idea y sus respuestas son demasiado extensas para generar el plan en una sola solicitud a la IA. Intenta con una idea o respuestas más breves.';
  }

  if (err?.status === 429) {
    const retryAfterSec = Number(err?.headers?.get?.('retry-after'));
    if (Number.isFinite(retryAfterSec) && retryAfterSec > 0) {
      const minutes = Math.max(1, Math.ceil(retryAfterSec / 60));
      return `Se alcanzó el límite de uso de la IA (Groq). Intenta de nuevo en unos ${minutes} minuto${minutes === 1 ? '' : 's'}.`;
    }
    return 'Se alcanzó el límite de uso de la IA (Groq). Intenta de nuevo más tarde.';
  }

  return fallbackMessage;
}
