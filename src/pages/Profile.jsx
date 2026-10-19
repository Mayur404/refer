import { useState } from "react";
import Icon from "../components/Icon.jsx";
import ProfileStatsCard from "../components/ProfileStatsCard.jsx";
import ProfileTimeline from "../components/ProfileTimeline.jsx";
import ActivityHeatmap from "../components/ActivityHeatmap.jsx";
import RequestState from "../components/RequestState.jsx";
import useProfiles, { readSavedHandles } from "../hooks/useProfiles.js";
import { validatePlatformHandle } from "../services/profiles.js";
import { platforms } from "../data/platforms.js";
import { writeStorage } from "../utils/storage.js";
import { summarizeSolved } from "../utils/profileSummary.js";

const order = ["leetcode", "codeforces", "codechef"];

export default function Profile() {
  const { handles, states, loading, sync } = useProfiles();
  const [drafts, setDrafts] = useState(readSavedHandles);
  const [errors, setErrors] = useState({});
  const [notice, setNotice] = useState("");
  const hasHandles = Object.values(handles).some(Boolean);
  const profiles = Object.fromEntries(
    order.map((platform) => [platform, states[platform]?.data || null]),
  );
  const solved = summarizeSolved(states, handles);
  const hasData = Object.values(profiles).some(Boolean);

  function submit(event) {
    event.preventDefault();
    const cleaned = Object.fromEntries(
      order.map((platform) => [platform, drafts[platform].trim()]),
    );
    const invalid = Object.fromEntries(
      order.map((platform) => [
        platform,
        cleaned[platform]
          ? validatePlatformHandle(cleaned[platform], platform)
          : "",
      ]),
    );
    setErrors(invalid);
    if (Object.values(invalid).some(Boolean)) return;
    setDrafts(cleaned);
    const saved = order.map((platform) =>
      writeStorage(`cpsync.handle.${platform}`, cleaned[platform]),
    );
    setNotice(
      saved.every(Boolean)
        ? "Handles saved on this device."
        : "Your browser could not save every handle. You can still sync this session.",
    );
    sync(cleaned);
  }

  return (
    <>
      <h1 className="sr-only">Your coding profile</h1>
      <div className="profile-layout">
        <aside className="linked-profiles">
          <h2>
            <Icon name="user" size={22} />
            Linked Profiles
          </h2>
          <form onSubmit={submit} noValidate>
            {order.map((platform) => (
              <div
                className={`profile-handle-field platform-${platform}`}
                key={platform}
              >
                <label htmlFor={`handle-${platform}`}>
                  {platforms[platform].name} handle
                </label>
                <input
                  id={`handle-${platform}`}
                  value={drafts[platform]}
                  onChange={(event) => {
                    setDrafts((current) => ({
                      ...current,
                      [platform]: event.target.value,
                    }));
                    setErrors((current) => ({ ...current, [platform]: "" }));
                  }}
                  placeholder="Enter username"
                  autoComplete="off"
                  spellCheck="false"
                  maxLength={platform === "codeforces" ? 24 : 30}
                  aria-invalid={Boolean(errors[platform])}
                  aria-describedby={
                    errors[platform] ? `handle-error-${platform}` : undefined
                  }
                />
                {errors[platform] && (
                  <p
                    className="field-error"
                    id={`handle-error-${platform}`}
                    role="alert"
                  >
                    {errors[platform]}
                  </p>
                )}
              </div>
            ))}
            <button
              className="button"
              disabled={loading}
              aria-busy={loading}
              type="submit"
            >
              <Icon name={loading ? "refresh" : "check"} size={17} />
              {loading ? "Syncing profiles…" : "Save & sync profiles"}
            </button>
          </form>
          <p className="profile-storage-note" role="status">
            {notice || "No sign-in required. Your handles stay on this device."}
          </p>
        </aside>
        <div className="profile-dashboard">
          {!hasHandles ? (
            <section className="profile-empty-state">
              <Icon name="user" size={46} />
              <h2>No profiles linked yet</h2>
              <p>
                Enter your LeetCode, Codeforces, or CodeChef handles to see
                ratings, solved problems, and submission activity together.
              </p>
            </section>
          ) : (
            <>
              <div className="profile-stat-grid">
                <section
                  className="profile-stat-card total-solved-card"
                  aria-label="Total solved statistics"
                >
                  <div className="profile-card-top">
                    <h2>Total solved</h2>
                    <Icon name="check" size={22} />
                  </div>
                  <strong className="solved-total">
                    {solved.total === null
                      ? "—"
                      : `${solved.partial ? "≥ " : ""}${solved.total.toLocaleString()}`}
                  </strong>
                  <div className="solved-breakdown">
                    {order.map((platform) => (
                      <span className={`platform-${platform}`} key={platform}>
                        {platforms[platform].name}
                        <strong>
                          {profiles[platform]?.totalSolved ?? "—"}
                        </strong>
                      </span>
                    ))}
                  </div>
                  <p className="profile-coverage">
                    {loading
                      ? "Syncing linked profiles…"
                      : solved.partial
                        ? "Available counts only. Missing counts and partial histories are not treated as zero."
                        : "Unique problems solved on each linked platform, added together."}
                  </p>
                </section>
                {order.map((platform) => (
                  <ProfileStatsCard
                    key={platform}
                    platform={platform}
                    handle={handles[platform]}
                    state={states[platform]}
                  />
                ))}
              </div>
              {loading && !hasData ? (
                <RequestState loading />
              ) : (
                <>
                  <ProfileTimeline profiles={profiles} />
                  <ActivityHeatmap profiles={profiles} />
                </>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
