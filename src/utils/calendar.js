import { platforms, isOfficialContestUrl } from "../data/platforms.js";

function calendarDate(seconds) {
  return new Date(seconds * 1000)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

export function createGoogleCalendarUrl(contest) {
  if (
    !contest ||
    !Object.hasOwn(platforms, contest.platform) ||
    !isOfficialContestUrl(contest.url, contest.platform) ||
    typeof contest.name !== "string" ||
    !contest.name.trim() ||
    !Number.isFinite(contest.startTimeSeconds) ||
    !Number.isFinite(contest.durationSeconds) ||
    contest.durationSeconds <= 0 ||
    !Number.isFinite(new Date(contest.startTimeSeconds * 1000).getTime()) ||
    !Number.isFinite(
      new Date(
        (contest.startTimeSeconds + contest.durationSeconds) * 1000,
      ).getTime(),
    )
  ) {
    throw new Error(
      "This contest is missing valid calendar details. Check its official page.",
    );
  }
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: contest.name,
    dates: `${calendarDate(contest.startTimeSeconds)}/${calendarDate(contest.startTimeSeconds + contest.durationSeconds)}`,
    details: `${platforms[contest.platform].name} contest. Check the official page for schedule updates.\n${contest.url}`,
    location: contest.url,
  });
  return `https://calendar.google.com/calendar/r/eventedit?${params}`;
}
