export function formatDate(seconds) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(seconds * 1000));
}

export function formatTime(seconds) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(seconds * 1000));
}

export function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return (
    [hours ? `${hours}h` : "", minutes ? `${minutes}m` : ""]
      .filter(Boolean)
      .join(" ") || "< 1m"
  );
}

export function countdown(seconds, now = Date.now()) {
  const remaining = Math.max(0, Math.ceil(seconds - now / 1000));
  const days = Math.floor(remaining / 86400);
  const hours = Math.floor((remaining % 86400) / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);
  const secs = remaining % 60;
  return { days, hours, minutes, seconds: secs, started: remaining === 0 };
}

export function errorMessage(error) {
  return error instanceof Error && error.message.trim()
    ? error.message
    : "Something went wrong. Please try again.";
}
