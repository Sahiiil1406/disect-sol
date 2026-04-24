import { useMemo } from "react";
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

function buildMinimalParameterList(trace, cleanSummary, paramSummary) {
  const txPreview = trace?.meta?.txPreview || null;
  const list = [];

  if (txPreview && typeof txPreview === "object") {
    if (txPreview.feePayer) {
      list.push({ key: "feePayer", value: String(txPreview.feePayer) });
    }

    if (txPreview.recentBlockhash) {
      list.push({
        key: "recentBlockhash",
        value: String(txPreview.recentBlockhash),
      });
    }

    if (typeof txPreview.instructionCount === "number") {
      list.push({
        key: "instructionCount",
        value: String(txPreview.instructionCount),
      });
    }

    if (typeof txPreview.accountCount === "number") {
      list.push({ key: "accountCount", value: String(txPreview.accountCount) });
    }

    if (
      Array.isArray(txPreview.instructions) &&
      txPreview.instructions.length > 0
    ) {
      const programIds = [
        ...new Set(
          txPreview.instructions
            .map((instruction) => instruction?.programId)
            .filter(Boolean),
        ),
      ];
      if (programIds.length > 0) {
        list.push({ key: "programIds", value: programIds.join(", ") });
      }

      const totalIxData = txPreview.instructions.reduce(
        (sum, instruction) =>
          sum +
          (typeof instruction?.dataLength === "number"
            ? instruction.dataLength
            : 0),
        0,
      );
      if (totalIxData > 0) {
        list.push({ key: "instructionDataBytes", value: String(totalIxData) });
      }
    }
  }

  if (list.length > 0) {
    return list;
  }

  if (
    Array.isArray(cleanSummary?.associatedParams) &&
    cleanSummary.associatedParams.length > 0
  ) {
    return cleanSummary.associatedParams.slice(0, 12);
  }

  if (paramSummary && typeof paramSummary === "object") {
    return flattenImportantParams(paramSummary).slice(0, 12);
  }

  return [];
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
  const metrics = useMemo(() => {
    const details = txInsights?.details;
    const statusValue = txInsights?.status;
    const traceResult = trace?.result;
    const feeLamports =
      details?.meta?.fee ?? traceResult?.meta?.fee ?? traceResult?.value?.fee;
    const computeUnits =
      details?.meta?.computeUnitsConsumed ??
      traceResult?.meta?.computeUnitsConsumed ??
      traceResult?.value?.unitsConsumed;

    return {
      status: trace?.error
        ? "Failed"
        : statusValue?.err
          ? "Failed"
          : statusValue?.confirmationStatus
            ? String(statusValue.confirmationStatus)
            : details?.meta?.err
              ? "Failed"
              : details
                ? "Confirmed"
                : "Pending",
      fee:
        typeof feeLamports === "number"
          ? formatLamports(feeLamports)
          : "n/a",
      compute:
        typeof computeUnits === "number"
          ? `${computeUnits} CU`
          : "n/a",
      slot: statValue(details?.slot),
      instructionCount: statValue(
        details?.transaction?.message?.instructions?.length ??
          cleanSummary?.instructions?.length,
      ),
      accountCount: statValue(
        details?.transaction?.message?.accountKeys?.length ??
          cleanSummary?.accountCount,
      ),
      signature: txInsights?.signature || "",
      signatureSource: txInsights?.signatureSource || "",
      cluster:
        txInsights?.explorerLinks?.cluster ||
        txInsights?.cluster ||
        cleanSummary?.cluster ||
        "unknown",
      endpointUsed:
        txInsights?.endpointUsed ||
        cleanSummary?.rpcEndpoint ||
        trace?.endpoint ||
        "n/a",
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
    const importantParams = buildMinimalParameterList(
      trace,
      cleanSummary,
      paramSummary,
    );

    return (
      <section className="detail-panel">
        <div
          className="detail-mode-tabs"
          role="tablist"
          aria-label="Detail mode"
        >
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
          <p className="clean-subtitle">
            {cleanSummary?.caseTitle || "Transaction details"}
          </p>
          <p className="meta">
            Function: {trace?.functionName || trace?.method || "unknown"}
          </p>
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
            <strong>
              {metrics.cluster || cleanSummary?.cluster || "unknown"}
            </strong>
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
          <article className="clean-metric-card">
            <span>Accounts</span>
            <strong>{metrics.accountCount}</strong>
          </article>
          <article className="clean-metric-card">
            <span>RPC</span>
            <strong>{metrics.endpointUsed}</strong>
          </article>
          <article className="clean-metric-card">
            <span>Call ID</span>
            <strong>{trace?.callId || "n/a"}</strong>
          </article>
        </div>

        {(txInsights?.signature || txInsights?.explorerLinks) && (
          <section className="clean-section">
            <h3>Transaction</h3>
            <p className="meta">
              Signature:{" "}
              {txInsights?.signature
                ? shortenAddress(txInsights.signature)
                : "n/a"}
            </p>
            {metrics.signatureSource && (
              <p className="meta">Source: {metrics.signatureSource}</p>
            )}
            <div className="clean-link-row">
              {txInsights?.explorerLinks?.explorer && (
                <a
                  className="explorer-link"
                  href={txInsights.explorerLinks.explorer}
                  target="_blank"
                  rel="noreferrer"
                >
                  Solana Explorer
                </a>
              )}
              {txInsights?.explorerLinks?.solscan && (
                <a
                  className="explorer-link"
                  href={txInsights.explorerLinks.solscan}
                  target="_blank"
                  rel="noreferrer"
                >
                  Solscan
                </a>
              )}
            </div>
          </section>
        )}

        {importantParams.length > 0 && (
          <section className="clean-section">
            <h3>Parameter list</h3>
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

        {Array.isArray(cleanSummary?.accounts) &&
          cleanSummary.accounts.length > 0 && (
            <section className="clean-section">
              <h3>Associated accounts</h3>
              <div className="clean-chip-list">
                {firstItems(cleanSummary.accounts, 12).map((account, index) => (
                  <span
                    key={`${account.label}-${index}`}
                    className="clean-chip"
                  >
                    {shortenAddress(account.label)}
                    {account.signer ? " • signer" : ""}
                  </span>
                ))}
              </div>
            </section>
          )}

        {txInsights?.loading && (
          <p className="meta">Fetching on-chain details...</p>
        )}
        {txInsights?.error && (
          <p
            className={`meta ${
              /No transaction signature|does not produce an on-chain transaction/i.test(
                txInsights.error,
              )
                ? ""
                : "error"
            }`}
          >
            {txInsights.error}
          </p>
        )}
      </section>
    );
  }

  const traceJson = {
    functionName: trace?.functionName || trace?.method || "unknown",
    callId: trace?.callId || "n/a",
    method: trace?.method,
    kind: trace?.kind,
    durationMs: trace?.durationMs,
    params: paramSummary,
    result: trace?.result,
    error: trace?.error || null,
    meta: traceMeta,
  };

  const explorerJson = txInsights?.rawJson || {
    result: txInsights?.details || null,
    status: txInsights?.status || null,
    endpointUsed: txInsights?.endpointUsed || "n/a",
    error: txInsights?.error || "Explorer details unavailable",
  };

  const decodedParamsJson = {
    txPreview: trace?.meta?.txPreview || null,
    requestMethod: trace?.meta?.requestMethod || null,
    requestParams: trace?.meta?.requestParams || null,
    requestSummary: trace?.meta?.requestSummary || null,
    params: trace?.params ?? paramSummary,
  };

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

      <h2>{trace.functionName || trace.method}</h2>
      <div className="summary-grid">
        <p className="meta">Kind: {trace.kind}</p>
        <p className="meta">Transport: {trace.transport || "n/a"}</p>
        <p className="meta">Time: {trace.durationMs ?? "n/a"}ms</p>
      </div>

      <details open className="detail-block">
        <summary>Trace JSON</summary>
        <pre>{JSON.stringify(traceJson, null, 2)}</pre>
      </details>

      <details open className="detail-block">
        <summary>Explorer JSON</summary>
        <pre>{JSON.stringify(explorerJson, null, 2)}</pre>
      </details>

      <details open className="detail-block">
        <summary>Decoded Parameters JSON</summary>
        <pre>{JSON.stringify(decodedParamsJson, null, 2)}</pre>
      </details>

      {trace.error && (
        <details open className="detail-block">
          <summary>Error</summary>
          <pre>{JSON.stringify(trace.error, null, 2)}</pre>
        </details>
      )}
    </section>
  );
}
