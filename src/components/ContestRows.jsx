import Icon from "./Icon.jsx";
import CalendarButton from "./CalendarButton.jsx";
import PlatformBadge from "./PlatformBadge.jsx";
import Countdown from "./Countdown.jsx";
import { formatDate, formatDuration, formatTime } from "../utils/format.js";

export default function ContestRows({ contests }) {
  return (
    <div className="contest-list">
      {contests.map((contest) => (
        <article
          className={`contest-row platform-${contest.platform}`}
          key={contest.id}
        >
          <div className="contest-name">
            <div className="contest-badges">
              <PlatformBadge platform={contest.platform} />
              <span
                className={`contest-status ${contest.phase === "CODING" ? "is-live" : ""}`}
              >
                {contest.phase === "CODING" ? "● Live now" : "Upcoming"}
              </span>
            </div>
            <h3>
              <a href={contest.url} target="_blank" rel="noreferrer">
                {contest.name}
                <Icon name="arrow" size={15} />
              </a>
            </h3>
            <div className="contest-meta">
              <span>
                <Icon name="calendar" size={15} />
                {formatDate(contest.startTimeSeconds)}
              </span>
              <span>
                <Icon name="clock" size={15} />
                {formatTime(contest.startTimeSeconds)}
              </span>
              <span>{formatDuration(contest.durationSeconds)}</span>
            </div>
          </div>
          <div className="contest-actions">
            <Countdown
              start={
                contest.phase === "CODING"
                  ? contest.startTimeSeconds + contest.durationSeconds
                  : contest.startTimeSeconds
              }
              label={contest.phase === "CODING" ? "Ends in" : "Starts in"}
            />
            <a
              className="button button-small go-to-contest"
              href={contest.url}
              target="_blank"
              rel="noreferrer"
            >
              Go to contest
              <Icon name="arrow" size={16} />
            </a>
            <CalendarButton contest={contest} />
          </div>
        </article>
      ))}
    </div>
  );
}
