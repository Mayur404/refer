export function normalizeActivity(value) {
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const days = {};
  let validEntries = 0;
  for (const [key, rawCount] of Object.entries(value)) {
    if (!(
      typeof rawCount === "number" ||
      (typeof rawCount === "string" && /^\d+$/.test(rawCount))
    ))
      continue;
    const count = Number(rawCount);
    if (!Number.isSafeInteger(count) || count < 0) continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key) && !/^\d+$/.test(key)) continue;
    const date = /^\d{4}-\d{2}-\d{2}$/.test(key)
      ? new Date(`${key}T00:00:00Z`)
      : new Date(Number(key) * 1000);
    if (!Number.isFinite(date.getTime())) continue;
    const day = date.toISOString().slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(key) && day !== key) continue;
    validEntries++;
    days[day] = (days[day] || 0) + count;
  }
  return Object.keys(value).length && !validEntries ? null : days;
}

export function mergeActivity(calendars) {
  const available = calendars.filter(
    (value) => value !== null && value !== undefined,
  );
  if (!available.length) return null;
  const merged = {};
  for (const calendar of available) {
    for (const [date, count] of Object.entries(calendar))
      merged[date] = (merged[date] || 0) + count;
  }
  return merged;
}

export function buildCalendarYear(activity, year, now = new Date()) {
  const first = Date.UTC(year, 0, 1);
  const today = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  const last = Math.min(Date.UTC(year + 1, 0, 1) - 86400000, today);
  const length = Math.max(0, Math.round((last - first) / 86400000) + 1);
  return Array.from({ length }, (_, index) => {
    const date = new Date(first + index * 86400000).toISOString().slice(0, 10);
    const count = activity?.[date] || 0;
    return {
      date,
      count,
      level: count > 10 ? 4 : count > 6 ? 3 : count > 3 ? 2 : count > 0 ? 1 : 0,
    };
  });
}
