import { useState } from "react";
import useStoredState from "../hooks/useStoredState.js";
import { isPlatformList } from "../utils/preferences.js";
import { platforms } from "../data/platforms.js";
import PlatformBadge from "./PlatformBadge.jsx";

export default function ProfileTimeline({ profiles }) {
  const [activePoint, setActivePoint] = useState(null);
  const [hidden, setHidden] = useStoredState(
    "cpsync.profile.hiddenRatings",
    [],
    isPlatformList,
  );
  const series = Object.keys(platforms)
    .map((platform) => ({
      platform,
      points: (profiles[platform]?.ratingHistory || [])
        .filter(
          (point) =>
            Number.isFinite(point.rating) &&
            Number.isFinite(Date.parse(point.date)),
        )
        .sort((a, b) => Date.parse(a.date) - Date.parse(b.date)),
    }))
    .filter((series) => series.points.length);
  const visible = series.filter((series) => !hidden.includes(series.platform));
  const missingHistory = Object.keys(platforms).filter(
    (platform) =>
      profiles[platform]?.ratingStatus === "available" &&
      !profiles[platform]?.ratingHistory?.length,
  );
  const allPoints = visible.flatMap((series) => series.points);
  const times = allPoints.map((point) => Date.parse(point.date) / 1000);
  const values = allPoints.map((point) => point.rating);
  const earliest = Math.min(...times);
  const latest = Math.max(...times);
  const timePadding = Math.max(86400, (latest - earliest) * 0.035);
  const first = earliest - timePadding;
  const last = latest + timePadding;
  const min = Math.max(0, Math.floor((Math.min(...values) - 100) / 250) * 250);
  const max = Math.max(
    min + 500,
    Math.ceil((Math.max(...values) + 100) / 250) * 250,
  );
  const x = (time) =>
    64 + ((time - first) / Math.max(86400, last - first)) * 764;
  const y = (rating) => 286 - ((rating - min) / (max - min)) * 244;
  const dateLabel = (time) =>
    new Intl.DateTimeFormat(undefined, {
      month: "short",
      ...(latest - earliest < 120 * 86400
        ? { day: "numeric" }
        : { year: "numeric" }),
      timeZone: "UTC",
    }).format(new Date(time * 1000));

  const active =
    activePoint &&
    visible.some(
      (series) =>
        series.platform === activePoint.platform &&
        series.points.includes(activePoint.point),
    )
      ? activePoint
      : null;
  const fullDate = (date) =>
    new Intl.DateTimeFormat(undefined, {
      dateStyle: "full",
      timeZone: "UTC",
    }).format(new Date(date));
  function showPoint(element, platform, point, previous) {
    const chart = element.closest(".rating-chart").getBoundingClientRect();
    const marker = element.getBoundingClientRect();
    setActivePoint({
      platform,
      point,
      previous,
      left: Math.min(
        Math.max(8, marker.x - chart.x + 12),
        Math.max(8, chart.width - 268),
      ),
      top: Math.min(
        Math.max(
          8,
          marker.y - chart.y > 170
            ? marker.y - chart.y - 162
            : marker.y - chart.y + 16,
        ),
        Math.max(8, chart.height - 166),
      ),
    });
  }

  return (
    <section className="profile-chart-panel" aria-labelledby="rating-title">
      <div className="profile-panel-heading">
        <div>
          <h2 id="rating-title">Unified rating progression</h2>
          <p>All-time contest ratings. Hover or focus a point for details.</p>
        </div>
        <div className="profile-chart-legend">
          {series.map(({ platform }) => (
            <button
              key={platform}
              className={`chart-platform-${platform}`}
              onClick={() =>
                setHidden((current) =>
                  current.includes(platform)
                    ? current.filter((item) => item !== platform)
                    : [...current, platform],
                )
              }
              aria-label={`${hidden.includes(platform) ? "Show" : "Hide"} ${platforms[platform].name} rating history`}
              aria-pressed={!hidden.includes(platform)}
            >
              <svg width="24" height="12" aria-hidden="true">
                <line
                  x1="0"
                  x2="24"
                  y1="6"
                  y2="6"
                  stroke="currentColor"
                  strokeWidth="2"
                />
              </svg>
              <PlatformBadge platform={platform} />
            </button>
          ))}
        </div>
      </div>
      {missingHistory.length > 0 && (
        <p className="profile-coverage">
          {missingHistory
            .map((platform) => platforms[platform].name)
            .join(", ")}
          : contest history is currently unavailable. Save &amp; sync profiles
          to retry.
        </p>
      )}
      <div className="chart-toolbar">
        <span className="chart-axis-label">Contest rating</span>
        <span className="chart-axis-label">All time</span>
      </div>
      {!allPoints.length ? (
        <div className="profile-chart-empty">
          <h3>
            {series.length
              ? "Choose a platform above."
              : "No rating history available."}
          </h3>
          <p>
            {series.length
              ? "Use the platform labels to show a timeline."
              : "Link a handle with available contest history. A missing provider history is not an unrated profile."}
          </p>
        </div>
      ) : (
        <div
          className="rating-chart"
          onPointerLeave={() => setActivePoint(null)}
        >
          <div
            className="timeline-scroll"
            onScroll={() => setActivePoint(null)}
          >
            <svg
              className="profile-timeline"
              viewBox="0 0 860 344"
              role="img"
              aria-label={`Rating history for ${visible.map((series) => platforms[series.platform].name).join(", ")}`}
            >
              <title>Unified rating progression</title>
              {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
                const rating = Math.round(min + (max - min) * fraction);
                return (
                  <g key={fraction}>
                    <line
                      x1="64"
                      x2="828"
                      y1={y(rating)}
                      y2={y(rating)}
                      stroke="var(--line)"
                      opacity="0.55"
                    />
                    <text x="50" y={y(rating) + 5} textAnchor="end">
                      {rating}
                    </text>
                  </g>
                );
              })}
              {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
                const time = earliest + (latest - earliest) * fraction;
                if (earliest === latest && fraction !== 0.5) return null;
                return (
                  <text key={fraction} x={x(time)} y="320" textAnchor="middle">
                    {dateLabel(time)}
                  </text>
                );
              })}
              {visible.map(({ platform, points }) => (
                <g className={`chart-platform-${platform}`} key={platform}>
                  <polyline
                    points={points
                      .map(
                        (point) =>
                          `${x(Date.parse(point.date) / 1000)},${y(point.rating)}`,
                      )
                      .join(" ")}
                    fill="none"
                    stroke="var(--chart-color)"
                    strokeWidth="2.5"
                    strokeLinejoin="round"
                  />
                  {points.map((point, index) => (
                    <circle
                      key={`${point.date}-${index}`}
                      className={`rating-point${active?.platform === platform && active?.point === point ? " is-active" : ""}`}
                      cx={x(Date.parse(point.date) / 1000)}
                      cy={y(point.rating)}
                      r={
                        activePoint?.platform === platform &&
                        activePoint?.point === point
                          ? 6
                          : points.length > 100
                            ? 2.8
                            : 4
                      }
                      stroke="var(--surface)"
                      strokeWidth="1.5"
                      tabIndex="0"
                      aria-label={`${platforms[platform].name}, ${point.contest}, rating ${point.rating}, ${point.date}`}
                      aria-describedby={
                        active?.platform === platform && active?.point === point
                          ? "rating-point-tooltip"
                          : undefined
                      }
                      onPointerEnter={(event) =>
                        showPoint(
                          event.currentTarget,
                          platform,
                          point,
                          points[index - 1]?.rating ?? null,
                        )
                      }
                      onFocus={(event) =>
                        showPoint(
                          event.currentTarget,
                          platform,
                          point,
                          points[index - 1]?.rating ?? null,
                        )
                      }
                      onClick={(event) =>
                        showPoint(
                          event.currentTarget,
                          platform,
                          point,
                          points[index - 1]?.rating ?? null,
                        )
                      }
                      onBlur={() => setActivePoint(null)}
                      onKeyDown={(event) => {
                        if (event.key === "Escape") setActivePoint(null);
                      }}
                      fill="var(--chart-color)"
                    />
                  ))}
                </g>
              ))}
            </svg>
          </div>
          {active && (
            <div
              id="rating-point-tooltip"
              role="tooltip"
              className={`rating-tooltip chart-platform-${active.platform}`}
              style={{
                left: `clamp(8px, ${active.left}px, max(8px, calc(100% - 268px)))`,
                top: active.top,
              }}
            >
              <strong>{platforms[active.platform].name}</strong>
              <span className="rating-tooltip-contest">
                {active.point.contest}
              </span>
              <time dateTime={active.point.date}>
                {fullDate(active.point.date)}
              </time>
              <dl>
                <div>
                  <dt>Rating</dt>
                  <dd>{active.point.rating.toLocaleString()}</dd>
                </div>
                <div>
                  <dt>Change</dt>
                  <dd>
                    {active.previous === null
                      ? "First contest"
                      : `${active.point.rating - active.previous > 0 ? "+" : ""}${(active.point.rating - active.previous).toLocaleString()}`}
                  </dd>
                </div>
                {active.previous !== null && (
                  <div>
                    <dt>Previous</dt>
                    <dd>{active.previous.toLocaleString()}</dd>
                  </div>
                )}
              </dl>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
