import { useEffect, useMemo, useState } from "react";
import {
  buildTraces,
  buildExplorerLinks,
  deepDecode,
  extractSignatureFromTrace,
  getRpcEndpointsForTrace,
  summarizeTraceForCleanUi,
  simplifyParams,
} from "./traceUtils";
import { TraceList } from "./TraceList";
import { TraceDetail } from "./TraceDetail";

const STORAGE_KEY = "rpcEvents";

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
    explorerLinks: null,
    details: null,
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
          explorerLinks: null,
          details: null,
          rawJson: null,
          endpointUsed: "",
        });
        return;
      }

      const signature = extractSignatureFromTrace(selectedTrace);
      const explorerLinks = buildExplorerLinks(signature, selectedTrace);

      setTxInsights({
        loading: false,
        error: "",
        signature,
        explorerLinks,
        details: null,
        rawJson: null,
        endpointUsed: "",
      });

      if (!signature) {
        return;
      }

      setTxInsights((prev) => ({ ...prev, loading: true }));

      const endpointCandidates = getRpcEndpointsForTrace(selectedTrace);
      let lastError = "Transaction details are not available yet.";

      for (const endpoint of endpointCandidates) {
        try {
          const response = await fetch(endpoint, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: `sol-trace-${Date.now()}`,
              method: "getTransaction",
              params: [
                signature,
                { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 },
              ],
            }),
          });

          if (!response.ok) {
            lastError = `getTransaction failed: HTTP ${response.status}`;
            continue;
          }

          const payload = await response.json();
          const details = payload?.result || null;

          if (!active) {
            return;
          }

          if (details) {
            setTxInsights((prev) => ({
              ...prev,
              loading: false,
              details,
              rawJson: payload,
              endpointUsed: endpoint,
              error: "",
            }));
            return;
          }

          lastError = `No transaction found on ${endpoint}`;
        } catch (fetchError) {
          lastError =
            fetchError instanceof Error ? fetchError.message : String(fetchError);
        }
      }

      if (!active) {
        return;
      }

      setTxInsights((prev) => ({
        ...prev,
        loading: false,
        details: null,
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
