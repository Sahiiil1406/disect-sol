import { useMemo, useState } from "react";
import { formatLamports, shortenAddress } from "./traceUtils";

function statValue(value) {
  return value === undefined || value === null || value === "" ? "n/a" : value;
}

function firstItems(value, max = 8) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.slice(0, max);
}

function flattenImportantParams(value) {
  if (!value || typeof value !== "object") {
    return [];
  }

  const entries = Object.entries(value).slice(0, 12);
  return entries.map(([key, raw]) => ({
    key,
    value:
      typeof raw === "string"
        ? raw
        : Array.isArray(raw)
          ? `${raw.length} item(s)`
          : raw && typeof raw === "object"
            ? "Object"
            : String(raw),
  }));
}

export function TraceDetail({
  trace,
  paramSummary,
  traceMeta,
  viewMode,
  onChangeViewMode,
  cleanSummary,
  txInsights,
}) {
  const [jsonPane, setJsonPane] = useState("trace");

  const metrics = useMemo(() => {
    const details = txInsights?.details;
    return {
      status: trace?.error
        ? "Failed"
        : details?.meta?.err
          ? "Failed"
          : details
            ? "Confirmed"
            : "Pending",
      fee: typeof details?.meta?.fee === "number" ? formatLamports(details.meta.fee) : "n/a",
      compute:
        typeof details?.meta?.computeUnitsConsumed === "number"
          ? `${details.meta.computeUnitsConsumed} CU`
          : "n/a",
      slot: statValue(details?.slot),
      instructionCount:
        statValue(
          details?.transaction?.message?.instructions?.length ??
            cleanSummary?.instructions?.length,
        ),
      accountCount:
        statValue(
          details?.transaction?.message?.accountKeys?.length ?? cleanSummary?.accountCount,
        ),
      signature: txInsights?.signature || "",
      cluster: txInsights?.explorerLinks?.cluster || "unknown",
      endpointUsed: txInsights?.endpointUsed || trace?.endpoint || "n/a",
    };
  }, [trace, cleanSummary, txInsights]);

  if (!trace) {
    return (
      <section className="detail-panel">
        <p className="empty">Select a request to inspect details.</p>
      </section>
    );
  }

  if (viewMode === "clean") {
    const importantParams = flattenImportantParams(cleanSummary?.importantParams || paramSummary);

    return (
      <section className="detail-panel">
        <div className="detail-mode-tabs" role="tablist" aria-label="Detail mode">
          <button
            type="button"
            className={`detail-mode-tab ${viewMode === "clean" ? "active" : ""}`}
            onClick={() => onChangeViewMode("clean")}
          >
            Clean UI
          </button>
          <button
            type="button"
            className={`detail-mode-tab ${viewMode === "json" ? "active" : ""}`}
            onClick={() => onChangeViewMode("json")}
          >
            JSON
          </button>
        </div>

        <div className="clean-hero">
          <h2>{cleanSummary?.title || trace.method}</h2>
          <p className="clean-subtitle">{cleanSummary?.caseTitle || "Transaction details"}</p>
        </div>

        <div className="clean-metric-grid">
          <article className="clean-metric-card">
            <span>Status</span>
            <strong>{metrics.status}</strong>
          </article>
          <article className="clean-metric-card">
            <span>Duration</span>
            <strong>{statValue(cleanSummary?.duration)}</strong>
          </article>
          <article className="clean-metric-card">
            <span>Network</span>
            <strong>{metrics.cluster}</strong>
          </article>
          <article className="clean-metric-card">
            <span>Fee</span>
            <strong>{metrics.fee}</strong>
          </article>
          <article className="clean-metric-card">
            <span>Compute</span>
            <strong>{metrics.compute}</strong>
          </article>
          <article className="clean-metric-card">
            <span>Instructions</span>
            <strong>{metrics.instructionCount}</strong>
          </article>
        </div>

        {(txInsights?.signature || txInsights?.explorerLinks) && (
          <section className="clean-section">
            <h3>Transaction</h3>
            <p className="meta">Signature: {txInsights?.signature ? shortenAddress(txInsights.signature) : "n/a"}</p>
            <div className="clean-link-row">
              {txInsights?.explorerLinks?.explorer && (
                <a className="explorer-link" href={txInsights.explorerLinks.explorer} target="_blank" rel="noreferrer">
                  Solana Explorer
                </a>
              )}
              {txInsights?.explorerLinks?.solscan && (
                <a className="explorer-link" href={txInsights.explorerLinks.solscan} target="_blank" rel="noreferrer">
                  Solscan
                </a>
              )}
            </div>
          </section>
        )}

        {importantParams.length > 0 && (
          <section className="clean-section">
            <h3>Important parameters</h3>
            <div className="clean-kv-list">
              {importantParams.map((item) => (
                <div key={item.key} className="clean-kv-item">
                  <span>{item.key}</span>
                  <strong>{String(item.value)}</strong>
                </div>
              ))}
            </div>
          </section>
        )}

        {Array.isArray(cleanSummary?.accounts) && cleanSummary.accounts.length > 0 && (
          <section className="clean-section">
            <h3>Accounts involved</h3>
            <div className="clean-chip-list">
              {firstItems(cleanSummary.accounts, 12).map((account, index) => (
                <span key={`${account.label}-${index}`} className="clean-chip">
                  {shortenAddress(account.label)}
                  {account.signer ? " • signer" : ""}
                </span>
              ))}
            </div>
          </section>
        )}

        {txInsights?.loading && <p className="meta">Fetching on-chain details...</p>}
        {txInsights?.error && <p className="meta error">{txInsights.error}</p>}
      </section>
    );
  }

  const explorerJson =
    txInsights?.rawJson ||
    (txInsights?.details
      ? {
          result: txInsights.details,
          endpointUsed: txInsights.endpointUsed,
        }
      : {
          error: txInsights?.error || "Explorer details unavailable",
          endpointUsed: txInsights?.endpointUsed || "n/a",
        });

  return (
    <section className="detail-panel">
      <div className="detail-mode-tabs" role="tablist" aria-label="Detail mode">
        <button
          type="button"
          className={`detail-mode-tab ${viewMode === "clean" ? "active" : ""}`}
          onClick={() => onChangeViewMode("clean")}
        >
          Clean UI
        </button>
        <button
          type="button"
          className={`detail-mode-tab ${viewMode === "json" ? "active" : ""}`}
          onClick={() => onChangeViewMode("json")}
        >
          JSON
        </button>
      </div>

      <div className="detail-mode-tabs" role="tablist" aria-label="JSON source">
        <button
          type="button"
          className={`detail-mode-tab ${jsonPane === "trace" ? "active" : ""}`}
          onClick={() => setJsonPane("trace")}
        >
          Trace JSON
        </button>
        <button
          type="button"
          className={`detail-mode-tab ${jsonPane === "explorer" ? "active" : ""}`}
          onClick={() => setJsonPane("explorer")}
        >
          Explorer JSON
        </button>
      </div>

      {jsonPane === "trace" && (
        <>
          <h2>{trace.method}</h2>
          <div className="summary-grid">
            <p className="meta">Kind: {trace.kind}</p>
            <p className="meta">Transport: {trace.transport || "n/a"}</p>
            <p className="meta">Time: {trace.durationMs ?? "n/a"}ms</p>
          </div>

          {Object.keys(trace.meta || {}).length > 0 && (
            <details open className="detail-block">
              <summary>Function metadata</summary>
              <pre>{JSON.stringify(traceMeta, null, 2)}</pre>
            </details>
          )}

          <details open className="detail-block">
            <summary>Request params (decoded)</summary>
            <pre>{JSON.stringify(paramSummary, null, 2)}</pre>
          </details>

          <details className="detail-block">
            <summary>Raw response</summary>
            <pre>{JSON.stringify(trace.result, null, 2)}</pre>
          </details>
        </>
      )}

      {jsonPane === "explorer" && (
        <details open className="detail-block">
          <summary>Explorer transaction payload</summary>
          <pre>{JSON.stringify(explorerJson, null, 2)}</pre>
        </details>
      )}

      {trace.error && (
        <details open className="detail-block">
          <summary>Error</summary>
          <pre>{JSON.stringify(trace.error, null, 2)}</pre>
        </details>
      )}
    </section>
  );
}
