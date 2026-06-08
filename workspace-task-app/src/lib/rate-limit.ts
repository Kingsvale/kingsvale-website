const attempts = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit = 10, windowMs = 60_000) {
  const now = Date.now();
  const current = attempts.get(key);

  if (!current || current.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }

  current.count += 1;
  if (current.count > limit) {
    return { allowed: false, resetAt: current.resetAt };
  }

  return { allowed: true };
}
