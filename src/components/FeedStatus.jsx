import { platforms } from "../data/platforms.js";

export default function FeedStatus({ sources, loading }) {
  const failed = sources.filter((source) => !source.ok);
  if (loading || !failed.length) return null;
  return (
    <div className="feed-notice" role="status">
      {failed.map((source) => (
        <p key={source.platform}>
          <strong>{platforms[source.platform].name}:</strong> Feed unavailable.{" "}
          <a
            href={platforms[source.platform].contestsUrl}
            target="_blank"
            rel="noreferrer"
          >
            Open official schedule ↗
          </a>
        </p>
      ))}
    </div>
  );
}
