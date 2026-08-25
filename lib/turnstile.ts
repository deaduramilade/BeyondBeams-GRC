const TEST_SECRET = "1x0000000000000000000000000000000AA";

type TurnstileResponse = {
  success: boolean;
  action?: string;
  hostname?: string;
  "error-codes"?: string[];
};

export function turnstileSiteKey() {
  return process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "1x00000000000000000000AA";
}

export async function verifyTurnstile(token: string, expectedAction: string) {
  if (!token || token.length > 2048) return false;
  const secret = process.env.TURNSTILE_SECRET_KEY ?? (process.env.NODE_ENV === "production" ? "" : TEST_SECRET);
  if (!secret) throw new Error("TURNSTILE_SECRET_KEY is required in production.");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret, response: token }),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) return false;
    const result = await response.json() as TurnstileResponse;
    return result.success && (!result.action || result.action === expectedAction);
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}