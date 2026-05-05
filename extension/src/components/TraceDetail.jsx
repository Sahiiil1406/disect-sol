import { useMemo, useState } from "react";
import {
  formatLamports,
  shortenAddress,
  getAccountType,
  getAccountBadges,
  formatSol,
  calculateTotalLamports,
  formatAddressForDisplay,
  getAccountRoles,
  parseTransactionError,
  getErrorSeverity,
} from "./traceUtils";
import InstructionTreeViewer from "./InstructionTreeViewer";

function statValue(value) {
  return value === undefined || value === null || value === "" ? "n/a" : value;
}

function copyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text);
  }
}

function sendRuntimeMessage(message) {
  return new Promise((resolve, reject) => {
    if (!chrome?.runtime?.sendMessage) {
      reject(new Error("Extension messaging is not available"));
      return;
    }

    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      resolve(response);
    });
  });
}

function renderAccountAddress(address) {
  return (
    <div className="account-address">
      <code
        className="address-link"
        title={address}
        onClick={() => copyToClipboard(address)}
      >
        {address}
      </code>
      <span className="copy-hint">(click to copy)</span>
    </div>
  );
}

function firstItems(value, max = 8) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.slice(0, max);
}

function collectResultLogs(result) {
  if (!result || !Array.isArray(result.sections)) {
    return [];
  }

  return result.sections
    .flatMap((section) => (Array.isArray(section.logs) ? section.logs : []))
    .filter((entry) => typeof entry === "string" && entry.trim().length > 0);
}

function markNewResultLogs(nextResult, previousResult) {
  if (!nextResult || nextResult.status === "error") {
    return nextResult;
  }

  const previousLogs = new Set(
    collectResultLogs(previousResult).map((entry) => entry.trim()),
  );

  const sections = Array.isArray(nextResult.sections)
    ? nextResult.sections.map((section) => {
        if (!Array.isArray(section.logs)) {
          return section;
        }

        return {
          ...section,
          newLogFlags: section.logs.map((entry) => {
            if (typeof entry !== "string") {
              return false;
            }

            return !previousLogs.has(entry.trim());
          }),
        };
      })
    : [];

  return {
    ...nextResult,
    sections,
  };
}

function countResultLogs(result) {
  return collectResultLogs(result).length;
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

function getTimelinePhaseClass(phase) {
  const normalized = String(phase || "INFO").toLowerCase();
  if (normalized === "before") {
    return "before";
  }

  if (normalized === "after") {
    return "after";
  }

  return "info";
}

function isOnChainTransactionTrace(trace, txInsights) {
  const method = String(trace?.method || "").toLowerCase();
  const requestMethod = String(trace?.meta?.requestMethod || "").toLowerCase();
  const onChainMethodHints = [
    "sendtransaction",
    "signandsendtransaction",
    "sendandconfirm",
    "sendrawtransaction",
  ];

  const hasOnChainMethod = onChainMethodHints.some(
    (hint) => method.includes(hint) || requestMethod.includes(hint),
  );
  const hasCurrentTraceSignature =
    Boolean(txInsights?.signature) &&
    txInsights?.signatureSourceType === "current-trace";

  return Boolean(hasOnChainMethod || hasCurrentTraceSignature);
}

function buildDetailedTimeline(trace) {
  const rawPoints = Array.isArray(trace?.timeline)
    ? [...trace.timeline].sort((a, b) => (a.at || 0) - (b.at || 0))
    : [];

  const seen = new Set();
  const points = rawPoints.filter((point) => {
    const key = `${point?.phase || "INFO"}|${point?.kind || "SYSTEM"}|${
      point?.at || 0
    }`;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });

  if (points.length === 0) {
    const fallbackStart = trace?.startedAt || Date.now();
    const fallbackTotal =
      typeof trace?.durationMs === "number" && trace.durationMs > 0
        ? trace.durationMs
        : 1;

    return {
      startAt: fallbackStart,
      endAt: fallbackStart + fallbackTotal,
      totalMs: fallbackTotal,
      segments: [
        {
          id: "seg-single",
          label: "Execution",
          phase: "INFO",
          kind: trace?.kind || "SYSTEM",
          startAt: fallbackStart,
          endAt: fallbackStart + fallbackTotal,
          durationMs: fallbackTotal,
          leftPct: 0,
          widthPct: 100,
        },
      ],
      markers: [],
    };
  }

  const startAt = trace?.startedAt || points[0]?.at || Date.now();
  const afterPoint = points.find(
    (point) => String(point?.phase || "").toUpperCase() === "AFTER",
  );
  const lastPointAt = points[points.length - 1]?.at || startAt;
  const endAtFromDuration =
    typeof trace?.durationMs === "number" ? startAt + trace.durationMs : null;
  const endAt = Math.max(
    afterPoint?.at || 0,
    endAtFromDuration || 0,
    lastPointAt,
    startAt + 1,
  );
  const totalMs = Math.max(1, endAt - startAt);

  const markers = points.map((point, index) => {
    const at = point?.at || startAt;
    const offsetPct = ((at - startAt) / totalMs) * 100;
    return {
      id: `${point?.phase || "phase"}-${index}`,
      at,
      offsetPct: Math.max(0, Math.min(100, offsetPct)),
      phase: point?.phase || "INFO",
      kind: point?.kind || "SYSTEM",
      statusCode: point?.statusCode,
    };
  });

  const segments = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const pointA = points[index];
    const pointB = points[index + 1];
    const segStart = pointA?.at || startAt;
    const segEnd = Math.max(segStart + 1, pointB?.at || segStart + 1);
    const leftPct = ((segStart - startAt) / totalMs) * 100;
    const widthPct = ((segEnd - segStart) / totalMs) * 100;

    segments.push({
      id: `seg-${index}`,
      label: `${pointA?.phase || "INFO"} -> ${pointB?.phase || "INFO"}`,
      phase: pointB?.phase || pointA?.phase || "INFO",
      kind: pointA?.kind || "SYSTEM",
      startAt: segStart,
      endAt: segEnd,
      durationMs: segEnd - segStart,
      leftPct: Math.max(0, Math.min(100, leftPct)),
      widthPct: Math.max(0.6, Math.min(100, widthPct)),
    });
  }

  if (segments.length === 0) {
    segments.push({
      id: "seg-single",
      label: "Execution",
      phase: points[0]?.phase || "INFO",
      kind: points[0]?.kind || trace?.kind || "SYSTEM",
      startAt,
      endAt,
      durationMs: totalMs,
      leftPct: 0,
      widthPct: 100,
    });
  }

  return {
    startAt,
    endAt,
    totalMs,
    segments,
    markers,
  };
}

function buildLifecycleSteps(trace, txInsights, timelineStartAt) {
  const points = Array.isArray(trace?.timeline)
    ? [...trace.timeline].sort((a, b) => (a.at || 0) - (b.at || 0))
    : [];

  const startedAt = trace?.startedAt || points[0]?.at || timelineStartAt;
  const beforeAt =
    points.find(
      (point) => String(point?.phase || "").toUpperCase() === "BEFORE",
    )?.at || startedAt;
  const afterAt =
    points.find((point) => String(point?.phase || "").toUpperCase() === "AFTER")
      ?.at ||
    (typeof trace?.durationMs === "number"
      ? startedAt + trace.durationMs
      : null);

  const lookupStartedAt = txInsights?.phaseTimestamps?.lookupStartedAt || null;
  const pendingObservedAt =
    txInsights?.phaseTimestamps?.pendingObservedAt || null;
  const confirmedObservedAt =
    txInsights?.phaseTimestamps?.confirmedObservedAt || null;
  const explorerAvailableAt =
    txInsights?.phaseTimestamps?.explorerAvailableAt || null;

  const hasSignature = Boolean(txInsights?.signature);
  const isOnChain = isOnChainTransactionTrace(trace, txInsights);
  const hasConfirmed = typeof confirmedObservedAt === "number";
  const hasExplorer = typeof explorerAvailableAt === "number";
  const hasPending =
    typeof pendingObservedAt === "number" || hasConfirmed || hasExplorer;

  if (!isOnChain) {
    return [];
  }

  const steps = [
    {
      key: "request-started",
      label: "Timer started",
      description: "Dapp initiated transaction request",
      at: startedAt,
      done: true,
    },
    {
      key: "wallet-open",
      label: "Wallet confirmation opened",
      description: "Waiting for you to approve in wallet",
      at: beforeAt,
      done: true,
    },
    {
      key: "wallet-confirmed",
      label: "Wallet confirmed (timer 2 starts)",
      description: "Wallet signed/sent and returned signature",
      at: hasSignature ? afterAt || beforeAt : null,
      done: Boolean(hasSignature && (afterAt || beforeAt)),
    },
    {
      key: "pending",
      label: "Mempool / pending",
      description: "Transaction seen by RPC but not finalized",
      at: hasPending
        ? pendingObservedAt ||
          lookupStartedAt ||
          confirmedObservedAt ||
          explorerAvailableAt
        : null,
      done: hasPending,
    },
    {
      key: "confirmed",
      label: "Confirmed on-chain",
      description: "RPC reported confirmed/finalized",
      at: hasConfirmed ? confirmedObservedAt : null,
      done: hasConfirmed,
    },
    {
      key: "explorer",
      label: "Available on explorer",
      description: "Explorer shows the transaction",
      at: hasExplorer ? explorerAvailableAt : null,
      done: hasExplorer,
    },
  ];

  return steps;
}

function buildLifecycleMarkers(lifecycleSteps, startAt, totalMs) {
  if (!Array.isArray(lifecycleSteps) || lifecycleSteps.length === 0) {
    return [];
  }

  return lifecycleSteps
    .filter((step) => step?.done && typeof step?.at === "number")
    .map((step) => {
      const offsetPct = ((step.at - startAt) / Math.max(1, totalMs)) * 100;
      return {
        id: `lifecycle-${step.key}`,
        key: step.key,
        label: step.label,
        offsetPct: Math.max(0, Math.min(100, offsetPct)),
      };
    });
}

function buildLifecycleSegments(lifecycleSteps, startAt, endAt, totalMs) {
  const stepMap = new Map(lifecycleSteps.map((step) => [step.key, step]));

  const walletOpen = stepMap.get("wallet-open");
  const walletConfirmed = stepMap.get("wallet-confirmed");
  const pending = stepMap.get("pending");
  const confirmed = stepMap.get("confirmed");
  const explorer = stepMap.get("explorer");
  const walletOpenAt =
    typeof walletOpen?.at === "number" ? walletOpen.at : null;
  const walletConfirmedAt =
    typeof walletConfirmed?.at === "number" ? walletConfirmed.at : null;
  const pendingAt = typeof pending?.at === "number" ? pending.at : null;
  const confirmedAt = typeof confirmed?.at === "number" ? confirmed.at : null;
  const explorerAt = typeof explorer?.at === "number" ? explorer.at : null;

  const segments = [];

  function pushSegment(id, label, tone, fromAt, toAt) {
    if (typeof fromAt !== "number" || typeof toAt !== "number") {
      return;
    }

    const start = Math.max(startAt, Math.min(fromAt, toAt));
    const end = Math.max(start + 1, Math.max(fromAt, toAt));
    const leftPct = ((start - startAt) / Math.max(1, totalMs)) * 100;
    const widthPct = ((end - start) / Math.max(1, totalMs)) * 100;
    const minWidthPct = Math.max(3, (140 / Math.max(1, totalMs)) * 100);

    segments.push({
      id,
      label,
      tone,
      leftPct: Math.max(0, Math.min(100, leftPct)),
      widthPct: Math.max(minWidthPct, Math.min(100, widthPct)),
      durationMs: Math.max(1, end - start),
    });
  }

  pushSegment(
    "chain-wallet",
    "Wallet",
    "wallet",
    walletOpenAt,
    walletConfirmedAt,
  );

  pushSegment(
    "chain-pending",
    "Pending",
    "pending",
    pendingAt,
    confirmedAt || explorerAt || endAt,
  );

  pushSegment(
    "chain-confirmed",
    "Confirmed",
    "confirmed",
    confirmedAt,
    explorerAt || endAt,
  );

  pushSegment("chain-explorer", "Explorer", "explorer", explorerAt, endAt);

  return segments;
}

function buildChainRailState(lifecycleSteps) {
  const walletDone = lifecycleSteps.some(
    (step) => step.key === "wallet-confirmed" && step.done,
  );
  const pendingDone = lifecycleSteps.some(
    (step) => step.key === "pending" && step.done,
  );
  const confirmedDone = lifecycleSteps.some(
    (step) => step.key === "confirmed" && step.done,
  );
  const explorerDone = lifecycleSteps.some(
    (step) => step.key === "explorer" && step.done,
  );

  return [
    { key: "wallet", label: "Wallet", tone: "wallet", done: walletDone },
    { key: "pending", label: "Pending", tone: "pending", done: pendingDone },
    {
      key: "confirmed",
      label: "Confirmed",
      tone: "confirmed",
      done: confirmedDone,
    },
    {
      key: "explorer",
      label: "Explorer",
      tone: "explorer",
      done: explorerDone,
    },
  ];
}

function buildScaledTimeline(detailedTimeline, lifecycleSteps) {
  const lifecycleTimes = Array.isArray(lifecycleSteps)
    ? lifecycleSteps
        .filter((step) => typeof step?.at === "number")
        .map((step) => step.at)
    : [];

  const scaleStartAt = Math.min(
    detailedTimeline?.startAt || Date.now(),
    ...lifecycleTimes,
  );
  const scaleEndAt = Math.max(
    detailedTimeline?.endAt || scaleStartAt,
    ...lifecycleTimes,
    scaleStartAt + 1,
  );
  const scaleTotalMs = Math.max(1, scaleEndAt - scaleStartAt);

  const segments = (detailedTimeline?.segments || []).map((segment) => {
    const leftPct = ((segment.startAt - scaleStartAt) / scaleTotalMs) * 100;
    const widthPct = ((segment.endAt - segment.startAt) / scaleTotalMs) * 100;

    return {
      ...segment,
      leftPct: Math.max(0, Math.min(100, leftPct)),
      widthPct: Math.max(0.6, Math.min(100, widthPct)),
    };
  });

  const rawMarkers = (detailedTimeline?.markers || []).map((marker) => {
    const offsetPct = ((marker.at - scaleStartAt) / scaleTotalMs) * 100;
    return {
      ...marker,
      offsetPct: Math.max(0, Math.min(100, offsetPct)),
    };
  });

  const lifecycleMarkers = buildLifecycleMarkers(
    lifecycleSteps,
    scaleStartAt,
    scaleTotalMs,
  );
  const lifecycleSegments = buildLifecycleSegments(
    lifecycleSteps,
    scaleStartAt,
    scaleEndAt,
    scaleTotalMs,
  );

  return {
    startAt: scaleStartAt,
    endAt: scaleEndAt,
    totalMs: scaleTotalMs,
    segments,
    rawMarkers,
    lifecycleMarkers,
    lifecycleSegments,
  };
}

function findStep(steps, key) {
  return steps.find((step) => step?.key === key) || null;
}

function formatPhaseDuration(fromAt, toAt) {
  if (typeof fromAt !== "number" || typeof toAt !== "number") {
    return "n/a";
  }

  return `${Math.max(0, toAt - fromAt)}ms`;
}

function buildCompactStatusLine(lifecycleSteps) {
  const started = findStep(lifecycleSteps, "request-started");
  const walletOpen = findStep(lifecycleSteps, "wallet-open");
  const walletConfirmed = findStep(lifecycleSteps, "wallet-confirmed");
  const pending = findStep(lifecycleSteps, "pending");
  const confirmed = findStep(lifecycleSteps, "confirmed");
  const explorer = findStep(lifecycleSteps, "explorer");

  const phase = explorer?.done
    ? "Explorer"
    : confirmed?.done
      ? "Confirmed"
      : pending?.done
        ? "Pending"
        : walletConfirmed?.done
          ? "Submitted"
          : "Awaiting Wallet";

  return [
    {
      key: "phase",
      label: "Phase",
      value: phase,
      tone: "confirmed",
    },
    {
      key: "wallet-wait",
      label: "Wallet Wait",
      value: formatPhaseDuration(walletOpen?.at, walletConfirmed?.at),
      tone: "wallet",
    },
    {
      key: "to-pending",
      label: "Submit -> Pending",
      value: formatPhaseDuration(walletConfirmed?.at, pending?.at),
      tone: "pending",
    },
    {
      key: "pending-to-confirmed",
      label: "Pending -> Confirmed",
      value: formatPhaseDuration(pending?.at, confirmed?.at),
      tone: "confirmed",
    },
    {
      key: "confirm-to-explorer",
      label: "Confirmed -> Explorer",
      value: formatPhaseDuration(confirmed?.at, explorer?.at),
      tone: "explorer",
    },
    {
      key: "end-to-end",
      label: "End-to-End",
      value: formatPhaseDuration(started?.at, explorer?.at || confirmed?.at),
      tone: "start",
    },
  ];
}

function buildAxisTicks(totalMs, count = 6) {
  const safeCount = Math.max(2, count);
  const safeTotal = Math.max(1, totalMs || 1);
  return Array.from({ length: safeCount }, (_, index) => {
    const ratio = index / (safeCount - 1);
    const atMs = Math.round(safeTotal * ratio);
    return {
      id: `tick-${index}`,
      ratio,
      atMs,
      label: `${atMs}ms`,
    };
  });
}

function getLifecycleTone(stepKey) {
  if (stepKey === "wallet-confirmed") {
    return "wallet";
  }

  if (stepKey === "pending") {
    return "pending";
  }

  if (stepKey === "confirmed") {
    return "confirmed";
  }

  if (stepKey === "explorer") {
    return "explorer";
  }

  return "start";
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
  const [hoveredSegment, setHoveredSegment] = useState(null);
  const [simulationResult, setSimulationResult] = useState(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationType, setSimulationType] = useState(null);
  const detailedTimeline = useMemo(() => buildDetailedTimeline(trace), [trace]);
  const lifecycleSteps = useMemo(
    () => buildLifecycleSteps(trace, txInsights, detailedTimeline.startAt),
    [trace, txInsights, detailedTimeline.startAt],
  );
  const timelineScale = useMemo(
    () => buildScaledTimeline(detailedTimeline, lifecycleSteps),
    [detailedTimeline, lifecycleSteps],
  );
  const axisTicks = useMemo(
    () => buildAxisTicks(timelineScale.totalMs, 5),
    [timelineScale.totalMs],
  );
  const lineSegments = useMemo(() => {
    if (timelineScale.lifecycleSegments.length > 0) {
      return timelineScale.lifecycleSegments.map((segment) => ({
        id: segment.id,
        label: segment.label,
        tone: segment.tone,
        leftPct: segment.leftPct,
        widthPct: segment.widthPct,
        durationMs: segment.durationMs,
      }));
    }

    return timelineScale.segments.map((segment) => ({
      id: segment.id,
      label: segment.label,
      tone: "call",
      leftPct: segment.leftPct,
      widthPct: segment.widthPct,
      durationMs: segment.durationMs,
    }));
  }, [timelineScale]);
  const simulationLogCount = useMemo(
    () => countResultLogs(simulationResult),
    [simulationResult],
  );
  const isOnChainTimeline = useMemo(
    () => isOnChainTransactionTrace(trace, txInsights),
    [trace, txInsights],
  );

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

  if (viewMode === "timeline") {
    return (
      <section className="detail-panel">
        <div
          className="detail-mode-tabs"
          role="tablist"
          aria-label="Detail mode"
        >
          <button
            type="button"
            className={`detail-mode-tab ${viewMode === "timeline" ? "active" : ""}`}
            onClick={() => onChangeViewMode("timeline")}
          >
            Timeline
          </button>
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
          <button
            type="button"
            className={`detail-mode-tab ${viewMode === "instructions" ? "active" : ""}`}
            onClick={() => onChangeViewMode("instructions")}
          >
            Instructions
          </button>
          <button
            type="button"
            className={`detail-mode-tab ${viewMode === "replay" ? "active" : ""}`}
            onClick={() => onChangeViewMode("replay")}
          >
            Replay
          </button>
        </div>

        <div className="clean-hero">
          <h2>Detailed Timeline</h2>
          <p className="clean-subtitle">{trace?.method || "unknown method"}</p>
          <p className="meta">
            {isOnChainTimeline
              ? `Total duration: ${timelineScale.totalMs}ms`
              : "Lifecycle timer is only for on-chain transaction calls"}
          </p>
        </div>

        {isOnChainTimeline ? (
          <section className="timeline-gantt-panel">
            <div className="timeline-legend">
              <span className="timeline-legend-item wallet">Wallet</span>
              <span className="timeline-legend-item pending">Pending</span>
              <span className="timeline-legend-item confirmed">Confirmed</span>
              <span className="timeline-legend-item explorer">Explorer</span>
            </div>

            <div className="timeline-axis">
              {axisTicks.map((tick) => (
                <span
                  key={tick.id}
                  style={{ left: `${tick.ratio * 100}%` }}
                  className="timeline-axis-tick"
                >
                  {tick.label}
                </span>
              ))}
            </div>

            <div className="timeline-minimal-wrap">
              <div className="timeline-minimal-track">
                {axisTicks.map((tick) => (
                  <div
                    key={`minimal-grid-${tick.id}`}
                    className="timeline-grid-line"
                    style={{ left: `${tick.ratio * 100}%` }}
                  />
                ))}

                {lineSegments.map((segment) => (
                  <div
                    key={segment.id}
                    className={`timeline-minimal-segment tone-${segment.tone}`}
                    style={{
                      left: `${segment.leftPct}%`,
                      width: `${segment.widthPct}%`,
                    }}
                    title={`${segment.label}: ${segment.durationMs}ms`}
                    onMouseEnter={() => setHoveredSegment(segment)}
                    onMouseLeave={() => setHoveredSegment(null)}
                  >
                    <span>{segment.label}</span>
                  </div>
                ))}
              </div>

              <div className="timeline-hover-details">
                {hoveredSegment ? (
                  <p className="meta">
                    {hoveredSegment.label}: {hoveredSegment.durationMs}ms
                  </p>
                ) : (
                  <p className="meta">Hover a segment to see details.</p>
                )}
              </div>
            </div>

            <div className="timeline-lifecycle-list">
              <h3 className="timeline-log-heading">Timeline Logs</h3>
              {lifecycleSteps.length === 0 ? (
                <p className="meta">No lifecycle logs captured yet.</p>
              ) : (
                lifecycleSteps.map((step) => (
                  <article
                    key={step.key}
                    className={`timeline-lifecycle-item tone-${getLifecycleTone(
                      step.key,
                    )}`}
                  >
                    <div className="timeline-lifecycle-head">
                      <strong>{step.label}</strong>
                      <span
                        className={`timeline-lifecycle-status ${
                          step.done ? "done" : "waiting"
                        }`}
                      >
                        {step.done ? "done" : "waiting"}
                      </span>
                    </div>
                    <p className="meta">{step.description}</p>
                    <p className="meta">
                      {typeof step.at === "number"
                        ? `+${Math.max(0, step.at - timelineScale.startAt)}ms`
                        : "pending"}
                    </p>
                  </article>
                ))
              )}
            </div>
          </section>
        ) : (
          <section className="timeline-gantt-panel">
            <p className="meta">
              Select a log created by an on-chain send flow (for example
              sendTransaction or signAndSendTransaction) to analyze lifecycle
              timers.
            </p>
          </section>
        )}
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
            className={`detail-mode-tab ${viewMode === "timeline" ? "active" : ""}`}
            onClick={() => onChangeViewMode("timeline")}
          >
            Timeline
          </button>
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
          <button
            type="button"
            className={`detail-mode-tab ${viewMode === "instructions" ? "active" : ""}`}
            onClick={() => onChangeViewMode("instructions")}
          >
            Instructions
          </button>
          <button
            type="button"
            className={`detail-mode-tab ${viewMode === "replay" ? "active" : ""}`}
            onClick={() => onChangeViewMode("replay")}
          >
            Replay
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
            className={`detail-mode-tab ${viewMode === "timeline" ? "active" : ""}`}
            onClick={() => onChangeViewMode("timeline")}
          >
            Timeline
          </button>
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
          <button
            type="button"
            className={`detail-mode-tab ${viewMode === "instructions" ? "active" : ""}`}
            onClick={() => onChangeViewMode("instructions")}
          >
            Instructions
          </button>
          <button
            type="button"
            className={`detail-mode-tab ${viewMode === "replay" ? "active" : ""}`}
            onClick={() => onChangeViewMode("replay")}
          >
            Replay
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
              <div className="accounts-summary">
                <div className="summary-stat">
                  <span className="stat-label">Total Accounts</span>
                  <span className="stat-value">
                    {accountStorageInsights.accounts.length}
                  </span>
                </div>
                <div className="summary-stat">
                  <span className="stat-label">Total Balance</span>
                  <span className="stat-value">
                    {formatSol(
                      calculateTotalLamports(accountStorageInsights.accounts),
                    )}
                  </span>
                </div>
                <div className="summary-stat">
                  <span className="stat-label">Programs</span>
                  <span className="stat-value">
                    {
                      accountStorageInsights.accounts.filter(
                        (a) => a.executable,
                      ).length
                    }
                  </span>
                </div>
              </div>

              <h3>Related Accounts</h3>
              <div className="accounts-grid">
                {accountStorageInsights.accounts.map((account) => (
                  <article key={account.pubkey} className="account-card">
                    <div className="account-header">
                      <div className="account-info">
                        <h4 className="account-type">
                          {getAccountType(account)}
                        </h4>
                        {renderAccountAddress(account.pubkey)}
                      </div>
                      <div className="account-badges">
                        {getAccountBadges(account).map((badge) => (
                          <span
                            key={`${account.pubkey}-${badge.type}`}
                            className={`badge badge-${badge.type}`}
                          >
                            {badge.label}
                          </span>
                        ))}
                        {getAccountRoles(
                          account,
                          txInsights?.details?.transaction?.message,
                          txInsights?.details?.transaction?.message
                            ?.accountKeys,
                        ).map((role) => (
                          <span
                            key={`${account.pubkey}-role-${role.type}`}
                            className={`badge badge-role badge-role-${role.type}`}
                          >
                            {role.label}
                          </span>
                        ))}
                      </div>
                    </div>

                    {!account.found ? (
                      <p className="meta error">
                        Account not found on selected endpoint
                      </p>
                    ) : (
                      <>
                        <div className="account-properties">
                          <h5 className="properties-title">Account Details</h5>
                          <div className="properties-group">
                            <div className="property-row">
                              <span className="property-label">Balance</span>
                              <span className="property-value">
                                {formatSol(account.lamports)}
                              </span>
                            </div>
                            <div className="property-row">
                              <span className="property-label">Owner</span>
                              <code className="property-value address-mini">
                                {shortenAddress(account.owner)}
                              </code>
                            </div>
                            <div className="property-row">
                              <span className="property-label">Storage</span>
                              <span className="property-value">
                                {account.space || 0} bytes
                              </span>
                            </div>
                          </div>

                          {account.rentEpoch !== null &&
                            account.rentEpoch !== undefined && (
                              <div className="property-row">
                                <span className="property-label">
                                  Rent Epoch
                                </span>
                                <span className="property-value">
                                  {account.rentEpoch}
                                </span>
                              </div>
                            )}
                        </div>

                        {account.parsedType && (
                          <div className="account-metadata">
                            <h5 className="metadata-title">Type Info</h5>
                            <p className="metadata-value">
                              {account.parsedType}
                            </p>
                            {account.dataEncoding && (
                              <p className="metadata-secondary">
                                Encoding: {account.dataEncoding}
                              </p>
                            )}
                          </div>
                        )}
                      </>
                    )}

                    {account.parsedInfo && (
                      <details className="detail-block read-log-block">
                        <summary>📋 Parsed Info</summary>
                        <pre className="json-preview">
                          {JSON.stringify(account.parsedInfo, null, 2)}
                        </pre>
                      </details>
                    )}

                    {account.binaryDecoded && (
                      <details open className="detail-block read-log-block">
                        <summary>🔍 Decoded Binary Data</summary>
                        <div className="binary-section">
                          <div className="binary-metadata">
                            <span className="meta-item">
                              <strong>Size:</strong>{" "}
                              {account.binaryDecoded.byteLength} bytes
                            </span>
                            {account.binaryDecoded.discriminator && (
                              <span className="meta-item">
                                <strong>Discriminator:</strong>{" "}
                                {account.binaryDecoded.discriminator}
                              </span>
                            )}
                          </div>

                          {Array.isArray(account.binaryDecoded.fields) &&
                            account.binaryDecoded.fields.length > 0 && (
                              <div className="decoded-fields">
                                <h6>Decoded Fields</h6>
                                <div className="fields-list">
                                  {account.binaryDecoded.fields.map((field) => (
                                    <div
                                      key={`${account.pubkey}-${field.type}-${field.offset}`}
                                      className="field-item"
                                    >
                                      <div className="field-header">
                                        <span className="field-name">
                                          {field.label}
                                        </span>
                                        <span className="field-offset">
                                          @ {field.offset}
                                        </span>
                                      </div>
                                      <code className="field-value">
                                        {field.value}
                                      </code>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                          <details className="hex-preview-block">
                            <summary>Hex Preview</summary>
                            <pre className="hex-code">
                              {account.binaryDecoded.hexPreview}
                            </pre>
                          </details>
                        </div>
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

  if (viewMode === "instructions") {
    const parsedErr = trace?.error ? parseTransactionError(trace.error) : null;
    const txErr = txInsights?.details?.meta?.err
      ? parseTransactionError(txInsights.details.meta.err)
      : null;
    const mainError = parsedErr || txErr;
    const errorSeverity = mainError ? getErrorSeverity(mainError.raw) : null;

    return (
      <section className="detail-panel">
        <div
          className="detail-mode-tabs"
          role="tablist"
          aria-label="Detail mode"
        >
          <button
            type="button"
            className={`detail-mode-tab ${viewMode === "timeline" ? "active" : ""}`}
            onClick={() => onChangeViewMode("timeline")}
          >
            Timeline
          </button>
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
          <button
            type="button"
            className={`detail-mode-tab ${viewMode === "instructions" ? "active" : ""}`}
            onClick={() => onChangeViewMode("instructions")}
          >
            Instructions
          </button>
          <button
            type="button"
            className={`detail-mode-tab ${viewMode === "replay" ? "active" : ""}`}
            onClick={() => onChangeViewMode("replay")}
          >
            Replay
          </button>
        </div>

        <div className="clean-hero">
          <h2>🔍 Instructions & Errors</h2>
          <p className="clean-subtitle">
            Detailed instruction breakdown with human-readable explanations
          </p>
        </div>

        {mainError && (
          <section className="error-display-section">
            <div
              className={`error-card error-${errorSeverity?.color || "error"}`}
            >
              <div className="error-header">
                <span className="error-icon">⚠️</span>
                <h3 className="error-title">Transaction Error</h3>
                <span
                  className={`error-severity error-severity-${errorSeverity?.level || "error"}`}
                >
                  {errorSeverity?.level?.toUpperCase() || "ERROR"}
                </span>
              </div>

              <div className="error-content">
                <div className="error-section">
                  <h4 className="error-subsection-title">📋 What Went Wrong</h4>
                  <p className="error-message">{mainError.human}</p>
                </div>

                {mainError.details && (
                  <div className="error-section">
                    <h4 className="error-subsection-title">🔧 Error Details</h4>
                    <div className="error-details-grid">
                      {Object.entries(mainError.details).map(([key, value]) => (
                        <div key={key} className="error-detail-item">
                          <span className="detail-key">{key}</span>
                          <span className="detail-value">
                            {typeof value === "object"
                              ? JSON.stringify(value)
                              : String(value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <details className="error-raw-section">
                  <summary>💻 Raw Error Data</summary>
                  <pre className="error-raw-data">
                    {JSON.stringify(mainError.raw, null, 2)}
                  </pre>
                </details>
              </div>
            </div>
          </section>
        )}

        {Array.isArray(cleanSummary?.instructions) &&
          cleanSummary.instructions.length > 0 && (
            <section className="clean-section">
              <h3>📜 Instructions Breakdown</h3>
              <p className="section-subtitle">
                All {cleanSummary.instructions.length} instructions in this
                transaction with decoded parameters
              </p>
              <InstructionTreeViewer instructions={cleanSummary.instructions} />
            </section>
          )}

        {(!Array.isArray(cleanSummary?.instructions) ||
          cleanSummary.instructions.length === 0) &&
          !mainError && (
            <p className="meta">No instructions or errors to display</p>
          )}
      </section>
    );
  }

  if (viewMode === "replay") {
    const handleMockSimulation = async () => {
      setIsSimulating(true);
      setSimulationType("mock");
      try {
        const { formatSimulationResults } = await import("./traceUtils");
        const bridgeResponse = await sendRuntimeMessage({
          type: "SOL_TRACE_REPLAY_COMMAND",
          payload: {
            mode: "mock",
            rpcEndpoint: metrics.endpointUsed,
            signature: txInsights?.signature || metrics.signature,
            txDetails: txInsights?.details || null,
          },
        });
        const result = bridgeResponse?.ok
          ? { success: true, data: bridgeResponse.result }
          : { success: false, error: bridgeResponse?.error || "Mock replay failed" };
        const formatted = formatSimulationResults(result);
        setSimulationResult((previous) => markNewResultLogs(formatted, previous));
      } catch (err) {
        setSimulationResult({
          status: "error",
          message: "Failed to perform simulation: " + err.message,
        });
      } finally {
        setIsSimulating(false);
      }
    };

    const handleRealTransaction = async () => {
      setIsSimulating(true);
      setSimulationType("real");
      try {
        const { formatSimulationResults } = await import("./traceUtils");
        const bridgeResponse = await sendRuntimeMessage({
          type: "SOL_TRACE_REPLAY_COMMAND",
          payload: {
            mode: "real",
            rpcEndpoint: metrics.endpointUsed,
            signature: txInsights?.signature || metrics.signature,
            txDetails: txInsights?.details || null,
          },
        });
        const result = bridgeResponse?.ok
          ? { success: true, data: bridgeResponse.result }
          : { success: false, error: bridgeResponse?.error || "On-chain replay failed" };
        const formatted = formatSimulationResults(result);
        setSimulationResult((previous) => markNewResultLogs(formatted, previous));
      } catch (err) {
        setSimulationResult({
          status: "error",
          message: "Failed to retrieve transaction details: " + err.message,
        });
      } finally {
        setIsSimulating(false);
      }
    };

    return (
      <section className="detail-panel">
        <div
          className="detail-mode-tabs"
          role="tablist"
          aria-label="Detail mode"
        >
          <button
            type="button"
            className={`detail-mode-tab ${viewMode === "timeline" ? "active" : ""}`}
            onClick={() => onChangeViewMode("timeline")}
          >
            Timeline
          </button>
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
          <button
            type="button"
            className={`detail-mode-tab ${viewMode === "instructions" ? "active" : ""}`}
            onClick={() => onChangeViewMode("instructions")}
          >
            Instructions
          </button>
          <button
            type="button"
            className={`detail-mode-tab ${viewMode === "replay" ? "active" : ""}`}
            onClick={() => onChangeViewMode("replay")}
          >
            Replay
          </button>
        </div>

        <div className="clean-hero">
          <h2>🔄 Replay & Simulate</h2>
          <p className="clean-subtitle">
            Wallet-confirmed mock simulation and live on-chain replay
          </p>
          <p className="meta">
            Signature:{" "}
            <code className="address-link" title={metrics.signature}>
              {metrics.signature
                ? metrics.signature.substring(0, 20) + "..."
                : "n/a"}
            </code>
          </p>
        </div>

        <section className="replay-controls">
          <div className="replay-button-group">
            <button
              className="replay-button replay-button-mock"
              onClick={handleMockSimulation}
              disabled={isSimulating}
            >
              {isSimulating && simulationType === "mock"
                ? "⏳ Waiting for wallet..."
                : "🧪 Mock Simulation"}
            </button>
            <p className="replay-button-hint">
              Sign the transaction in your wallet, then simulate it locally
              without broadcasting to chain
            </p>
          </div>

          <div className="replay-button-group">
            <button
              className="replay-button replay-button-real"
              onClick={handleRealTransaction}
              disabled={isSimulating}
            >
              {isSimulating && simulationType === "real"
                ? "⏳ Waiting for wallet..."
                : "🚀 Replay On-chain"}
            </button>
            <p className="replay-button-hint">
              Ask your wallet to confirm the transaction and broadcast it on
              chain
            </p>
          </div>

          {simulationResult && (
            <div
              className={`replay-inline-result ${
                simulationResult.status === "error"
                  ? "replay-inline-result-error"
                  : "replay-inline-result-success"
              }`}
            >
              {simulationResult.status === "error" ? (
                <p className="replay-inline-result-text">
                  Latest result: {simulationResult.message}
                </p>
              ) : (
                <p className="replay-inline-result-text">
                  Latest result shown below. Captured logs: {simulationLogCount}
                </p>
              )}
            </div>
          )}
        </section>

        {simulationResult && (
          <section className="simulation-results">
            {simulationResult.status === "error" ? (
              <div className="error-card error-error">
                <div className="error-header">
                  <span className="error-icon">⚠️</span>
                  <h3 className="error-title">Simulation Error</h3>
                </div>
                <p className="error-message">{simulationResult.message}</p>
              </div>
            ) : (
              <>
                {simulationResult.sections &&
                  simulationResult.sections.map((section, idx) => (
                    <div key={idx} className="simulation-section">
                      <h3 className="simulation-section-title">
                        {section.title}
                      </h3>

                      {section.items && (
                        <div className="simulation-metrics">
                          {section.items.map((item, iIdx) => (
                            <div key={iIdx} className="metric-pair">
                              <span className="metric-label">{item.label}</span>
                              <span className="metric-value">
                                {item.value}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {section.logs && (
                        <div className="simulation-logs">
                          {section.logs.map((log, lIdx) => (
                            <div
                              key={lIdx}
                              className={`log-entry ${section.newLogFlags?.[lIdx] ? "log-entry-new" : ""}`}
                            >
                              <code>{log}</code>
                            </div>
                          ))}
                        </div>
                      )}

                      {section.changes && (
                        <div className="state-changes-list">
                          {section.changes.map((change, cIdx) => (
                            <div key={cIdx} className="state-change-item">
                              <div className="change-account">
                                <strong>{change.kind === "token" ? "Token Account:" : "Account:"}</strong>
                                <code className="address-code">
                                  {shortenAddress(change.account)}
                                </code>
                                {change.label && (
                                  <span className="change-label">{change.label}</span>
                                )}
                              </div>
                              <div className="change-balances">
                                <span className="balance-before">
                                  Before: {change.beforeValue || "n/a"}
                                </span>
                                <span className="balance-arrow">→</span>
                                <span className="balance-after">
                                  After: {change.afterValue || "n/a"}
                                </span>
                              </div>
                              {typeof change.delta === "number" && (
                                <div
                                  className={`balance-delta ${change.delta > 0 ? "positive" : "negative"}`}
                                >
                                  {change.delta > 0 ? "+" : ""}
                                  {formatLamports(change.delta)}
                                </div>
                              )}
                              {change.mint && (
                                <div className="change-meta-line">
                                  <span className="change-meta-key">Mint:</span>
                                  <code className="change-meta-value">
                                    {change.mint}
                                  </code>
                                </div>
                              )}
                              {typeof change.accountIndex === "number" && (
                                <div className="change-meta-line">
                                  <span className="change-meta-key">Account Index:</span>
                                  <span className="change-meta-value">
                                    {change.accountIndex}
                                  </span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {section.error && (
                        <pre className="error-raw-data">
                          {JSON.stringify(section.error, null, 2)}
                        </pre>
                      )}
                    </div>
                  ))}
              </>
            )}
          </section>
        )}

        {!simulationResult && (
          <div className="replay-empty-state">
            <p className="meta">
              Click a button above to simulate or fetch transaction details
            </p>
          </div>
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
          className={`detail-mode-tab ${viewMode === "timeline" ? "active" : ""}`}
          onClick={() => onChangeViewMode("timeline")}
        >
          Timeline
        </button>
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
        <button
          type="button"
          className={`detail-mode-tab ${viewMode === "instructions" ? "active" : ""}`}
          onClick={() => onChangeViewMode("instructions")}
        >
          Instructions
        </button>
        <button
          type="button"
          className={`detail-mode-tab ${viewMode === "replay" ? "active" : ""}`}
          onClick={() => onChangeViewMode("replay")}
        >
          Replay
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
