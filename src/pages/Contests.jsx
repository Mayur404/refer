import useStoredState from "../hooks/useStoredState.js";
import {
  isSearchQuery,
  isContestPhase,
  isPlatformList,
} from "../utils/preferences.js";
import PageHeading from "../components/PageHeading.jsx";
import ContestRows from "../components/ContestRows.jsx";
import RequestState from "../components/RequestState.jsx";
import Icon from "../components/Icon.jsx";
import useContests from "../hooks/useContests.js";
import { platforms } from "../data/platforms.js";
import PlatformBadge from "../components/PlatformBadge.jsx";
import FeedStatus from "../components/FeedStatus.jsx";

export default function Contests() {
  const { contests, sources, loading, error, retry } = useContests();
  const [query, setQuery] = useStoredState(
    "cpsync.contests.query",
    "",
    isSearchQuery,
  );
  const [phase, setPhase] = useStoredState(
    "cpsync.contests.phase",
    "all",
    isContestPhase,
  );
  const [selectedPlatforms, setSelectedPlatforms] = useStoredState(
    "cpsync.contests.platforms",
    [],
    isPlatformList,
  );
  const hasFilters = query || phase !== "all" || selectedPlatforms.length > 0;
  const filtered = contests.filter(
    (contest) =>
      `${contest.name} ${platforms[contest.platform].name}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()) &&
      (!selectedPlatforms.length ||
        selectedPlatforms.includes(contest.platform)) &&
      (phase === "all" ||
        (phase === "upcoming"
          ? contest.phase === "BEFORE"
          : contest.phase !== "BEFORE")),
  );

  return (
    <>
      <PageHeading
        title="Coding contests"
        description="Codeforces, LeetCode, and CodeChef. Find your next round in one place."
      >
        <button
          className="button button-outline"
          onClick={retry}
          disabled={loading}
          aria-busy={loading}
        >
          <Icon name="refresh" size={16} />
          Refresh schedule
        </button>
      </PageHeading>
      <div className="contests-layout">
        <aside className="contest-filters">
          <h2>
            <Icon name="grid" size={20} />
            Filters & search
          </h2>
          <label className="search-label">
            <span>Search contests</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              type="search"
              maxLength={200}
              placeholder="Search title or platform…"
            />
          </label>
          <div className="filter-bar">
            <div className="filter-tabs" aria-label="Contest status">
              {[
                ["all", "All"],
                ["upcoming", "Upcoming"],
                ["live", "Live"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  className={phase === value ? "selected" : ""}
                  onClick={() => setPhase(value)}
                  aria-pressed={phase === value}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <fieldset className="platform-filters">
            <legend>Platforms</legend>
            {Object.entries(platforms).map(([key, platform]) => (
              <label key={key} className={`platform-filter platform-${key}`}>
                <span>{platform.name}</span>
                <input
                  type="checkbox"
                  checked={selectedPlatforms.includes(key)}
                  onChange={() =>
                    setSelectedPlatforms((current) =>
                      current.includes(key)
                        ? current.filter((item) => item !== key)
                        : [...current, key],
                    )
                  }
                />
              </label>
            ))}
          </fieldset>
          {hasFilters && (
            <button
              className="button button-small button-outline clear-filters"
              onClick={() => {
                setQuery("");
                setPhase("all");
                setSelectedPlatforms([]);
              }}
            >
              Clear filters
            </button>
          )}
          <div className="official-schedules">
            <p className="eyebrow">OFFICIAL SCHEDULES</p>
            {Object.entries(platforms).map(([key, platform]) => (
              <a
                key={key}
                className={`platform-${key}`}
                href={platform.contestsUrl}
                target="_blank"
                rel="noreferrer"
              >
                <PlatformBadge platform={key} />
                <Icon name="arrow" size={14} />
              </a>
            ))}
          </div>
        </aside>
        <section className="contest-results" aria-label="Contest results">
          <FeedStatus sources={sources} loading={loading} />
          <div className="list-caption">
            <h2>
              {phase === "live"
                ? "Live contests"
                : phase === "upcoming"
                  ? "Upcoming contests"
                  : "All contests"}
            </h2>
            <span className="mono">
              {loading
                ? "FETCHING…"
                : error
                  ? "UNAVAILABLE"
                  : `${filtered.length} ROUNDS`}
            </span>
          </div>
          {loading || error || !filtered.length ? (
            <RequestState
              loading={loading}
              error={error}
              retry={retry}
              empty={
                query
                  ? "No matching rounds. Try another search."
                  : "No rounds in this category right now."
              }
            />
          ) : (
            <ContestRows contests={filtered} />
          )}
        </section>
      </div>
    </>
  );
}
