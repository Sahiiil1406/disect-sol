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

function isLikelyAddress(value) {
  return (
    typeof value === "string" && /^[1-9A-HJ-NP-Za-km-z]{32,88}$/.test(value)
  );
}

function decodeBase64ToBytes(value) {
  if (typeof value !== "string") {
    return null;
  }

  try {
    const raw = atob(value);
    return Uint8Array.from(raw, (char) => char.charCodeAt(0));
  } catch {
    return null;
  }
}

function bytesToHex(bytes, max = 64) {
  if (!(bytes instanceof Uint8Array)) {
    return "";
  }

  const out = [];
  for (let i = 0; i < Math.min(bytes.length, max); i += 1) {
    out.push(bytes[i].toString(16).padStart(2, "0"));
  }

  return out.join(" ");
}

function bytesToAsciiPreview(bytes, max = 96) {
  if (!(bytes instanceof Uint8Array)) {
    return "";
  }

  return Array.from(bytes.slice(0, max))
    .map((byte) =>
      byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : ".",
    )
    .join("");
}

function readU64LE(bytes, offset = 0) {
  if (!(bytes instanceof Uint8Array) || bytes.length < offset + 8) {
    return null;
  }

  try {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return view.getBigUint64(offset, true);
  } catch {
    return null;
  }
}

function readU32LE(bytes, offset = 0) {
  if (!(bytes instanceof Uint8Array) || bytes.length < offset + 4) {
    return null;
  }

  return (
    (bytes[offset] |
      (bytes[offset + 1] << 8) |
      (bytes[offset + 2] << 16) |
      (bytes[offset + 3] << 24)) >>>
    0
  );
}

function parseBinaryAccountData(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length === 0) {
    return null;
  }

  const fields = [];
  const discriminator =
    bytes.length >= 8
      ? bytesToHex(bytes.slice(0, 8), 8).replace(/ /g, "")
      : null;

  const bodyOffset = discriminator ? 8 : 0;
  const body = bytes.slice(bodyOffset);

  for (
    let offset = 0;
    offset + 8 <= body.length && fields.length < 8;
    offset += 8
  ) {
    const value = readU64LE(body, offset);
    if (value === null) {
      continue;
    }

    const label =
      offset === 0
        ? "u64_0 (often counter/amount)"
        : `u64_${Math.floor(offset / 8)}`;
    fields.push({
      type: "u64",
      label,
      offset: bodyOffset + offset,
      value: value.toString(),
    });
  }

  for (
    let offset = 0;
    offset + 4 <= body.length && fields.length < 12;
    offset += 4
  ) {
    const value = readU32LE(body, offset);
    if (value === null) {
      continue;
    }

    fields.push({
      type: "u32",
      label: `u32_${Math.floor(offset / 4)}`,
      offset: bodyOffset + offset,
      value: String(value),
    });
  }

  return {
    byteLength: bytes.length,
    discriminator,
    hexPreview: bytesToHex(bytes, 64),
    asciiPreview: bytesToAsciiPreview(bytes, 96),
    fields,
  };
}

function pickCandidateAccounts(selectedTrace, cleanSummary, txInsights) {
  const unique = new Set();

  const addAddress = (value) => {
    if (typeof value === "string" && isLikelyAddress(value)) {
      unique.add(value);
    }
  };

  const detailsAccountKeys =
    txInsights?.details?.transaction?.message?.accountKeys;
  if (Array.isArray(detailsAccountKeys)) {
    for (const key of detailsAccountKeys) {
      if (typeof key === "string") {
        addAddress(key);
        continue;
      }

      if (key && typeof key === "object") {
        addAddress(key.pubkey);
      }
    }
  }

  if (Array.isArray(cleanSummary?.accounts)) {
    for (const account of cleanSummary.accounts) {
      addAddress(account?.label);
    }
  }

  const params = selectedTrace?.params;
  if (Array.isArray(params)) {
    for (const param of params.slice(0, 8)) {
      addAddress(typeof param === "string" ? param : param?.pubkey);
    }
  }

  return [...unique].slice(0, 20);
}

function summarizeFetchedAccount(pubkey, account) {
  if (!account) {
    return {
      pubkey,
      found: false,
    };
  }

  const data = account?.data;
  const parsed =
    data && typeof data === "object" && !Array.isArray(data)
      ? data.parsed
      : null;

  let dataEncoding = null;
  let dataLength = null;
  let rawBytes = null;
  if (Array.isArray(data)) {
    dataEncoding = typeof data[1] === "string" ? data[1] : "unknown";
    if (typeof data[0] === "string") {
      if (dataEncoding === "base64") {
        rawBytes = decodeBase64ToBytes(data[0]);
      }

      dataLength = rawBytes?.length ?? data[0].length;
    }
  } else if (typeof data === "string") {
    dataEncoding = "string";
    rawBytes = decodeBase64ToBytes(data);
    dataLength = rawBytes?.length ?? data.length;
  } else if (parsed) {
    dataEncoding = "jsonParsed";
  }

  const binaryDecoded = parseBinaryAccountData(rawBytes);

  return {
    pubkey,
    found: true,
    lamports: typeof account.lamports === "number" ? account.lamports : null,
    owner: account.owner || null,
    executable: Boolean(account.executable),
    rentEpoch: account.rentEpoch ?? null,
    space: typeof account.space === "number" ? account.space : null,
    dataEncoding,
    dataLength,
    parsedType: parsed?.type || null,
    parsedInfo: parsed?.info || null,
    binaryDecoded,
  };
}

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
    const hasHint = SIGNATURE_METHOD_HINTS.some((hint) =>
      method.includes(hint),
    );
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
  const [accountStorageInsights, setAccountStorageInsights] = useState({
    loading: false,
    error: "",
    endpointUsed: "",
    accounts: [],
    slot: null,
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
          ? traces.find(
              (trace) => trace.traceId === signatureInfo.sourceTraceId,
            ) || selectedTrace
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

  useEffect(() => {
    let active = true;

    async function loadAccountStorageInsights() {
      if (!selectedTrace) {
        setAccountStorageInsights({
          loading: false,
          error: "",
          endpointUsed: "",
          accounts: [],
          slot: null,
        });
        return;
      }

      const candidateAccounts = pickCandidateAccounts(
        selectedTrace,
        cleanSummary,
        txInsights,
      );

      if (candidateAccounts.length === 0) {
        setAccountStorageInsights({
          loading: false,
          error: "No related accounts found for this transaction",
          endpointUsed: "",
          accounts: [],
          slot: null,
        });
        return;
      }

      const endpointCandidates = getRpcEndpointsForTrace(selectedTrace);

      setAccountStorageInsights((prev) => ({
        ...prev,
        loading: true,
        error: "",
        endpointUsed: endpointCandidates[0] || "",
      }));

      let lastError = "Unable to fetch account storage";

      for (const endpoint of endpointCandidates) {
        try {
          const response = await fetch(endpoint, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: `sol-account-storage-${Date.now()}`,
              method: "getMultipleAccounts",
              params: [candidateAccounts, { encoding: "jsonParsed" }],
            }),
          });

          if (!response.ok) {
            lastError = `getMultipleAccounts failed: HTTP ${response.status}`;
            continue;
          }

          const payload = await response.json();
          const value = Array.isArray(payload?.result?.value)
            ? payload.result.value
            : null;

          if (!value) {
            lastError =
              payload?.error?.message || "No account payload returned";
            continue;
          }

          if (!active) {
            return;
          }

          const accounts = candidateAccounts.map((pubkey, index) =>
            summarizeFetchedAccount(pubkey, value[index]),
          );

          setAccountStorageInsights({
            loading: false,
            error: "",
            endpointUsed: endpoint,
            accounts,
            slot: payload?.result?.context?.slot ?? null,
          });
          return;
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

      setAccountStorageInsights({
        loading: false,
        error: lastError,
        endpointUsed: endpointCandidates[0] || "",
        accounts: [],
        slot: null,
      });
    }

    loadAccountStorageInsights();

    return () => {
      active = false;
    };
  }, [selectedTrace, cleanSummary, txInsights]);

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
            accountStorageInsights={accountStorageInsights}
          />
        </div>
      )}
    </main>
  );
}
