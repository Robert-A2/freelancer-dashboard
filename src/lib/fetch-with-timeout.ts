// A hung fetch (some embedded webviews/proxies swallow a response without
// ever resolving or rejecting) would otherwise leave a "saving" button stuck
// forever with zero visible feedback — indistinguishable from a click never
// registering at all. This guarantees every request either succeeds or
// surfaces a real, visible error within the timeout. Client-safe — no
// server-only imports — so any client component can use it.
export async function fetchWithTimeout(input: string, init: RequestInit, timeoutMs = 12000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}
