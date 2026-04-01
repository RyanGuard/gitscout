/**
 * Apollo API fetch wrapper with retry, rate limiting, and logging.
 */

const MAX_RETRIES = 2;
const RETRY_DELAYS = [1000, 3000]; // ms

interface ApolloFetchOptions {
  label?: string;
  maxRetries?: number;
}

export async function apolloFetch(
  url: string,
  init: RequestInit,
  options: ApolloFetchOptions = {}
): Promise<Response> {
  const { label = "apollo", maxRetries = MAX_RETRIES } = options;
  const apiKey = process.env.APOLLO_API_KEY;

  if (!apiKey) throw new Error("APOLLO_API_KEY not configured");

  // Ensure X-Api-Key header is set
  const headers = new Headers(init.headers || {});
  if (!headers.has("X-Api-Key")) headers.set("X-Api-Key", apiKey);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, { ...init, headers });

      if (res.status === 429) {
        // Rate limited — retry with backoff
        const delay = RETRY_DELAYS[attempt] || 5000;
        console.warn(`[apollo/${label}] Rate limited (429). Retry ${attempt + 1}/${maxRetries} in ${delay}ms`);
        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
      }

      if (!res.ok && res.status >= 500 && attempt < maxRetries) {
        const delay = RETRY_DELAYS[attempt] || 3000;
        console.warn(`[apollo/${label}] Server error (${res.status}). Retry ${attempt + 1}/${maxRetries} in ${delay}ms`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }

      return res;
    } catch (err) {
      if (attempt < maxRetries) {
        const delay = RETRY_DELAYS[attempt] || 3000;
        console.warn(`[apollo/${label}] Network error. Retry ${attempt + 1}/${maxRetries} in ${delay}ms:`, err);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }

  // Should never reach here, but TypeScript wants a return
  throw new Error(`[apollo/${label}] All retries exhausted`);
}
