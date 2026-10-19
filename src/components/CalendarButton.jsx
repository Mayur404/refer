import Icon from "./Icon.jsx";
import { createGoogleCalendarUrl } from "../utils/calendar.js";

export default function CalendarButton({ contest }) {
  let url;
  try {
    url = createGoogleCalendarUrl(contest);
  } catch {
    return (
      <span className="calendar-message">
        Calendar unavailable. Check the official schedule.
      </span>
    );
  }
  return (
    <div className="calendar-action">
      <a
        className="button button-small button-outline"
        href={url}
        target="_blank"
        rel="noreferrer"
        aria-label={`Add ${contest.name} to Google Calendar`}
        title="Open Google Calendar with this event ready to save"
      >
        <Icon name="calendar" size={17} />
        Add to calendar
      </a>
    </div>
  );
}
