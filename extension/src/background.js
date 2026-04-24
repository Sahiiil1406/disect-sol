const STORAGE_KEY = "rpcEvents";
const MAX_EVENTS = 250;

function toSerializableError(error) {
  if (!error) {
    return undefined;
  }

  if (typeof error === "string") {
    return { message: error };
  }

  return {
    message: error.message || "Unknown error",
    code: error.code,
  };
}

chrome.runtime.onInstalled.addListener(async () => {
  const current = await chrome.storage.local.get(STORAGE_KEY);
  if (!Array.isArray(current[STORAGE_KEY])) {
    await chrome.storage.local.set({ [STORAGE_KEY]: [] });
  }

  if (chrome.sidePanel?.setPanelBehavior) {
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  }
});

async function appendEvent(eventPayload) {
  const stamped = {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    ...eventPayload,
  };

  const current = await chrome.storage.local.get(STORAGE_KEY);
  const existing = Array.isArray(current[STORAGE_KEY])
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
    // Popup might not be open.
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message?.type) {
    return;
  }

  if (message.type === "RPC_EVENT") {
    appendEvent(message.payload)
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: String(error) }));
    return true;
  }

  if (message.type === "GET_RPC_EVENTS") {
    chrome.storage.local
      .get(STORAGE_KEY)
      .then((result) => {
        sendResponse({ ok: true, events: result[STORAGE_KEY] || [] });
      })
      .catch((error) => sendResponse({ ok: false, error: String(error) }));
    return true;
  }

  if (message.type === "CLEAR_RPC_EVENTS") {
    chrome.storage.local
      .set({ [STORAGE_KEY]: [] })
      .then(async () => {
        try {
          await chrome.runtime.sendMessage({ type: "RPC_EVENTS_CLEARED" });
        } catch {
          // Popup might not be open.
        }
        sendResponse({ ok: true });
      })
      .catch((error) => sendResponse({ ok: false, error: String(error) }));
    return true;
  }
});
