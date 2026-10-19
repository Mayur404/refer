import Icon from "./Icon.jsx";

export default function RequestState({ loading, error, retry, empty }) {
  if (loading)
    return (
      <div className="request-state" role="status">
        <span className="loading-mark" />
        <p>Fetching the latest data…</p>
      </div>
    );
  if (error)
    return (
      <div className="request-state error-state" role="alert">
        <span className="mono">CONNECTION INTERRUPTED</span>
        <p>{error}</p>
        {retry && (
          <button
            className="button button-small button-outline"
            onClick={retry}
          >
            <Icon name="refresh" size={14} /> Try again
          </button>
        )}
      </div>
    );
  return (
    <div className="request-state">
      <p>{empty || "Nothing here yet."}</p>
    </div>
  );
}
