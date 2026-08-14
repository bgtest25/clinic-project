const DEFAULT_BACKOFF_MS = [500, 1500, 4000];

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: { attempts?: number; backoffMs?: number[]; onRetry?: (attempt: number, total: number) => void } = {},
): Promise<T> {
  const backoffMs = options.backoffMs ?? DEFAULT_BACKOFF_MS;
  const attempts = options.attempts ?? backoffMs.length + 1;

  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt === attempts) break;
      options.onRetry?.(attempt + 1, attempts);
      await new Promise((resolve) => setTimeout(resolve, backoffMs[attempt - 1] ?? backoffMs[backoffMs.length - 1]));
    }
  }
  throw lastError;
}
