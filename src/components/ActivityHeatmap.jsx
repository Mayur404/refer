import useStoredState from "../hooks/useStoredState.js";
import { isActivityPlatform } from "../utils/preferences.js";
import { platforms } from "../data/platforms.js";
import { buildCalendarYear, mergeActivity } from "../utils/activity.js";

function YearHeatmap({ year, activity, label }) {
  const days = buildCalendarYear(activity, year);
  const padding = new Date(`${days[0].date}T00:00:00Z`).getUTCDay();
  const total = days.reduce((sum, day) => sum + day.count, 0);
  const weeks = Math.ceil((padding + days.length) / 7);
  const months = [];
  let lastMonth;
  let lastColumn = -3;
  days.forEach((day, index) => {
    const month = day.date.slice(0, 7);
    const column = Math.floor((padding + index) / 7) + 1;
    if (month !== lastMonth && column - lastColumn >= 3) {
      months.push({
        column,
        label: new Intl.DateTimeFormat("en", {
          month: "short",
          timeZone: "UTC",
        }).format(new Date(`${day.date}T00:00:00Z`)),
      });
      lastColumn = column;
    }
    lastMonth = month;
  });
  return (
    <section
      className="platform-heatmap"
      aria-label={`${year} ${label} submission activity`}
    >
      <div className="heatmap-row-heading">
        <h3>{year}</h3>
        <span>{total.toLocaleString()} reported submissions</span>
      </div>
      <div
        className="heatmap-scroll"
        tabIndex="0"
        role="region"
        aria-label={`${year} ${label} calendar; scroll horizontally for all dates`}
      >
        <div
          className="heatmap-months"
          style={{ gridTemplateColumns: `repeat(${weeks}, 12px)` }}
        >
          {months.map((month) => (
            <span key={month.column} style={{ gridColumn: month.column }}>
              {month.label}
            </span>
          ))}
        </div>
        <div className="heatmap-calendar">
          <div className="heatmap-weekdays" aria-hidden="true">
            <span>Mon</span>
            <span>Wed</span>
            <span>Fri</span>
          </div>
          <div
            className="heatmap-grid"
            role="img"
            aria-label={`${year}: ${total} ${label} reported submissions`}
          >
            {Array.from({ length: padding }, (_, index) => (
              <span className="heatmap-padding" key={`padding-${index}`} />
            ))}
            {days.map((day) => (
              <span
                className="heatmap-day"
                data-level={day.level}
                key={day.date}
                title={`${label} / ${day.date}: ${day.count} submissions`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default function ActivityHeatmap({ profiles }) {
  const [selected, setSelected] = useStoredState(
    "cpsync.profile.activityPlatform",
    "combined",
    isActivityPlatform,
  );
  const label =
    selected === "combined" ? "All platforms" : platforms[selected].name;
  const available = Object.keys(platforms).filter(
    (platform) => profiles[platform]?.heatmap != null,
  );
  const activity =
    selected === "combined"
      ? mergeActivity(available.map((platform) => profiles[platform].heatmap))
      : (profiles[selected]?.heatmap ?? null);
  const today = new Date().toISOString().slice(0, 10);
  const year = Number(today.slice(0, 4));
  const entries = Object.entries(activity || {}).filter(
    ([date]) => date.startsWith(`${year}-`) && date <= today,
  );
  const total = entries.reduce((sum, [, count]) => sum + count, 0);
  return (
    <section
      className={`activity-panel heatmap-${selected}`}
      aria-labelledby="activity-title"
    >
      <div className="profile-panel-heading">
        <div>
          <h2 id="activity-title">Submission activity heatmap</h2>
          <p>
            {label}
            {selected === "combined" ? " combined" : ""} / {year} year to date /
            UTC dates
          </p>
        </div>
        {activity !== null && (
          <strong className="heatmap-total">
            {total.toLocaleString()} reported submissions
          </strong>
        )}
      </div>
      <div
        className="profile-switcher activity-switcher"
        role="group"
        aria-label="Submission activity platform"
      >
        {["combined", ...Object.keys(platforms)].map((platform) => (
          <button
            type="button"
            key={platform}
            className={selected === platform ? "selected" : ""}
            aria-pressed={selected === platform}
            onClick={() => setSelected(platform)}
          >
            {platform === "combined"
              ? "All platforms"
              : platforms[platform].name}
          </button>
        ))}
      </div>
      {activity === null ? (
        <div className="profile-chart-empty">
          <h3>Activity data is unavailable.</h3>
          <p>
            {selected === "combined"
              ? "No linked feed has supplied a submission calendar."
              : profiles[selected]
                ? `${label} has not supplied a submission calendar.`
                : `Link a ${label} handle in Linked Profiles to see its activity.`}{" "}
            Missing activity is not counted as zero.
          </p>
        </div>
      ) : (
        <YearHeatmap year={year} activity={activity} label={label} />
      )}
    </section>
  );
}
