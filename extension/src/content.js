const BRIDGE_MESSAGE_TYPE = "__DEVTOOLS_SOLANA_BRIDGE_MESSAGE__";
const BRIDGE_SOURCE = "sol-trace-inpage";
const REPLAY_COMMAND = "SOL_TRACE_REPLAY_COMMAND";
const REPLAY_RESPONSE = "SOL_TRACE_REPLAY_RESPONSE";
const STORAGE_KEY = "rpcEvents";
const MAX_EVENTS = 250;
let lastForwardedKey = null;
const pendingReplayRequests = new Map();

function createStampedEvent(payload) {
  return {
    id: payload?.id || crypto.randomUUID(),
    timestamp: payload?.timestamp || Date.now(),
    ...payload,
  };
}

async function appendEventDirectly(payload) {
  const stamped = createStampedEvent(payload);
  const current = await chrome.storage.local.get(STORAGE_KEY);
  const existing = Array.isArray(current?.[STORAGE_KEY])
    ? current[STORAGE_KEY]
    : [];
  const next = [stamped, ...existing].slice(0, MAX_EVENTS);
  await chrome.storage.local.set({ [STORAGE_KEY]: next });

  try {
    await chrome.runtime.sendMessage({
      type: "RPC_EVENT_ADDED",
      payload: stamped,
    });
  } catch {
    // UI might not be open.
  }
}

function sendRpcEvent(payload) {
  chrome.runtime.sendMessage({ type: "RPC_EVENT", payload }, (response) => {
    if (chrome.runtime.lastError || !response?.ok) {
      appendEventDirectly(payload).catch(() => {
        // Ignore fallback storage errors.
      });
    }
  });
}

function injectInpageScript() {
  try {
    const existing = document.documentElement?.dataset?.solTraceInpage;
    if (existing === "1") {
      return;
    }

    const script = document.createElement("script");
    script.src = chrome.runtime.getURL("assets/inpage.js");
    script.async = false;
    script.dataset.solTraceInpage = "1";
    script.onload = () => {
      script.remove();
    };

    (document.head || document.documentElement).appendChild(script);
    if (document.documentElement) {
      document.documentElement.dataset.solTraceInpage = "1";
    }
  } catch {
    // Ignore injection errors; bridge diagnostics are still sent below.
  }
}

function toForwardKey(detail) {
  if (!detail || typeof detail !== "object") {
    return null;
  }

  return [
    detail.kind || "",
    detail.phase || "",
    detail.method || "",
    detail.callId || "",
    detail.at || "",
    detail.url || "",
  ].join("|");
}

function forwardBridgeDetail(detail) {
  if (!detail || typeof detail !== "object") {
    return;
  }

  const key = toForwardKey(detail);
  if (key && key === lastForwardedKey) {
    return;
  }

  lastForwardedKey = key;
  sendRpcEvent(detail);
}

function postReplayCommandToPage(payload) {
  window.postMessage(
    {
      type: BRIDGE_MESSAGE_TYPE,
      source: BRIDGE_SOURCE,
      payload: {
        kind: REPLAY_COMMAND,
        requestId: payload.requestId,
        command: payload.command,
      },
    },
    "*",
  );
}

injectInpageScript();

window.addEventListener("message", (event) => {
  if (event.source !== window) {
    return;
  }

  const data = event?.data;
  if (
    !data ||
    data.type !== BRIDGE_MESSAGE_TYPE ||
    (data.source && data.source !== BRIDGE_SOURCE)
  ) {
    return;
  }

  if (data?.payload?.kind === REPLAY_RESPONSE) {
    const pending = pendingReplayRequests.get(data.payload.requestId);
    if (pending) {
      pendingReplayRequests.delete(data.payload.requestId);
      pending(data.payload);
    }
    return;
  }

  forwardBridgeDetail(data.payload);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "SOL_TRACE_REPLAY_COMMAND") {
    return;
  }

  const requestId = crypto.randomUUID();
  pendingReplayRequests.set(requestId, (payload) => {
    sendResponse({
      ok: payload.ok,
      result: payload.result,
      error: payload.error,
    });
  });

  postReplayCommandToPage({
    requestId,
    command: message.payload,
  });

  return true;
});

sendRpcEvent({
  kind: "SYSTEM",
  phase: "INFO",
  method: "contentBridgeReady",
  result: "Injected inpage bridge and listening for postMessage events",
  url: window.location.href,
  at: Date.now(),
});
