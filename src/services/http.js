export async function requestJson(url, options = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  const externalSignal = options.signal;
  if (externalSignal?.aborted) controller.abort();
  externalSignal?.addEventListener("abort", abort, { once: true });
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    controller.signal.throwIfAborted();
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    if (!response.ok) {
      const details = /^\/api\/(codechef|leetcode|ai)\//.test(url)
        ? await response.json().catch(() => null)
        : null;
      const error = new Error(
        typeof details?.error === "string"
          ? details.error
          : response.status === 429
            ? "Too many requests. The service is rate limited; please try again later."
            : `The service returned an error (${response.status}). Please try again later.`,
      );
      error.status = response.status;
      throw error;
    }
    try {
      const data = await response.json();
      if (data === null || typeof data !== "object")
        throw new Error("Invalid JSON payload");
      return data;
    } catch {
      throw new Error(
        "The service returned an unreadable response. Please try again later.",
      );
    }
  } catch (error) {
    if (externalSignal?.aborted)
      throw new DOMException("Request cancelled.", "AbortError");
    if (controller.signal.aborted)
      throw new Error(
        "The request took too long. Check your connection and try again.",
      );
    if (error instanceof TypeError)
      throw new Error(
        "Could not reach the service. Check your connection; the service may also be unavailable or blocking browser requests.",
      );
    throw error;
  } finally {
    clearTimeout(timeout);
    externalSignal?.removeEventListener("abort", abort);
  }
}
