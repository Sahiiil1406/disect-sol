import bs58 from "bs58";

let web3ConstructorsPromise = null;

async function getWeb3Constructors() {
  if (!web3ConstructorsPromise) {
    web3ConstructorsPromise = import("@solana/web3.js").then((module) => ({
      PublicKey: module.PublicKey,
      Transaction: module.Transaction,
      TransactionInstruction: module.TransactionInstruction,
    }));
  }

  return web3ConstructorsPromise;
}

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

/**
 * Get human-readable program name from program ID
 */
export function getProgramName(programId) {
  const knownPrograms = {
    "11111111111111111111111111111111": "System Program",
    TokenkegQfeZyiNwAJsyFbPVwwQQfjasPHgKnFXYkJ: "SPL Token Program",
    TokenzQdBbjWhAw8YYX3VnYU67oV27OMwTKTqHdBr: "Token-2022 Program",
    ATokenGPvbdGVqstVQmcLsNZAqeEctipwTYj72v4SuLg: "Associated Token Program",
    Vote111111111111111111111111111111111111111: "Vote Program",
    Stake11111111111111111111111111111111111111: "Stake Program",
    Config1111111111111111111111111111111111111: "Config Program",
    BPFLoaderUpgradeab1e11111111111111111111111: "BPF Loader",
    BPFLoader1111111111111111111111111111111111: "BPF Loader (Legacy)",
    BPFLoader2111111111111111111111111111111111: "BPF Loader v2",
  };

  return knownPrograms[programId] || "Unknown Program";
}

/**
 * Get instruction description based on program and decoded data
 */
export function getInstructionDescription(instruction) {
  if (!instruction) return "Unknown instruction";

  const programId = instruction.programId || "";
  const decoded = instruction.decoded || {};

  // System program instructions
  if (programId === "11111111111111111111111111111111") {
    return (
      systemInstructionDescriptions[decoded.type] ||
      `System: ${decoded.type || "Unknown"}`
    );
  }

  // Token program instructions
  if (
    programId === "TokenkegQfeZyiNwAJsyFbPVwwQQfjasPHgKnFXYkJ" ||
    programId === "TokenzQdBbjWhAw8YYX3VnYU67oV27OMwTKTqHdBr"
  ) {
    return (
      tokenInstructionDescriptions[decoded.type] ||
      `Token: ${decoded.type || "Unknown"}`
    );
  }

  // Default
  return `${getProgramName(programId)}: ${decoded.type || "Execution"}`;
}

const systemInstructionDescriptions = {
  CreateAccount: "Create a new account with specified owner and space",
  Transfer: "Transfer SOL lamports from one account to another",
  Assign: "Assign account ownership to a program",
  CreateAccountWithSeed: "Create account at derived address",
  TransferWithSeed: "Transfer using derived account address",
  AllocateSpace: "Allocate space to an account",
  AllocateSpaceWithSeed: "Allocate space to account with seed",
  AssignWithSeed: "Assign account with derived address",
};

const tokenInstructionDescriptions = {
  Transfer: "Transfer tokens from source to destination",
  TransferChecked: "Transfer with token verification",
  Mint: "Create new tokens",
  Burn: "Destroy tokens",
  BurnChecked: "Destroy tokens with verification",
  InitializeMint: "Initialize token mint",
  InitializeAccount: "Initialize token account",
  InitializeMultisig: "Initialize multisig mint",
  ApproveDelegate: "Approve delegated token transfer",
  Revoke: "Revoke token delegation",
  SetAuthority: "Change account authority",
  CloseAccount: "Close token account",
  FreezeAccount: "Freeze token account",
  ThawAccount: "Unfreeze token account",
};

/**
 * Determine account role in transaction (feePayer, writable, readonly, signer, etc.)
 */
export function getAccountRoles(account, txMessage, allAccounts) {
  const roles = [];

  if (!account || !txMessage || !allAccounts) return roles;

  const accountIndex = allAccounts.findIndex((a) => a === account.pubkey);
  if (accountIndex === -1) return roles;

  // Fee payer is always first signer
  const feePayer = txMessage.feePayer || txMessage.accountKeys?.[0];
  if (account.pubkey === feePayer) {
    roles.push({ type: "feepayer", label: "Fee Payer" });
  }

  // Check if signer
  const signerCount = txMessage.header?.numSigners || 0;
  if (accountIndex < signerCount) {
    roles.push({ type: "signer", label: "Signer" });
  }

  // Check if writable
  const writableCount = txMessage.header?.numReadonlySignedAccounts
    ? signerCount - txMessage.header.numReadonlySignedAccounts
    : signerCount;
  if (accountIndex < writableCount) {
    roles.push({ type: "writable", label: "Writable" });
  } else if (accountIndex < signerCount) {
    roles.push({ type: "readonly-signer", label: "Readonly Signer" });
  } else if (
    accountIndex <
    signerCount +
      (txMessage.header?.numReadonlyUnsignedAccounts
        ? txMessage.accountKeys?.length -
          signerCount -
          txMessage.header.numReadonlyUnsignedAccounts
        : txMessage.accountKeys?.length - signerCount)
  ) {
    roles.push({ type: "writable-unsigned", label: "Writable" });
  } else {
    roles.push({ type: "readonly", label: "Readonly" });
  }

  return roles;
}

/**
 * Format instruction for tree view with explanations
 */
export function formatInstructionForTree(instruction, index) {
  if (!instruction) return null;

  return {
    id: `ix-${index}`,
    index,
    name: `Instruction ${index + 1}`,
    programId: instruction.programId,
    programName: getProgramName(instruction.programId),
    description: getInstructionDescription(instruction),
    accountCount: instruction.accountCount || 0,
    dataLength: instruction.dataLength || 0,
    decoded: instruction.decoded || {},
    summary:
      (instruction.decoded?.type || "Execute") +
      ` - ${instruction.accountCount || 0} accounts`,
  };
}

/**
 * Create hierarchical instruction tree
 */
export function buildInstructionTree(instructions) {
  if (!Array.isArray(instructions)) return [];

  return instructions.map((instruction, index) =>
    formatInstructionForTree(instruction, index),
  );
}

/**
 * Parse and humanize Solana error messages
 */
export function parseTransactionError(error) {
  if (!error) return { human: "No error information", raw: null };

  // Handle string errors
  if (typeof error === "string") {
    return {
      human: translateErrorMessage(error),
      raw: error,
    };
  }

  // Handle error objects
  if (typeof error === "object") {
    const errorStr = JSON.stringify(error);
    const humanMessage = translateErrorMessage(errorStr);

    // Try to extract more specific error info
    let specificError = null;
    if (error.InstructionError) {
      const [instructionIndex, errorType] = error.InstructionError;
      specificError = `Instruction #${instructionIndex} failed: ${translateErrorMessage(
        JSON.stringify(errorType),
      )}`;
    }

    return {
      human: specificError || humanMessage,
      raw: error,
      details: extractErrorDetails(error),
    };
  }

  return { human: "Unknown error", raw: error };
}

/**
 * Translate error codes to human-readable messages
 */
function translateErrorMessage(errorStr) {
  const errorLower = String(errorStr).toLowerCase();

  // Common Solana errors
  const errorMap = {
    "custom error: 0x0": "Custom error - No specific error",
    "custom error: 0x1": "Custom error - Invalid input",
    "custom error: 0x2": "Custom error - Invalid account state",
    "insufficient funds":
      "Account does not have enough SOL to cover fees or transfer",
    "account in use": "Account is already being used in another instruction",
    "account not writable": "Account cannot be modified - marked as read-only",
    "signature verification failed":
      "Transaction signature is invalid or missing required signature",
    "block hash not found":
      "Recent blockhash is too old or invalid - resubmit transaction",
    "invalid account data": "Account data format is invalid or corrupted",
    "instruction error":
      "Instruction execution failed - check decoded instruction details",
    "invalid instruction data":
      "Instruction parameters are malformed or invalid",
    "missing required signature": "Transaction is missing required signer",
    "account lamport balance below rent exempt threshold":
      "Account balance is below minimum rent exempt amount",
    "program not implemented": "Program at this address is not yet implemented",
    "program failed custom instruction error":
      "Custom program error - check program-specific documentation",
    "failed to deserialize account":
      "Program cannot parse account data - data format mismatch",
    "failed to serialize account":
      "Program cannot write account data - internal error",
    "unsupported program id":
      "This program ID is not supported on this network",
    "transaction too large": "Transaction size exceeds maximum allowed size",
    "token balance insufficient":
      "Token account has insufficient balance for transaction",
    "owner does not match":
      "Account owner does not match - wrong token program or owner",
    "token transfer fail":
      "Token transfer operation failed - check amounts and accounts",
    "owner mismatch": "Account owner does not match expected program",
    "anchor error": "Anchor framework error - check program instructions",
    pda: "Derived address (PDA) does not match - check seed derivation",
    "invalid seeds": "Account seeds are invalid for PDA derivation",
  };

  // Check for exact and partial matches
  for (const [key, value] of Object.entries(errorMap)) {
    if (errorLower.includes(key)) {
      return value;
    }
  }

  // Extract hex error code if present
  const hexMatch = errorStr.match(/0x([0-9a-fA-F]+)/);
  if (hexMatch) {
    const hexCode = hexMatch[1];
    const decCode = parseInt(hexCode, 16);
    return `Error code: 0x${hexCode} (${decCode}) - Program execution failed`;
  }

  // Try to make it readable by adding spaces
  if (errorStr.length < 200) {
    return (
      errorStr
        .replace(/([A-Z])/g, " $1")
        .replace(/_/g, " ")
        .toLowerCase()
        .trim() || "Unknown error occurred"
    );
  }

  return "Transaction failed - see raw error for details";
}

/**
 * Extract detailed error information
 */
function extractErrorDetails(error) {
  if (!error || typeof error !== "object") return null;

  const details = {};

  if (error.InstructionError) {
    const [index, errType] = error.InstructionError;
    details.instructionIndex = index;
    details.errorType = errType;
  }

  if (error.err) {
    details.customError = error.err;
  }

  if (error.message) {
    details.message = error.message;
  }

  return Object.keys(details).length > 0 ? details : null;
}

/**
 * Format error for display with severity level
 */
export function getErrorSeverity(error) {
  if (!error) return { level: "none", color: "" };

  const errorStr = JSON.stringify(error).toLowerCase();

  if (
    errorStr.includes("critical") ||
    errorStr.includes("fatal") ||
    errorStr.includes("panic")
  ) {
    return { level: "critical", color: "error" };
  }

  if (
    errorStr.includes("insufficient") ||
    errorStr.includes("unauthorized") ||
    errorStr.includes("signature")
  ) {
    return { level: "high", color: "error" };
  }

  if (errorStr.includes("warn") || errorStr.includes("deprecated")) {
    return { level: "warning", color: "warning" };
  }

  return { level: "error", color: "error" };
}

/**
 * Decode Anchor program function name from discriminator
 * Discriminator is first 8 bytes of SHA256(namespace + function_name)
 */
export function decodeFunctionFromDiscriminator(discriminator) {
  if (!discriminator || typeof discriminator !== "string") {
    return null;
  }

  // Common Anchor function discriminators (first 8 bytes in hex)
  const knownDiscriminators = {
    e64e5b00cbf1b500: "initialize",
    f969f9ca25e9ff00: "deposit",
    c0b3e8b6e2c1ff00: "withdraw",
    a1f7d0c3b2e1ff00: "transfer",
    "4f3a8e2d1b9cff00": "mint",
    d5a7c2e8f1b3ff00: "burn",
    c3f1e8b9a2d7ff00: "create_account",
    b2a8f7c1d9e3ff00: "close_account",
    e9d2c1a8f7b3ff00: "update",
    f1e3d2a9c8b7ff00: "delete",
    a2f8c7d1e9b3ff00: "approve",
    d8c1f2e9a7b3ff00: "revoke",
    c7f1e8d9b2a3ff00: "execute",
    b1e9f8c7d2a3ff00: "validate",
  };

  return knownDiscriminators[discriminator.toLowerCase()] || null;
}

/**
 * Analyze parameters and extract type information
 */
export function analyzeParameters(decoded) {
  if (!decoded || typeof decoded !== "object") {
    return { parameters: [], paramCount: 0 };
  }

  const parameters = [];

  for (const [key, value] of Object.entries(decoded)) {
    const type = inferParameterType(value);
    const isRequired = !key.startsWith("optional_");

    parameters.push({
      name: key,
      type,
      value,
      isRequired,
      isNested: type === "object" || type === "array",
      stringValue: formatParameterValue(value),
    });
  }

  return {
    parameters,
    paramCount: parameters.length,
    requiredCount: parameters.filter((p) => p.isRequired).length,
  };
}

/**
 * Infer parameter type from value
 */
function inferParameterType(value) {
  if (value === null || value === undefined) return "null";
  if (typeof value === "boolean") return "bool";
  if (typeof value === "number") {
    if (Number.isInteger(value)) {
      if (value <= 255 && value >= 0) return "u8";
      if (value <= 65535 && value >= 0) return "u16";
      if (value <= 4294967295 && value >= 0) return "u32";
      if (value <= 9223372036854775807n) return "i64";
      return "u64";
    }
    return "f64";
  }
  if (typeof value === "string") {
    // Try to detect string type
    if (/^[1-9A-HJ-NP-Za-km-z]{32,88}$/.test(value)) return "address";
    if (/^0x[0-9a-fA-F]+$/.test(value)) return "bytes";
    if (/^\d+$/.test(value)) return "string_number";
    if (value.length < 100) return "string";
    return "text";
  }
  if (Array.isArray(value)) return "array";
  if (typeof value === "object") return "object";
  return "unknown";
}

/**
 * Format parameter value for display
 */
function formatParameterValue(value) {
  if (value === null || value === undefined) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "string") {
    if (value.length > 60) return `${value.substring(0, 60)}...`;
    return value;
  }
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) return `[${value.length} items]`;
  if (typeof value === "object") return `{${Object.keys(value).length} fields}`;
  return String(value);
}

/**
 * Extract function signature from decoded data
 */
export function extractFunctionSignature(programId, decoded) {
  const programName = getProgramName(programId);
  const discriminator = decoded?.discriminator || null;
  const decodedFunctionName =
    discriminator && decodeFunctionFromDiscriminator(discriminator);
  const functionType = decoded?.type || "Execute";

  const funcName = decodedFunctionName || functionType;

  const { parameters, paramCount, requiredCount } = analyzeParameters(decoded);

  return {
    name: funcName,
    displayName: `${funcName}(${paramCount})`,
    programName,
    discriminator,
    parameters,
    paramCount,
    requiredCount,
    description: getInstructionDescription({ programId, decoded }),
  };
}

/**
 * Get detailed instruction analysis
 */
export function getDetailedInstructionAnalysis(instruction) {
  if (!instruction) return null;

  const signature = extractFunctionSignature(
    instruction.programId,
    instruction.decoded,
  );

  return {
    index: instruction.index,
    programId: instruction.programId,
    programName: getProgramName(instruction.programId),
    signature,
    accountCount: instruction.accountCount || 0,
    dataSize: instruction.dataLength || 0,
    encoding: instruction.dataEncoding || "base64",
    executable: Boolean(instruction.executable),
    summary: `[${instruction.index}] ${signature.displayName} - ${instruction.accountCount || 0} accounts`,
  };
}

function normalizeAccountKey(account) {
  if (!account) {
    return null;
  }

  if (typeof account === "string") {
    return account;
  }

  if (typeof account === "object") {
    return (
      account.pubkey ||
      account.publicKey ||
      account.address ||
      account.key ||
      account
    );
  }

  return String(account);
}

function getReplayTransactionPayload(trace) {
  const params = trace?.params;
  const metaParams = trace?.meta?.requestParams;

  const candidates = [
    Array.isArray(params) ? params[0] : params,
    Array.isArray(metaParams) ? metaParams[0] : metaParams,
    trace?.meta?.txPreview?.transaction,
    trace?.meta?.txPreview,
    trace?.txDetails?.transaction,
    trace?.txDetails,
  ];

  for (const candidate of candidates) {
    if (candidate && typeof candidate === "object") {
      return candidate;
    }
  }

  return null;
}

async function toPublicKey(value) {
  if (!value) {
    return null;
  }

  const address = normalizeAccountKey(value);
  if (!address) {
    return null;
  }

  try {
    const { PublicKey } = await getWeb3Constructors();
    return new PublicKey(address);
  } catch {
    return null;
  }
}

function decodeInstructionData(data) {
  if (!data) {
    return new Uint8Array();
  }

  if (data instanceof Uint8Array) {
    return data;
  }

  if (Array.isArray(data)) {
    return Uint8Array.from(data);
  }

  if (typeof data === "string") {
    const base64Pattern = /^[A-Za-z0-9+/=]+$/;
    if (data.length % 4 === 0 && base64Pattern.test(data)) {
      try {
        return Uint8Array.from(atob(data), (char) => char.charCodeAt(0));
      } catch {
        // fall through to base58
      }
    }

    try {
      return bs58.decode(data);
    } catch {
      return new Uint8Array();
    }
  }

  return new Uint8Array();
}

function encodeBytesToBase64(bytes) {
  if (!bytes || bytes.length === 0) {
    return "";
  }

  let binary = "";
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

async function buildSerializedTransactionPayload(txDetails) {
  const { Transaction, TransactionInstruction } = await getWeb3Constructors();
  const transaction = txDetails?.transaction || txDetails;
  const message = transaction?.message;

  if (!message || !Array.isArray(message.accountKeys)) {
    return null;
  }

  const tx = new Transaction();
  const feePayer =
    transaction?.feePayer || message.feePayer || message.accountKeys?.[0];
  const recentBlockhash =
    transaction?.recentBlockhash || message.recentBlockhash;

  if (feePayer) {
    const payerKey = await toPublicKey(feePayer);
    if (payerKey) {
      tx.feePayer = payerKey;
    }
  }

  if (recentBlockhash) {
    tx.recentBlockhash = String(recentBlockhash);
  }

  const accountKeys = message.accountKeys.map((key) =>
    normalizeAccountKey(key),
  );

  const instructions = Array.isArray(message.instructions)
    ? message.instructions
    : [];

  for (const instruction of instructions) {
    const programId =
      normalizeAccountKey(instruction.programId) ||
      (typeof instruction.programIdIndex === "number"
        ? accountKeys[instruction.programIdIndex]
        : null);
    const programKey = await toPublicKey(programId);
    if (!programKey) {
      continue;
    }

    const accountIndexes = Array.isArray(instruction.accounts)
      ? instruction.accounts
      : Array.isArray(instruction.accountKeyIndexes)
        ? instruction.accountKeyIndexes
        : [];

    const keys = (
      await Promise.all(
        accountIndexes.map(async (entry) => {
          const address =
            typeof entry === "number"
              ? accountKeys[entry]
              : normalizeAccountKey(entry);
          const pubkey = await toPublicKey(address);
          if (!pubkey) {
            return null;
          }

          const accountMeta =
            typeof entry === "number" ? message.accountKeys?.[entry] : entry;

          return {
            pubkey,
            isSigner: Boolean(accountMeta?.signer || accountMeta?.isSigner),
            isWritable: Boolean(
              accountMeta?.writable || accountMeta?.isWritable,
            ),
          };
        }),
      )
    ).filter(Boolean);

    const data = decodeInstructionData(instruction.data);
    tx.add(
      new TransactionInstruction({
        programId: programKey,
        keys,
        data,
      }),
    );
  }

  try {
    return tx.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });
  } catch {
    return null;
  }
}

function getTransactionAccountKeys(txData) {
  const message =
    txData?.transaction?.message || txData?.value?.transaction?.message || {};
  const rawKeys = message.accountKeys || message.staticAccountKeys || [];

  return rawKeys
    .map((key) => normalizeAccountKey(key))
    .filter((key) => Boolean(key));
}

function getTransactionMeta(txData) {
  return txData?.meta || txData?.value?.meta || txData?.result?.meta || {};
}

function getSimulationValue(simulationResponse) {
  const result = simulationResponse?.result;
  if (!result) {
    return null;
  }

  if (result.value || result.context) {
    return result.value || result;
  }

  return result;
}

function formatTokenBalance(balance) {
  if (!balance) {
    return "n/a";
  }

  const uiAmount =
    balance.uiTokenAmount?.uiAmountString ||
    balance.uiTokenAmount?.uiAmount ||
    balance.uiAmountString ||
    balance.amount ||
    "0";
  const decimals = balance.uiTokenAmount?.decimals ?? balance.decimals ?? "n/a";
  const amount = balance.uiTokenAmount?.amount || balance.amount || "0";
  const mint = balance.mint || "unknown mint";

  return `${uiAmount} tokens (${amount} raw, ${decimals} decimals, mint ${mint})`;
}

function buildTokenBalanceMap(tokenBalances = []) {
  const map = new Map();

  for (const balance of tokenBalances) {
    const key =
      balance?.accountIndex ??
      balance?.owner ??
      balance?.mint ??
      balance?.pubkey;
    if (key === undefined || key === null) {
      continue;
    }

    map.set(String(key), balance);
  }

  return map;
}

function buildStateChangeRows(txData) {
  if (!txData || typeof txData !== "object") {
    return [];
  }

  const meta = getTransactionMeta(txData);
  const accountKeys = getTransactionAccountKeys(txData);
  const preBalances = Array.isArray(meta.preBalances) ? meta.preBalances : [];
  const postBalances = Array.isArray(meta.postBalances)
    ? meta.postBalances
    : [];
  const maxAccountCount = Math.max(
    accountKeys.length,
    preBalances.length,
    postBalances.length,
  );
  const rows = [];

  for (let index = 0; index < maxAccountCount; index += 1) {
    const account = accountKeys[index] || `Account ${index}`;
    const preBalance = preBalances[index];
    const postBalance = postBalances[index];

    if (preBalance === undefined && postBalance === undefined) {
      continue;
    }

    if (preBalance === postBalance) {
      continue;
    }

    rows.push({
      kind: "lamports",
      account,
      accountIndex: index,
      label: `Account ${index}`,
      beforeValue: formatLamports(preBalance),
      afterValue: formatLamports(postBalance),
      rawBefore: preBalance,
      rawAfter: postBalance,
      delta:
        typeof preBalance === "number" && typeof postBalance === "number"
          ? postBalance - preBalance
          : null,
    });
  }

  const preTokenBalances = Array.isArray(meta.preTokenBalances)
    ? meta.preTokenBalances
    : [];
  const postTokenBalances = Array.isArray(meta.postTokenBalances)
    ? meta.postTokenBalances
    : [];
  const preTokenMap = buildTokenBalanceMap(preTokenBalances);
  const postTokenMap = buildTokenBalanceMap(postTokenBalances);
  const tokenKeys = new Set([...preTokenMap.keys(), ...postTokenMap.keys()]);

  for (const key of tokenKeys) {
    const before = preTokenMap.get(key) || null;
    const after = postTokenMap.get(key) || null;

    const beforeAmount = before?.uiTokenAmount?.amount || before?.amount || "0";
    const afterAmount = after?.uiTokenAmount?.amount || after?.amount || "0";
    const beforeUi =
      before?.uiTokenAmount?.uiAmountString || before?.uiAmountString || "0";
    const afterUi =
      after?.uiTokenAmount?.uiAmountString || after?.uiAmountString || "0";

    if (beforeAmount === afterAmount && beforeUi === afterUi) {
      continue;
    }

    const account =
      accountKeys[Number.isFinite(Number(key)) ? Number(key) : -1] ||
      before?.owner ||
      after?.owner ||
      before?.mint ||
      after?.mint ||
      `Token account ${key}`;

    rows.push({
      kind: "token",
      account,
      accountIndex: Number.isFinite(Number(key)) ? Number(key) : null,
      label: before?.mint || after?.mint || `Token account ${key}`,
      mint: before?.mint || after?.mint || null,
      beforeValue: formatTokenBalance(before),
      afterValue: formatTokenBalance(after),
      rawBefore: before,
      rawAfter: after,
      delta: null,
    });
  }

  return rows;
}

function fetchTransactionBySignature(signature, rpcEndpoint) {
  return fetch(rpcEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getTransaction",
      params: [
        signature,
        {
          encoding: "json",
          maxSupportedTransactionVersion: 0,
        },
      ],
    }),
  }).then((response) => response.json());
}

/**
 * Simulate a Solana transaction
 * Calls the simulateTransaction RPC method
 */
export async function simulateTransaction(source, rpcEndpoint, options = {}) {
  try {
    if (!source || !rpcEndpoint) {
      return {
        success: false,
        error: "Missing transaction source or RPC endpoint",
      };
    }

    const mode = options.mode === "real" ? "real" : "mock";
    const signature =
      options.signature ||
      (typeof source === "string" ? source : null) ||
      extractSignatureFromTrace(source);

    const txPayload =
      typeof source === "object" && source !== null
        ? await buildSerializedTransactionPayload(source.txDetails || source)
        : null;

    if (!txPayload) {
      if (!signature) {
        return {
          success: false,
          error:
            "No captured transaction payload was found for replay or simulation",
        };
      }

      const response = await fetchTransactionBySignature(
        signature,
        rpcEndpoint,
      );

      if (response.error) {
        return {
          success: false,
          error: response.error.message,
        };
      }

      const txData = response.result;
      if (!txData) {
        return {
          success: false,
          error: "Transaction not found",
        };
      }

      const meta = getTransactionMeta(txData);
      const logs = meta.logMessages || [];
      const computeUnits = meta.computeUnitsConsumed || 0;
      const fee = meta.fee || 0;
      const stateChanges = buildStateChangeRows(txData);

      return {
        success: true,
        data: {
          mode,
          signature,
          fee,
          computeUnits,
          logs,
          stateChanges,
          status: meta.err ? "failed" : "succeeded",
          error: meta.err,
          executedAt: txData.blockTime,
          slot: txData.slot,
          txData,
        },
      };
    }

    const response = await fetch(rpcEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "simulateTransaction",
        params: [
          encodeBytesToBase64(txPayload),
          {
            encoding: "base64",
            commitment: "confirmed",
            sigVerify: mode === "real",
            replaceRecentBlockhash: mode !== "real",
            maxSupportedTransactionVersion: 0,
          },
        ],
      }),
    }).then((response) => response.json());

    if (response.error) {
      return {
        success: false,
        error: response.error.message,
      };
    }

    const simulationValue = getSimulationValue(response);
    if (!simulationValue) {
      return {
        success: false,
        error: "Simulation returned no result",
      };
    }

    const liveRecord = signature
      ? await fetchTransactionBySignature(signature, rpcEndpoint).then(
          (result) => (result?.result ? result.result : null),
        )
      : null;

    const liveMeta = liveRecord ? getTransactionMeta(liveRecord) : {};
    const stateChanges = buildStateChangeRows(liveRecord || source);
    const logs =
      simulationValue.logs ||
      liveMeta.logMessages ||
      getTransactionMeta(liveRecord || source).logMessages ||
      [];
    const computeUnits =
      simulationValue.unitsConsumed ??
      simulationValue.computeUnitsConsumed ??
      liveMeta.computeUnitsConsumed ??
      0;
    const fee = liveMeta.fee ?? 0;

    return {
      success: true,
      data: {
        mode,
        signature,
        fee,
        computeUnits,
        logs,
        stateChanges,
        status: simulationValue.err || liveMeta.err ? "failed" : "succeeded",
        error: simulationValue.err || liveMeta.err || null,
        executedAt: liveRecord?.blockTime || null,
        slot: liveRecord?.slot || response?.result?.context?.slot || null,
        replaySource: txPayload,
        simulationValue,
        liveRecord,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err.message || "Failed to simulate transaction",
    };
  }
}

/**
 * Format simulation results for display
 */
export function formatSimulationResults(simulationResult) {
  if (!simulationResult.success) {
    return {
      status: "error",
      message: simulationResult.error,
      sections: [],
    };
  }

  const data = simulationResult.data;
  const sections = [
    {
      title: "📊 Execution Metrics",
      items: [
        {
          label: "Mode",
          value: data.mode === "real" ? "Live replay" : "Mock simulation",
        },
        {
          label: "Status",
          value: data.status === "succeeded" ? "✅ Succeeded" : "❌ Failed",
        },
        {
          label: "Compute Units Used",
          value: `${data.computeUnits} CU`,
        },
        {
          label: "Transaction Fee",
          value: `${formatLamports(data.fee)}`,
        },
        {
          label: "Slot",
          value: data.slot || "n/a",
        },
      ],
    },
  ];

  if (data.logs && data.logs.length > 0) {
    sections.push({
      title: "📝 Execution Logs",
      logs: data.logs,
    });
  }

  if (data.stateChanges && data.stateChanges.length > 0) {
    sections.push({
      title: "💾 State Changes",
      changes: data.stateChanges,
    });
  }

  if (data.error) {
    sections.push({
      title: "⚠️ Error Details",
      error: data.error,
    });
  }

  return {
    status: "success",
    sections,
  };
}

export function extractComputeUnitsFromLogs(logs) {
  if (!Array.isArray(logs)) {
    return null;
  }

  for (const log of logs) {
    if (typeof log !== "string") continue;
    const match = log.match(/consumed\s+(\d+)\s+of\s+(\d+)\s+compute\s+units/i);
    if (match) {
      return {
        consumed: parseInt(match[1], 10),
        budget: parseInt(match[2], 10),
      };
    }
  }
  return null;
}

export function calculateSuggestedBudget(actualConsumed) {
  if (typeof actualConsumed !== "number" || actualConsumed < 0) {
    return null;
  }
  return Math.floor(actualConsumed * 1.1) + 1000;
}

export function extractComputeBudgetFromInstructions(instructions) {
  if (!Array.isArray(instructions)) {
    return null;
  }

  for (const ix of instructions) {
    if (
      ix.programId === "ComputeBudget111111111111111111111111111111" ||
      ix.program === "ComputeBudget"
    ) {
      if (ix.parsed?.type === "setComputeUnitLimit") {
        return {
          units: ix.parsed?.info?.units || ix.data?.units,
          price: null,
        };
      }
      if (ix.parsed?.type === "setComputeUnitPrice") {
        return {
          units: null,
          price: ix.parsed?.info?.microlamports || ix.data?.microlamports,
        };
      }
    }
  }
  return null;
}

export function buildCpiCostTree(logs) {
  if (!Array.isArray(logs)) {
    return [];
  }

  const tree = [];
  const stack = [];

  for (const log of logs) {
    if (typeof log !== "string") continue;

    const invokeMatch = log.match(
      /Program\s+(\w+)\s+invoke\s+\[(\d+)\]/
    );
    if (invokeMatch) {
      const [, programId, depth] = invokeMatch;
      const depthNum = parseInt(depth, 10);

      while (stack.length > depthNum - 1) {
        stack.pop();
      }

      const node = {
        depth: depthNum,
        programId,
        logs: [],
        children: [],
      };

      if (stack.length === 0) {
        tree.push(node);
      } else {
        stack[stack.length - 1].children.push(node);
      }

      stack.push(node);
      continue;
    }

    const successMatch = log.match(
      /Program\s+(\w+)\s+consumed\s+(\d+)\s+of\s+(\d+)\s+compute\s+units/
    );
    if (successMatch && stack.length > 0) {
      const [, , consumed] = successMatch;
      stack[stack.length - 1].consumed = parseInt(consumed, 10);
      continue;
    }

    if (stack.length > 0) {
      stack[stack.length - 1].logs.push(log);
    }
  }

  return tree;
}

export function getCuAnalysis(trace, txInsights) {
  if (!trace && !txInsights) {
    return null;
  }

  const details = txInsights?.details;
  const meta = details?.meta || trace?.result?.meta || trace?.meta || {};
  const logs = meta.logMessages || meta.logs || trace?.result?.logs || [];
  const instructions =
    details?.transaction?.message?.instructions ||
    trace?.result?.transaction?.message?.instructions ||
    trace?.transaction?.message?.instructions ||
    [];

  const cuMetrics = extractComputeUnitsFromLogs(logs);
  const budgetInfo = extractComputeBudgetFromInstructions(instructions);
  const cpiTree = buildCpiCostTree(logs);

  const suggested =
    cuMetrics && cuMetrics.consumed
      ? calculateSuggestedBudget(cuMetrics.consumed)
      : null;

  return {
    budgetSet: budgetInfo?.units || cuMetrics?.budget || null,
    actualConsumed: cuMetrics?.consumed || null,
    suggestedBudget: suggested,
    cpiBreakdown: cpiTree,
  };
}


