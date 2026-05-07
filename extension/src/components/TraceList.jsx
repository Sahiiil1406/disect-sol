export function TraceList({
  traces,
  selectedTraceId,
  onSelect,
  highlightedTraceIds = [],
}) {
  const highlightedSet = new Set(highlightedTraceIds);

  return (
    <section className="list-pane">
      <div className="list-head">
        <span>Function Calls</span>
      </div>
      <div className="event-list">
        {traces.length === 0 && (
          <p className="empty">
            No requests captured yet. Trigger calls in a Solana dApp tab.
          </p>
        )}

        {traces.map((trace) => (
          <article
            key={trace.traceId}
            className={`event-item ${selectedTraceId === trace.traceId ? "selected" : ""} ${highlightedSet.has(trace.traceId) ? "new-log-item" : ""}`}
            onClick={() => onSelect(trace.traceId)}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelect(trace.traceId);
              }
            }}
          >
            <div className="event-top">
              <span
                className={`pill ${String(trace.kind || "").toLowerCase()}`}
              >
                {trace.kind || "SYSTEM"}
              </span>
              {typeof trace.statusCode === "number" && (
                <span className="pill phase-info">{trace.statusCode}</span>
              )}
              <time>
                {new Date(trace.startedAt || Date.now()).toLocaleTimeString()}
              </time>
            </div>
            <p className="method">{trace.method || "unknown"}</p>
            <p className="meta host">{trace.endpoint || "n/a"}</p>
            {typeof trace.durationMs === "number" && (
              <p className="meta">{trace.durationMs}ms</p>
            )}
            {trace.error && (
              <p className="meta error">
                {trace.error.message || "unknown error"}
              </p>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
