import Icon from "./Icon.jsx";
import PlatformBadge from "./PlatformBadge.jsx";
import { platforms } from "../data/platforms.js";

export default function ProfileStatsCard({ platform, handle, state }) {
  const profile = state?.data;
  const definition = platforms[platform];
  const status = state?.status || (handle ? "loading" : "idle");
  const difficulty = profile
    ? {
        easy: profile.easySolved,
        medium: profile.mediumSolved,
        hard: profile.hardSolved,
      }
    : null;
  const hasDifficulty =
    difficulty && Object.values(difficulty).every(Number.isFinite);
  const difficultyTotal = hasDifficulty
    ? Math.max(1, difficulty.easy + difficulty.medium + difficulty.hard)
    : 1;
  const rating =
    profile?.rating !== null && profile?.rating !== undefined
      ? profile.rating.toLocaleString()
      : profile?.ratingStatus === "unrated"
        ? "Unrated"
        : "—";

  return (
    <section
      className={`profile-stat-card platform-${platform}`}
      aria-label={`${definition.name} statistics`}
    >
      <div className="profile-card-top">
        <PlatformBadge platform={platform} />
        <Icon name="trophy" size={20} />
      </div>
      {status === "loading" ? (
        <div className="profile-card-state" role="status">
          <span className="loading-mark" />
          <p>Syncing {definition.name}…</p>
        </div>
      ) : status === "error" ? (
        <div className="profile-card-state">
          <p className="field-error" role="alert">
            {state.error}
          </p>
          <a
            className="text-link"
            href={`${definition.profileUrl}${encodeURIComponent(handle)}`}
            target="_blank"
            rel="noreferrer"
          >
            Check official profile
            <Icon name="arrow" size={14} />
          </a>
        </div>
      ) : !profile ? (
        <div className="profile-card-state">
          <p>Not linked</p>
          <span>Add your handle in Linked Profiles.</span>
        </div>
      ) : (
        <>
          <div className="profile-rating-row">
            <strong>{rating}</strong>
            {platform === "leetcode" ? (
              <span>
                Solved: <b>{profile.totalSolved ?? "—"}</b>
              </span>
            ) : (
              <span className="profile-rank">
                {profile.rank ||
                  profile.stars ||
                  (profile.ratingStatus === "unrated"
                    ? "Unrated"
                    : "Rank unavailable")}
              </span>
            )}
          </div>
          {platform === "leetcode" && hasDifficulty ? (
            <div className="difficulty-summary">
              <div
                className="difficulty-bar"
                role="img"
                aria-label={`Solved: ${difficulty.easy} easy, ${difficulty.medium} medium, ${difficulty.hard} hard`}
              >
                {Object.entries(difficulty).map(([level, count]) => (
                  <span
                    className={`difficulty-${level}`}
                    key={level}
                    style={{ width: `${(count / difficultyTotal) * 100}%` }}
                  />
                ))}
              </div>
              <div className="difficulty-labels">
                <span>Easy: {difficulty.easy}</span>
                <span>Medium: {difficulty.medium}</span>
                <span>Hard: {difficulty.hard}</span>
              </div>
            </div>
          ) : (
            <p className="profile-solved">
              Solved:{" "}
              <strong>
                {profile.totalSolved === null ||
                profile.totalSolved === undefined
                  ? "Unavailable"
                  : `${profile.solvedIsPartial ? "≥ " : ""}${profile.totalSolved.toLocaleString()}`}
              </strong>
              {platform === "codeforces" && Number.isFinite(profile.totalSolved)
                ? " unique problems"
                : ""}
            </p>
          )}
          <div className="profile-card-footer">
            <a
              href={`${definition.profileUrl}${encodeURIComponent(profile.handle)}`}
              target="_blank"
              rel="noreferrer"
            >
              @{profile.handle}
              <Icon name="arrow" size={13} />
            </a>
            {profile.warning && (
              <details className="profile-data-note">
                <summary>Data availability</summary>
                <p>{profile.warning}</p>
              </details>
            )}
          </div>
          {(state.refreshing || state.error) && (
            <p className="profile-coverage" role="status">
              Saved {new Date(state.savedAt).toLocaleString()}.
              {state.refreshing
                ? " Refreshing…"
                : ` Refresh failed: ${state.error}`}
            </p>
          )}
        </>
      )}
    </section>
  );
}
