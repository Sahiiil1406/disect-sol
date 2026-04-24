import { useEffect, useMemo, useState } from "react";
import {
  buildTraces,
  buildExplorerLinks,
  detectClusterFromTrace,
  deepDecode,
  extractSignatureFromTrace,
  getRpcEndpointsForTrace,
  summarizeTraceForCleanUi,
  simplifyParams,
} from "./traceUtils";
import { TraceList } from "./TraceList";
import { TraceDetail } from "./TraceDetail";

const STORAGE_KEY = "rpcEvents";

const SIGNATURE_METHOD_HINTS = [
  "sendTransaction",
  "signAndSendTransaction",
  "sendAndConfirm",
  "confirmTransaction",
  "getSignatureStatuses",
];

function findRelatedSignature(trace, traces) {
  if (!trace || !Array.isArray(traces) || traces.length === 0) {
    return null;
  }

  const direct = extractSignatureFromTrace(trace);
  if (direct) {
    return {
      signature: direct,
      source: "current-trace",
      sourceMethod: trace.method,
      sourceTraceId: trace.traceId,
      sourceEndpoint: trace.endpoint,
    };
  }

  const baseTime = trace.startedAt || Date.now();
  const nearby = traces
    .filter((candidate) => candidate && candidate.traceId !== trace.traceId)
    .filter((candidate) => {
      const t = candidate.startedAt || 0;
      return Math.abs(t - baseTime) <= 90_000;
    })
    .sort(
      (a, b) =>
        Math.abs((a.startedAt || 0) - baseTime) -
        Math.abs((b.startedAt || 0) - baseTime),
    );

  for (const candidate of nearby) {
    const method = String(candidate.method || "");
    const hasHint = SIGNATURE_METHOD_HINTS.some((hint) => method.includes(hint));
    if (!hasHint) {
      continue;
    }

    const signature = extractSignatureFromTrace(candidate);
    if (signature) {
      return {
        signature,
        source: "related-trace",
        sourceMethod: candidate.method,
        sourceTraceId: candidate.traceId,
        sourceEndpoint: candidate.endpoint,
      };
    }
  }

  return null;
}

export function TracePanel() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedTraceId, setSelectedTraceId] = useState("");
  const [viewMode, setViewMode] = useState("clean");
  const [txInsights, setTxInsights] = useState({
    loading: false,
    error: "",
    signature: null,
    signatureSource: "",
    cluster: "unknown",
    explorerLinks: null,
    details: null,
    status: null,
    rawJson: null,
    endpointUsed: "",
  });

  useEffect(() => {
    const loadFromStorage = () => {
      chrome.storage.local.get(STORAGE_KEY, (result) => {
        if (chrome.runtime.lastError) {
          setError(chrome.runtime.lastError.message);
          setLoading(false);
          return;
        }

        const next = Array.isArray(result?.[STORAGE_KEY])
          ? result[STORAGE_KEY]
          : [];
        setEvents(next);
        setLoading(false);
      });
    };

    chrome.runtime.sendMessage({ type: "GET_RPC_EVENTS" }, (response) => {
      if (chrome.runtime.lastError) {
        loadFromStorage();
        return;
      }

      if (!response?.ok) {
        loadFromStorage();
        return;
      }

      setEvents(Array.isArray(response.events) ? response.events : []);
      setLoading(false);
    });

    const onMessage = (message) => {
      if (message?.type === "RPC_EVENT_ADDED" && message.payload) {
        setEvents((prev) => [message.payload, ...prev].slice(0, 250));
      }

      if (message?.type === "RPC_EVENTS_CLEARED") {
        setEvents([]);
      }
    };

    const onStorageChanged = (changes, areaName) => {
      if (areaName !== "local" || !changes?.[STORAGE_KEY]) {
        return;
      }

      const value = changes[STORAGE_KEY].newValue;
      setEvents(Array.isArray(value) ? value : []);
    };

    chrome.runtime.onMessage.addListener(onMessage);
    chrome.storage.onChanged.addListener(onStorageChanged);

    return () => {
      chrome.runtime.onMessage.removeListener(onMessage);
      chrome.storage.onChanged.removeListener(onStorageChanged);
    };
  }, []);

  const traces = useMemo(() => buildTraces(events), [events]);

  useEffect(() => {
    if (!selectedTraceId && traces.length > 0) {
      setSelectedTraceId(traces[0].traceId);
      return;
    }

    if (
      selectedTraceId &&
      !traces.some((trace) => trace.traceId === selectedTraceId)
    ) {
      setSelectedTraceId(traces[0]?.traceId || "");
    }
  }, [traces, selectedTraceId]);

  const selectedTrace = useMemo(
    () => traces.find((trace) => trace.traceId === selectedTraceId) || null,
    [traces, selectedTraceId],
  );

  const paramSummary = useMemo(
    () => simplifyParams(selectedTrace?.method, selectedTrace?.params),
    [selectedTrace],
  );

  const traceMeta = useMemo(
    () => deepDecode(selectedTrace?.meta || {}),
    [selectedTrace],
  );

  const cleanSummary = useMemo(
    () => summarizeTraceForCleanUi(selectedTrace),
    [selectedTrace],
  );

  useEffect(() => {
    let active = true;

    async function loadTxInsights() {
      if (!selectedTrace) {
        setTxInsights({
          loading: false,
          error: "",
          signature: null,
          signatureSource: "",
          cluster: "unknown",
          explorerLinks: null,
          details: null,
          status: null,
          rawJson: null,
          endpointUsed: "",
        });
        return;
      }

      const signatureInfo = findRelatedSignature(selectedTrace, traces);
      const signature = signatureInfo?.signature || null;
      const explorerLinks = buildExplorerLinks(signature, selectedTrace);
      const cluster = detectClusterFromTrace(selectedTrace);
      const endpointTrace =
        signatureInfo?.source === "related-trace"
          ? traces.find((trace) => trace.traceId === signatureInfo.sourceTraceId) ||
            selectedTrace
          : selectedTrace;
      const endpointCandidates = getRpcEndpointsForTrace(endpointTrace);

      setTxInsights({
        loading: false,
        error: "",
        signature,
        signatureSource:
          signatureInfo?.source === "related-trace"
            ? `Inferred from ${signatureInfo.sourceMethod}`
            : "",
        cluster,
        explorerLinks,
        details: null,
        status: null,
        rawJson: null,
        endpointUsed: endpointCandidates[0] || "",
      });

      if (!signature) {
        setTxInsights((prev) => ({
          ...prev,
          error:
            selectedTrace?.method === "connect"
              ? "Wallet connect does not produce an on-chain transaction"
              : selectedTrace?.method === "signTransaction"
                ? "signTransaction signs locally. Run sendTransaction/signAndSendTransaction to get on-chain status"
                : "No transaction signature found in this trace",
        }));
        return;
      }

      setTxInsights((prev) => ({ ...prev, loading: true }));

      let lastError = "Transaction details are not available yet.";

      for (const endpoint of endpointCandidates) {
        try {
          const txParamAttempts = [
            [
              signature,
              { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 },
            ],
            [signature, { encoding: "jsonParsed" }],
            [signature, { encoding: "json" }],
          ];

          let details = null;
          let detailsPayload = null;

          for (const params of txParamAttempts) {
            const response = await fetch(endpoint, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                jsonrpc: "2.0",
                id: `sol-trace-${Date.now()}`,
                method: "getTransaction",
                params,
              }),
            });

            if (!response.ok) {
              lastError = `getTransaction failed: HTTP ${response.status}`;
              continue;
            }

            const payload = await response.json();
            if (payload?.result) {
              details = payload.result;
              detailsPayload = payload;
              break;
            }
          }

          if (!active) {
            return;
          }

          if (details) {
            setTxInsights((prev) => ({
              ...prev,
              loading: false,
              details,
              status: {
                confirmationStatus: details?.meta?.err ? "failed" : "confirmed",
                err: details?.meta?.err || null,
              },
              rawJson: detailsPayload,
              endpointUsed: endpoint,
              error: "",
            }));
            return;
          }

          const statusResponse = await fetch(endpoint, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: `sol-trace-status-${Date.now()}`,
              method: "getSignatureStatuses",
              params: [[signature], { searchTransactionHistory: true }],
            }),
          });

          if (statusResponse.ok) {
            const statusPayload = await statusResponse.json();
            const status = statusPayload?.result?.value?.[0] || null;
            if (status && active) {
              setTxInsights((prev) => ({
                ...prev,
                loading: false,
                status,
                rawJson: statusPayload,
                endpointUsed: endpoint,
                error: status.err
                  ? "Transaction found with on-chain error"
                  : "Transaction confirmed; detailed payload not yet available",
              }));
              return;
            }
          }

          lastError = `No transaction details found on ${endpoint}`;
        } catch (fetchError) {
          lastError =
            fetchError instanceof Error
              ? fetchError.message
              : String(fetchError);
        }
      }

      if (!active) {
        return;
      }

      setTxInsights((prev) => ({
        ...prev,
        loading: false,
        details: null,
        status: null,
        rawJson: null,
        error: lastError,
      }));
    }

    loadTxInsights();
    return () => {
      active = false;
    };
  }, [selectedTrace]);

  const counts = useMemo(() => {
    const read = events.filter((event) => event.kind === "READ").length;
    const write = events.filter((event) => event.kind === "WRITE").length;
    return { read, write };
  }, [events]);

  const handleClear = () => {
    chrome.runtime.sendMessage({ type: "CLEAR_RPC_EVENTS" });
  };

  return (
    <main className="panel-shell">
      <header className="panel-head">
        <h1>Sol Trace Network</h1>
        <div className="panel-actions">
          <button type="button" className="btn-clear" onClick={handleClear}>
            Clear
          </button>
        </div>
      </header>

      <p className="subtitle">
        Chrome DevTools-like function call list and dissection view
      </p>

      {selectedTrace && (
        <div className="timeline-strip">
          {selectedTrace.timeline.map((step, index) => (
            <div
              key={`${step.phase}-${step.at}-${index}`}
              className="timeline-step"
            >
              <span className="timeline-phase">{step.phase}</span>
              <span className="timeline-kind">{step.kind}</span>
              <span className="timeline-time">
                {new Date(step.at || Date.now()).toLocaleTimeString()}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="stat-row">
        <div className="stat-box">
          <span>READ</span>
          <strong>{counts.read}</strong>
        </div>
        <div className="stat-box">
          <span>WRITE</span>
          <strong>{counts.write}</strong>
        </div>
        <div className="stat-box">
          <span>TOTAL</span>
          <strong>{traces.length}</strong>
        </div>
      </div>

      {loading && <p className="status">Loading events...</p>}
      {error && <p className="status error">{error}</p>}

      {!loading && !error && (
        <div className="workspace">
          <TraceList
            traces={traces}
            selectedTraceId={selectedTraceId}
            onSelect={setSelectedTraceId}
          />
          <TraceDetail
            trace={selectedTrace}
            paramSummary={paramSummary}
            traceMeta={traceMeta}
            viewMode={viewMode}
            onChangeViewMode={setViewMode}
            cleanSummary={cleanSummary}
            txInsights={txInsights}
          />
        </div>
      )}
    </main>
  );
}
