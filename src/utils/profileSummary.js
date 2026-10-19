export function summarizeSolved(states, handles) {
  const linked = Object.keys(handles).filter((platform) => handles[platform]);
  const values = linked
    .map((platform) => states[platform]?.data?.totalSolved)
    .filter(Number.isFinite);
  return {
    total: values.length ? values.reduce((sum, count) => sum + count, 0) : null,
    partial: linked.some(
      (platform) =>
        !Number.isFinite(states[platform]?.data?.totalSolved) ||
        states[platform]?.data?.solvedIsPartial,
    ),
  };
}
