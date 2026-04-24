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

function buildInstructionDecodedPairs(instruction) {
  if (!instruction || typeof instruction !== "object") {
    return [];
  }

  const decoded = instruction.decoded;
  const pairs = [];

  if (decoded && typeof decoded === "object") {
    for (const [key, raw] of Object.entries(decoded)) {
      if (raw === undefined || raw === null || raw === "") {
        continue;
      }

      pairs.push({
        key,
        value:
          typeof raw === "string" ||
          typeof raw === "number" ||
          typeof raw === "boolean"
            ? String(raw)
            : JSON.stringify(raw),
      });
    }
  }

  if (instruction.dataLength !== null && instruction.dataLength !== undefined) {
    pairs.push({ key: "dataLength", value: String(instruction.dataLength) });
  }

  if (instruction.dataEncoding) {
    pairs.push({
      key: "dataEncoding",
      value: String(instruction.dataEncoding),
    });
  }

  if (instruction.dataPreviewHex) {
    pairs.push({
      key: "dataPreviewHex",
      value: String(instruction.dataPreviewHex),
    });
  }

  return pairs.slice(0, 12);
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
  accountStorageInsights,
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
        typeof feeLamports === "number" ? formatLamports(feeLamports) : "n/a",
      compute: typeof computeUnits === "number" ? `${computeUnits} CU` : "n/a",
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

  const readRequestLog = trace?.meta?.readRequest || null;
  const readResultLog = trace?.meta?.readResult || null;

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
          <button
            type="button"
            className={`detail-mode-tab ${viewMode === "accounts" ? "active" : ""}`}
            onClick={() => onChangeViewMode("accounts")}
          >
            Account Storage
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

        {(readRequestLog || readResultLog) && (
          <section className="clean-section">
            <h3>Read Logs</h3>
            {readRequestLog && (
              <details open className="detail-block read-log-block">
                <summary>Request</summary>
                <pre>{JSON.stringify(readRequestLog, null, 2)}</pre>
              </details>
            )}
            {readResultLog && (
              <details open className="detail-block read-log-block">
                <summary>Result</summary>
                <pre>{JSON.stringify(readResultLog, null, 2)}</pre>
              </details>
            )}
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

        {Array.isArray(cleanSummary?.instructions) &&
          cleanSummary.instructions.length > 0 && (
            <section className="clean-section">
              <h3>Instruction decoder</h3>
              <div className="decoded-instruction-list">
                {firstItems(cleanSummary.instructions, 10).map(
                  (instruction) => {
                    const decodedPairs =
                      buildInstructionDecodedPairs(instruction);
                    return (
                      <article
                        key={`${instruction.index}-${instruction.programId}`}
                        className="decoded-instruction-card"
                      >
                        <p className="meta">
                          #{instruction.index} - {instruction.programId}
                        </p>
                        <p className="meta">
                          Accounts: {statValue(instruction.accountCount)}
                        </p>
                        {decodedPairs.length > 0 ? (
                          <div className="clean-kv-list">
                            {decodedPairs.map((pair) => (
                              <div
                                key={`${instruction.index}-${pair.key}`}
                                className="clean-kv-item"
                              >
                                <span>{pair.key}</span>
                                <strong>{pair.value}</strong>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="meta">No decoded fields available</p>
                        )}
                      </article>
                    );
                  },
                )}
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

  if (viewMode === "accounts") {
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
          <button
            type="button"
            className={`detail-mode-tab ${viewMode === "accounts" ? "active" : ""}`}
            onClick={() => onChangeViewMode("accounts")}
          >
            Account Storage
          </button>
        </div>

        <div className="clean-hero">
          <h2>Account Storage</h2>
          <p className="clean-subtitle">
            What data is currently stored in accounts related to this
            transaction
          </p>
          <p className="meta">Method: {trace?.method || "unknown"}</p>
          <p className="meta">
            RPC:{" "}
            {accountStorageInsights?.endpointUsed ||
              txInsights?.endpointUsed ||
              "n/a"}
          </p>
          {accountStorageInsights?.slot !== null &&
            accountStorageInsights?.slot !== undefined && (
              <p className="meta">Slot: {accountStorageInsights.slot}</p>
            )}
        </div>

        {accountStorageInsights?.loading && (
          <p className="meta">Fetching account storage...</p>
        )}

        {accountStorageInsights?.error && (
          <p className="meta error">{accountStorageInsights.error}</p>
        )}

        {Array.isArray(accountStorageInsights?.accounts) &&
          accountStorageInsights.accounts.length > 0 && (
            <section className="clean-section">
              <h3>Related Accounts</h3>
              <div className="decoded-instruction-list">
                {accountStorageInsights.accounts.map((account) => (
                  <article
                    key={account.pubkey}
                    className="decoded-instruction-card"
                  >
                    <p className="meta">{account.pubkey}</p>
                    {!account.found ? (
                      <p className="meta error">
                        Account not found on selected endpoint
                      </p>
                    ) : (
                      <div className="clean-kv-list">
                        <div className="clean-kv-item">
                          <span>owner</span>
                          <strong>{account.owner || "n/a"}</strong>
                        </div>
                        <div className="clean-kv-item">
                          <span>lamports</span>
                          <strong>{statValue(account.lamports)}</strong>
                        </div>
                        <div className="clean-kv-item">
                          <span>space</span>
                          <strong>{statValue(account.space)}</strong>
                        </div>
                        <div className="clean-kv-item">
                          <span>executable</span>
                          <strong>
                            {account.executable ? "true" : "false"}
                          </strong>
                        </div>
                        <div className="clean-kv-item">
                          <span>rentEpoch</span>
                          <strong>{statValue(account.rentEpoch)}</strong>
                        </div>
                        <div className="clean-kv-item">
                          <span>dataEncoding</span>
                          <strong>{statValue(account.dataEncoding)}</strong>
                        </div>
                        <div className="clean-kv-item">
                          <span>dataLength</span>
                          <strong>{statValue(account.dataLength)}</strong>
                        </div>
                        <div className="clean-kv-item">
                          <span>parsedType</span>
                          <strong>{statValue(account.parsedType)}</strong>
                        </div>
                      </div>
                    )}

                    {account.parsedInfo && (
                      <details className="detail-block read-log-block">
                        <summary>Parsed info</summary>
                        <pre>{JSON.stringify(account.parsedInfo, null, 2)}</pre>
                      </details>
                    )}

                    {account.binaryDecoded && (
                      <details open className="detail-block read-log-block">
                        <summary>Decoded binary data</summary>
                        <div className="clean-kv-list">
                          <div className="clean-kv-item">
                            <span>byteLength</span>
                            <strong>{account.binaryDecoded.byteLength}</strong>
                          </div>
                          <div className="clean-kv-item">
                            <span>anchorDiscriminator</span>
                            <strong>
                              {account.binaryDecoded.discriminator || "n/a"}
                            </strong>
                          </div>
                        </div>

                        {Array.isArray(account.binaryDecoded.fields) &&
                          account.binaryDecoded.fields.length > 0 && (
                            <div className="clean-kv-list">
                              {account.binaryDecoded.fields.map((field) => (
                                <div
                                  key={`${account.pubkey}-${field.type}-${field.offset}`}
                                  className="clean-kv-item"
                                >
                                  <span>
                                    {field.label} @ {field.offset}
                                  </span>
                                  <strong>{field.value}</strong>
                                </div>
                              ))}
                            </div>
                          )}

                        <pre>{account.binaryDecoded.hexPreview}</pre>
                      </details>
                    )}
                  </article>
                ))}
              </div>
            </section>
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
        <button
          type="button"
          className={`detail-mode-tab ${viewMode === "accounts" ? "active" : ""}`}
          onClick={() => onChangeViewMode("accounts")}
        >
          Account Storage
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
