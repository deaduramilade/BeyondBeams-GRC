export function tokenIsUsable(expires: Date | null | undefined, consumed: boolean, now = new Date()) {
  return Boolean(expires && expires > now && !consumed);
}