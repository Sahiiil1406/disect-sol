export function looksLikeBase64(value) {
  return (
    typeof value === "string" &&
    value.length >= 40 &&
    value.length % 4 === 0 &&
    /[+/=]/.test(value) &&
    /^[A-Za-z0-9+/=]+$/.test(value)
  );
}

export function decodeBase64Summary(value) {
  if (!looksLikeBase64(value)) {
    return null;
  }

  try {
    const raw = atob(value);
    const bytes = Uint8Array.from(raw, (char) => char.charCodeAt(0));
    const asciiPreview = Array.from(bytes)
      .slice(0, 120)
      .map((byte) =>
        byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : ".",
      )
      .join("");

    return {
      decodedFrom: "base64",
      byteLength: bytes.length,
      asciiPreview,
      hexPreview: Array.from(bytes)
        .slice(0, 24)
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join(" "),
    };
  } catch {
    return null;
  }
}

export function deepDecode(value, depth = 0) {
  if (depth > 5) {
    return "[MaxDepth]";
  }

  if (typeof value === "string") {
    const decoded = decodeBase64Summary(value);
    return decoded ? { raw: value, decoded } : value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => deepDecode(entry, depth + 1));
  }

  if (value && typeof value === "object") {
    const next = {};
    for (const [key, entry] of Object.entries(value)) {
      next[key] = deepDecode(entry, depth + 1);
    }
    return next;
  }

  return value;
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null);
}

function toAddressLabel(value) {
  if (typeof value === "string") {
    return value;
  }

  if (!value || typeof value !== "object") {
    return "Unknown";
  }

  return String(
    firstDefined(value.pubkey, value.publicKey, value.key, value.address) ||
      "Unknown",
  );
}

export function shortenAddress(value) {
  if (!value || typeof value !== "string") {
    return "n/a";
  }

  if (value.length <= 12) {
    return value;
  }

  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

export function formatLamports(lamports) {
  if (typeof lamports !== "number") {
    return "n/a";
  }

  const sol = lamports / 1_000_000_000;
  return `${sol.toFixed(6)} SOL (${lamports} lamports)`;
}

export function simplifyParams(method, params) {
  const decoded = deepDecode(params);

  if (!Array.isArray(params)) {
    return { decoded };
  }

  const first = params[0];
  const second = params[1];
  const count = params.length;

  if (method === "getBalance") {
    return {
      count,
      account: typeof first === "string" ? first : first?.pubkey || first,
      config: second || null,
      decoded,
    };
  }

  if (method === "getAccountInfo" || method === "getParsedAccountInfo") {
    return {
      count,
      account: typeof first === "string" ? first : first?.pubkey || first,
      config: second || null,
      decoded,
    };
  }

  if (
    method === "getProgramAccounts" ||
    method === "getParsedProgramAccounts"
  ) {
    return {
      count,
      programId: typeof first === "string" ? first : first?.programId || first,
      config: second || null,
      decoded,
    };
  }

  if (
    method === "getTokenAccountsByOwner" ||
    method === "getTokenAccountBalance"
  ) {
    return {
      count,
      ownerOrAccount:
        typeof first === "string" ? first : first?.pubkey || first,
      filter: second || null,
      decoded,
    };
  }

  if (
    method === "sendTransaction" ||
    method === "signTransaction" ||
    method === "simulateTransaction"
  ) {
    return {
      count,
      transaction: first ? deepDecode(first) : null,
      config: second || null,
      decoded,
    };
  }

  if (method === "signAllTransactions") {
    return {
      count,
      transactionCount: Array.isArray(first) ? first.length : 0,
      transactions: deepDecode(first),
      decoded,
    };
  }

  return {
    count,
    args: decoded,
  };
}

export function getEndpointHost(url) {
  if (!url) {
    return "unknown";
  }

  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

function isLikelySignature(value) {
  return (
    typeof value === "string" && /^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(value)
  );
}

function findSignatureDeep(value, depth = 0) {
  if (depth > 5 || value === null || value === undefined) {
    return null;
  }

  if (isLikelySignature(value)) {
    return value;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      const match = findSignatureDeep(entry, depth + 1);
      if (match) {
        return match;
      }
    }
    return null;
  }

  if (typeof value === "object") {
    const directCandidates = [
      value.signature,
      value.txid,
      value.transactionSignature,
      value.id,
      value.result,
      value.raw,
    ];

    for (const candidate of directCandidates) {
      const match = findSignatureDeep(candidate, depth + 1);
      if (match) {
        return match;
      }
    }

    for (const nested of Object.values(value)) {
      const match = findSignatureDeep(nested, depth + 1);
      if (match) {
        return match;
      }
    }
  }

  return null;
}

export function extractSignatureFromTrace(trace) {
  if (!trace) {
    return null;
  }

  return (
    findSignatureDeep(trace.result) || findSignatureDeep(trace.meta) || null
  );
}

export function detectClusterFromEndpoint(endpoint) {
  if (!endpoint) {
    return "mainnet-beta";
  }

  const lower = String(endpoint).toLowerCase();
  if (lower.includes("devnet")) {
    return "devnet";
  }

  if (lower.includes("testnet")) {
    return "testnet";
  }

  return "mainnet-beta";
}

export function detectClusterFromTrace(trace) {
  if (!trace) {
    return "devnet";
  }

  if (trace.endpoint) {
    return detectClusterFromEndpoint(trace.endpoint);
  }

  const pageUrl = String(trace.meta?.url || trace.url || "").toLowerCase();
  if (
    pageUrl.includes("localhost") ||
    pageUrl.includes("127.0.0.1") ||
    pageUrl.includes("solana-playground") ||
    pageUrl.includes("solpg.io")
  ) {
    return "devnet";
  }

  const requestParams = JSON.stringify(
    trace.meta?.requestParams || "",
  ).toLowerCase();
  if (requestParams.includes("devnet")) {
    return "devnet";
  }

  if (requestParams.includes("testnet")) {
    return "testnet";
  }

  return "mainnet-beta";
}

export function getRpcEndpointsForTrace(trace) {
  const cluster = detectClusterFromTrace(trace);
  const candidates = [];

  if (trace?.endpoint && /^https?:\/\//i.test(trace.endpoint)) {
    candidates.push(trace.endpoint);
  }

  if (cluster === "devnet") {
    candidates.push("https://api.devnet.solana.com");
    candidates.push("http://127.0.0.1:8899");
  } else if (cluster === "testnet") {
    candidates.push("https://api.testnet.solana.com");
  } else {
    candidates.push("https://api.mainnet-beta.solana.com");
  }

  return [...new Set(candidates)];
}

export function buildExplorerLinks(signature, endpointOrTrace) {
  if (!signature) {
    return null;
  }

  const cluster =
    typeof endpointOrTrace === "object"
      ? detectClusterFromTrace(endpointOrTrace)
      : detectClusterFromEndpoint(endpointOrTrace);

  return {
    explorer: `https://explorer.solana.com/tx/${signature}?cluster=${cluster}`,
    solscan: `https://solscan.io/tx/${signature}?cluster=${cluster}`,
    cluster,
  };
}

export function buildTraces(events) {
  const map = new Map();
  const ordered = [...events].reverse();
  const coreKeys = new Set([
    "id",
    "timestamp",
    "kind",
    "phase",
    "method",
    "params",
    "result",
    "error",
    "durationMs",
    "statusCode",
    "requestUrl",
    "transport",
    "at",
    "tabId",
    "requestId",
    "callId",
  ]);

  for (const event of ordered) {
    const key =
      event.callId ||
      event.requestId ||
      `${event.method || "unknown"}:${event.timestamp || event.at || 0}`;

    const existing = map.get(key) || {
      traceId: key,
      method: event.method || "unknown",
      functionName: event.method || "unknown",
      kind: event.kind || "SYSTEM",
      endpoint: event.requestUrl || "",
      transport: event.transport || "",
      callId: event.callId || "",
      startedAt: event.timestamp || event.at || Date.now(),
      durationMs: null,
      statusCode: null,
      params: undefined,
      result: undefined,
      error: undefined,
      meta: {},
      timeline: [],
      events: [],
    };

    existing.events.push(event);
    existing.timeline.push({
      phase: event.phase || "INFO",
      at: event.timestamp || event.at || Date.now(),
      kind: event.kind || "SYSTEM",
      statusCode: event.statusCode,
      transport: event.transport,
    });
    existing.kind = event.kind || existing.kind;
    existing.method = event.method || existing.method;
    existing.functionName = event.method || existing.functionName;
    existing.callId = event.callId || existing.callId;
    existing.endpoint = event.requestUrl || existing.endpoint;
    existing.transport = event.transport || existing.transport;

    for (const [keyName, value] of Object.entries(event)) {
      if (!coreKeys.has(keyName) && value !== undefined) {
        existing.meta[keyName] = value;
      }
    }

    if (event.phase === "BEFORE") {
      existing.startedAt = event.timestamp || event.at || existing.startedAt;
      existing.params = event.params ?? existing.params;
    }

    if (existing.params === undefined && event.params !== undefined) {
      existing.params = event.params;
    }

    if (existing.params === undefined && event.requestParams !== undefined) {
      existing.params = event.requestParams;
    }

    if (
      existing.params === undefined &&
      event.requestSummary?.decoded !== undefined
    ) {
      existing.params = event.requestSummary.decoded;
    }

    if (event.phase === "AFTER") {
      existing.durationMs =
        typeof event.durationMs === "number"
          ? event.durationMs
          : existing.durationMs;
      existing.statusCode =
        typeof event.statusCode === "number"
          ? event.statusCode
          : existing.statusCode;
      existing.result = event.result ?? existing.result;
      existing.error = event.error ?? existing.error;
    }

    map.set(key, existing);
  }

  return [...map.values()]
    .map((trace) => ({
      ...trace,
      timeline: trace.timeline.sort((a, b) => (a.at || 0) - (b.at || 0)),
    }))
    .sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0));
}

function summarizeAccount(account) {
  if (!account || typeof account !== "object") {
    return {
      label: String(account || "Unknown"),
      signer: false,
      writable: false,
    };
  }

  return {
    label: toAddressLabel(account),
    signer: Boolean(firstDefined(account.isSigner, account.signer, false)),
    writable: Boolean(
      firstDefined(account.isWritable, account.writable, false),
    ),
  };
}

function isLikelyAddress(value) {
  return (
    typeof value === "string" && /^[1-9A-HJ-NP-Za-km-z]{32,88}$/.test(value)
  );
}

function collectPublicKeys(value, output, depth = 0) {
  if (depth > 5 || value === null || value === undefined) {
    return;
  }

  if (typeof value === "string") {
    if (isLikelyAddress(value)) {
      output.add(value);
    }
    return;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      collectPublicKeys(entry, output, depth + 1);
    }
    return;
  }

  if (typeof value === "object") {
    for (const nested of Object.values(value)) {
      collectPublicKeys(nested, output, depth + 1);
    }
  }
}

function collectAssociatedParams(params) {
  if (!params || typeof params !== "object") {
    return [];
  }

  const output = [];
  const entries = Object.entries(params).slice(0, 24);

  for (const [key, raw] of entries) {
    if (raw === null || raw === undefined) {
      continue;
    }

    if (
      typeof raw === "string" ||
      typeof raw === "number" ||
      typeof raw === "boolean"
    ) {
      output.push({ key, value: String(raw) });
      continue;
    }

    if (Array.isArray(raw)) {
      output.push({ key, value: `${raw.length} item(s)` });
      continue;
    }

    if (typeof raw === "object") {
      const nestedKeys = Object.keys(raw).slice(0, 4).join(", ");
      output.push({
        key,
        value: nestedKeys ? `Object(${nestedKeys})` : "Object",
      });
    }
  }

  return output;
}

function collectAssociatedAccounts({ txPreview, requestSummary, params }) {
  const unique = new Set();

  collectPublicKeys(txPreview, unique);
  collectPublicKeys(requestSummary, unique);
  collectPublicKeys(params, unique);

  return [...unique].slice(0, 40).map((label) => ({
    label,
    signer: false,
    writable: false,
  }));
}

export function summarizeTraceForCleanUi(trace) {
  if (!trace) {
    return null;
  }

  const meta = trace.meta || {};
  const params = deepDecode(trace.params || {});
  const txPreview = deepDecode(
    firstDefined(meta.txPreview, params.transaction, params.txPreview),
  );
  const requestSummary = firstDefined(
    meta.requestSummary,
    params.requestSummary,
    params.args,
    null,
  );

  const accounts = Array.isArray(txPreview?.accounts)
    ? txPreview.accounts.map(summarizeAccount)
    : [];

  const instructions = Array.isArray(txPreview?.instructions)
    ? txPreview.instructions.map((instruction) => ({
        index: instruction.index,
        programId: toAddressLabel(instruction.programId),
        accountCount: Array.isArray(instruction.accountKeys)
          ? instruction.accountKeys.length
          : 0,
        dataLength:
          typeof instruction.dataLength === "number"
            ? instruction.dataLength
            : null,
        dataEncoding: instruction.dataEncoding || null,
        dataPreviewHex: instruction.dataPreviewHex || "",
        decoded:
          instruction.decoded && typeof instruction.decoded === "object"
            ? instruction.decoded
            : null,
      }))
    : [];

  const associatedAccounts = collectAssociatedAccounts({
    txPreview,
    requestSummary,
    params,
  });

  const accountCount = firstDefined(
    txPreview?.accountCount,
    accounts.length,
    null,
  );
  const methodName = String(trace.method || "").toLowerCase();
  const cluster = detectClusterFromTrace(trace);
  const rpcEndpoint = getRpcEndpointsForTrace(trace)[0] || "n/a";
  const associatedParams = collectAssociatedParams(params);

  let caseTitle = "General call";
  if (methodName.includes("signmessage")) {
    caseTitle = "Message signing";
  } else if (
    methodName.includes("connect") ||
    methodName.includes("disconnect")
  ) {
    caseTitle = "Wallet connection";
  } else if (methodName.includes("sign") || methodName.includes("send")) {
    caseTitle = "Transaction action";
  }

  return {
    title: trace.method || "Unknown action",
    caseTitle,
    duration:
      typeof trace.durationMs === "number" ? `${trace.durationMs}ms` : "n/a",
    endpoint: trace.endpoint || "n/a",
    cluster,
    rpcEndpoint,
    signerCount: firstDefined(meta.signerCount, params.signerCount, null),
    accountCount: firstDefined(accountCount, associatedAccounts.length, null),
    accounts: accounts.length > 0 ? accounts : associatedAccounts,
    instructions,
    requestSummary,
    importantParams: params,
    associatedParams,
  };
}

/**
 * Determines the account type based on owner and properties
 */
export function getAccountType(account) {
  if (!account) return "Unknown";

  if (account.executable) {
    return "Program";
  }

  const owner = account.owner || "";
  const tokenProgramId = "TokenkegQfeZyiNwAJsyFbPVwwQQfjasJjwNbUgZ6f";
  const token2022ProgramId = "TokenzQdBbjWhAw8YYX3VnYU67oV27OMwTKTqHdBr";
  const associatedTokenProgramId =
    "ATokenGPvbdGVqstVQmcLsNZAqeEctipwTYj72v4SuLg";
  const splAssocTokenProgram = "TokenkegQfeZyiNwAJsyFbPVwwQQfjasPHgKnFXYkJ";

  if (owner === tokenProgramId || owner === token2022ProgramId) {
    return "Token Account";
  }

  if (owner === associatedTokenProgramId || owner === splAssocTokenProgram) {
    return "Associated Token";
  }

  if (account.parsedType === "mint") {
    return "Token Mint";
  }

  if (account.parsedType === "account") {
    return "Token Account";
  }

  return "Account";
}

/**
 * Format address with ellipsis and option to copy
 */
export function formatAddressForDisplay(address) {
  if (!address || typeof address !== "string") return "n/a";
  if (address.length <= 20) return address;
  return {
    full: address,
    short: `${address.slice(0, 4)}...${address.slice(-4)}`,
    start: address.slice(0, 8),
    end: address.slice(-8),
  };
}

/**
 * Get account status badges
 */
export function getAccountBadges(account) {
  const badges = [];

  if (account.executable) {
    badges.push({ type: "executable", label: "Program" });
  }

  if (account.owner === "11111111111111111111111111111111") {
    badges.push({ type: "system", label: "System" });
  }

  const owner = account.owner || "";
  const tokenPrograms = [
    "TokenkegQfeZyiNwAJsyFbPVwwQQfjasPHgKnFXYkJ",
    "TokenzQdBbjWhAw8YYX3VnYU67oV27OMwTKTqHdBr",
  ];

  if (tokenPrograms.some((p) => owner === p)) {
    badges.push({ type: "token", label: "Token" });
  }

  if (account.space && account.space > 0) {
    badges.push({ type: "storage", label: `${account.space}B storage` });
  }

  return badges;
}

/**
 * Format account lamports to SOL with better readability
 */
export function formatSol(lamports) {
  if (typeof lamports !== "number") return "0 SOL";
  const sol = lamports / 1_000_000_000;
  if (sol === 0) return "0 SOL";
  return `${sol.toFixed(4)} SOL`;
}

/**
 * Calculate total lamports from accounts
 */
export function calculateTotalLamports(accounts) {
  if (!Array.isArray(accounts)) return 0;
  return accounts.reduce((sum, acc) => {
    return sum + (typeof acc.lamports === "number" ? acc.lamports : 0);
  }, 0);
}
