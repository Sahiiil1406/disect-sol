const BRIDGE_EVENT = "__DEVTOOLS_SOLANA_BRIDGE__";
const BRIDGE_MESSAGE_TYPE = "__DEVTOOLS_SOLANA_BRIDGE_MESSAGE__";
const BRIDGE_SOURCE = "sol-trace-inpage";

if (window.__SOL_TRACE_INPAGE_INSTALLED__) {
  // Avoid duplicate wrappers if this script is injected more than once.
} else {
  window.__SOL_TRACE_INPAGE_INSTALLED__ = true;
  const WRITE_METHODS = [
    "signTransaction",
    "signAllTransactions",
    "sendTransaction",
    "signAndSendTransaction",
  ];
  const READ_METHODS = [
    "getAccountInfo",
    "getProgramAccounts",
    "getMultipleAccountsInfo",
    "getParsedAccountInfo",
    "getParsedProgramAccounts",
    "getBalance",
    "getTokenAccountBalance",
    "getTokenAccountsByOwner",
    "getLatestBlockhash",
    "getRecentBlockhash",
    "getTransaction",
    "getSignatureStatuses",
    "simulateTransaction",
    "confirmTransaction",
  ];
  const WALLET_METHODS = [
    "request",
    "connect",
    "disconnect",
    "signMessage",
    ...WRITE_METHODS,
  ];
  const ANCHOR_PROVIDER_METHODS = [
    "send",
    "sendAll",
    "sendAndConfirm",
    "sendAndConfirmRawTransaction",
  ];
  const PROVIDER_ROOTS = [
    ["solana"],
    ["phantom", "solana"],
    ["backpack", "solana"],
    ["solflare"],
    ["okxwallet", "solana"],
    ["bitgetwallet", "solana"],
    ["coin98", "solana"],
    ["glow", "solana"],
  ];

  const wrappedTargets = new WeakSet();
  const wrappedFns = new WeakSet();
  let callSequence = 0;

  function now() {
    return Date.now();
  }

  function createCallId(method) {
    callSequence += 1;
    return `${method || "call"}:${now()}:${callSequence}`;
  }

  function reportHookIssue(scope, method, error) {
    postEvent({
      kind: "SYSTEM",
      phase: "INFO",
      method: "hookInstallWarning",
      at: now(),
      url: location.href,
      result: `${scope}.${method} could not be patched`,
      error: toSerializable(error),
    });
  }

  function installWrappedMethod(target, method, wrapped, scope) {
    try {
      target[method] = wrapped;
      return true;
    } catch (assignError) {
      try {
        Object.defineProperty(target, method, {
          value: wrapped,
          configurable: true,
          writable: true,
        });
        return true;
      } catch (defineError) {
        reportHookIssue(scope, method, defineError || assignError);
        return false;
      }
    }
  }

  function toSerializable(value, depth = 0) {
    if (depth > 3) {
      return "[MaxDepth]";
    }

    if (value === null || value === undefined) {
      return value;
    }

    const t = typeof value;
    if (t === "string" || t === "number" || t === "boolean") {
      return value;
    }

    if (t === "bigint") {
      return value.toString();
    }

    if (t === "function") {
      return `[Function ${value.name || "anonymous"}]`;
    }

    if (Array.isArray(value)) {
      return value
        .slice(0, 20)
        .map((entry) => toSerializable(entry, depth + 1));
    }

    if (value instanceof Uint8Array) {
      return { type: "Uint8Array", length: value.length };
    }

    if (value instanceof Error) {
      return { name: value.name, message: value.message };
    }

    if (typeof value.toBase58 === "function") {
      try {
        return value.toBase58();
      } catch {
        return "[toBase58 failed]";
      }
    }

    if (typeof value === "object") {
      const output = {};
      for (const key of Object.keys(value).slice(0, 20)) {
        output[key] = toSerializable(value[key], depth + 1);
      }
      return output;
    }

    return String(value);
  }

  function postEvent(payload) {
    try {
      console.info("[Sol Trace]", payload);
    } catch {
      // Ignore console issues.
    }

    try {
      window.dispatchEvent(
        new CustomEvent(BRIDGE_EVENT, {
          detail: payload,
        }),
      );
    } catch {
      // Ignore CustomEvent bridge issues.
    }

    try {
      window.postMessage(
        {
          type: BRIDGE_MESSAGE_TYPE,
          source: BRIDGE_SOURCE,
          payload,
        },
        "*",
      );
    } catch {
      // Ignore postMessage bridge issues.
    }
  }

  function summarizeInstruction(ix, index) {
    return {
      index,
      programId: toSerializable(ix?.programId),
      accountKeys: Array.isArray(ix?.keys)
        ? ix.keys.map((key) => ({
            pubkey: toSerializable(key?.pubkey),
            isSigner: Boolean(key?.isSigner),
            isWritable: Boolean(key?.isWritable),
          }))
        : [],
      dataLength: ix?.data?.length ?? ix?.data?.byteLength ?? null,
    };
  }

  function summarizeTransaction(tx) {
    if (!tx || typeof tx !== "object") {
      return null;
    }

    const instructions = Array.isArray(tx.instructions)
      ? tx.instructions.map((ix, index) => summarizeInstruction(ix, index))
      : [];

    return {
      feePayer: toSerializable(tx.feePayer),
      recentBlockhash: tx.recentBlockhash || null,
      instructionCount: instructions.length,
      accountCount: Array.isArray(tx?.accountKeys)
        ? tx.accountKeys.length
        : null,
      accounts: Array.isArray(tx?.accountKeys)
        ? tx.accountKeys.map((key) => ({
            pubkey: toSerializable(key?.pubkey || key),
            isSigner: Boolean(key?.isSigner),
            isWritable: Boolean(key?.isWritable),
          }))
        : [],
      instructions,
    };
  }

  function summarizeTransactionLike(value) {
    if (!value) {
      return null;
    }

    if (Array.isArray(value)) {
      return value.map((item) => summarizeTransactionLike(item));
    }

    if (typeof value !== "object") {
      return toSerializable(value);
    }

    const tx = summarizeTransaction(value);
    if (tx) {
      return tx;
    }

    const output = {};
    for (const key of Object.keys(value).slice(0, 30)) {
      output[key] = toSerializable(value[key]);
    }

    return output;
  }

  function emitBefore(kind, method, params, extra = {}) {
    postEvent({
      kind,
      phase: "BEFORE",
      method,
      params: toSerializable(params),
      at: now(),
      url: location.href,
      ...extra,
    });
  }

  function emitAfter(kind, method, startedAt, result, error, callId) {
    const payload = {
      kind,
      phase: "AFTER",
      method,
      durationMs: now() - startedAt,
      at: now(),
      url: location.href,
      callId,
    };

    if (error) {
      payload.error = toSerializable(error);
    } else {
      payload.result = toSerializable(result);
    }

    postEvent(payload);
  }

  function emitFunctionCall(label, method, args, extra = {}) {
    const startedAt = now();
    emitBefore(label, method, args, extra);
    return startedAt;
  }

  function emitFunctionResult(label, method, startedAt, result, error) {
    emitAfter(label, method, startedAt, result, error);
  }

  function wrapFunction(target, method, label, beforeBuilder) {
    if (!target || typeof target[method] !== "function") {
      return;
    }

    const original = target[method];
    if (wrappedFns.has(original)) {
      return;
    }

    const wrapped = async function wrappedFunction(...args) {
      const startedAt = now();
      const callId = createCallId(method);
      const extra = beforeBuilder ? beforeBuilder(args) : {};
      emitBefore(label, method, args, { callId, ...extra });

      try {
        const result = await original.apply(this, args);
        emitAfter(label, method, startedAt, result, null, callId);
        return result;
      } catch (error) {
        emitAfter(label, method, startedAt, null, error, callId);
        throw error;
      }
    };

    if (
      !installWrappedMethod(target, method, wrapped, label || "wrapFunction")
    ) {
      return;
    }

    wrappedFns.add(original);
  }

  function wrapMethod(target, method, kind, beforeBuilder) {
    if (!target || typeof target[method] !== "function") {
      return;
    }

    const original = target[method];
    if (wrappedFns.has(original)) {
      return;
    }

    const wrapped = async function wrappedMethod(...args) {
      const startedAt = now();
      const callId = createCallId(method);
      const extra = beforeBuilder ? beforeBuilder(args) : {};
      emitBefore(kind, method, args, { callId, ...extra });

      try {
        const result = await original.apply(this, args);
        emitAfter(kind, method, startedAt, result, null, callId);
        return result;
      } catch (error) {
        emitAfter(kind, method, startedAt, null, error, callId);
        throw error;
      }
    };

    if (!installWrappedMethod(target, method, wrapped, kind || "wrapMethod")) {
      return;
    }

    wrappedFns.add(original);
  }

  function hookConnectionPrototype() {
    const web3Global = window.solanaWeb3;
    const Connection = web3Global?.Connection;
    if (!Connection?.prototype) {
      return false;
    }

    const target = Connection.prototype;
    if (wrappedTargets.has(target)) {
      return true;
    }

    READ_METHODS.forEach((method) => wrapMethod(target, method, "READ"));
    wrappedTargets.add(target);

    postEvent({
      kind: "SYSTEM",
      phase: "INFO",
      method: "hookConnectionPrototype",
      at: now(),
      url: location.href,
      result: "READ hooks installed on Connection.prototype",
    });

    return true;
  }

  function walletBeforeBuilder(args) {
    const tx = args[0];
    return {
      txPreview: summarizeTransaction(tx),
    };
  }

  function requestBeforeBuilder(args) {
    const payload = args[0] || {};
    const method =
      typeof payload?.method === "string" ? payload.method : "request";
    const params = Array.isArray(payload?.params) ? payload.params : [];

    return {
      requestMethod: method,
      requestParams: toSerializable(params),
      requestSummary: {
        count: params.length,
        decoded: summarizeTransactionLike(params),
      },
    };
  }

  function anchorProviderBeforeBuilder(args) {
    const transactions = args[0];
    const connection = args[1];
    const signers = args[2];

    return {
      connection: toSerializable(connection),
      signerCount: Array.isArray(signers) ? signers.length : null,
      txPreview: summarizeTransactionLike(transactions),
    };
  }

  function hookWallet(wallet) {
    if (!wallet || wrappedTargets.has(wallet)) {
      return false;
    }

    WALLET_METHODS.forEach((method) => {
      const beforeBuilder =
        method === "request" ? requestBeforeBuilder : walletBeforeBuilder;
      wrapFunction(wallet, method, "WRITE", beforeBuilder);
    });

    wrappedTargets.add(wallet);
    postEvent({
      kind: "SYSTEM",
      phase: "INFO",
      method: "hookWallet",
      at: now(),
      url: location.href,
      result: "WRITE hooks installed on wallet provider",
    });

    return true;
  }

  function resolvePath(root, path) {
    let current = root;
    for (const segment of path) {
      if (!current) {
        return null;
      }

      current = current[segment];
    }

    return current;
  }

  function hookDiscoveredWallets() {
    let hooked = false;

    for (const path of PROVIDER_ROOTS) {
      try {
        const wallet = resolvePath(window, path);
        if (hookWallet(wallet)) {
          hooked = true;
        }
      } catch (error) {
        reportHookIssue("providerRoot", path.join("."), error);
      }
    }

    return hooked;
  }

  function hookAnchorProvider() {
    const anchorGlobal = window.anchor;
    const providerProto = anchorGlobal?.AnchorProvider?.prototype;

    if (!providerProto || wrappedTargets.has(providerProto)) {
      return false;
    }

    ANCHOR_PROVIDER_METHODS.forEach((method) => {
      wrapFunction(providerProto, method, "WRITE", anchorProviderBeforeBuilder);
    });

    wrappedTargets.add(providerProto);
    postEvent({
      kind: "SYSTEM",
      phase: "INFO",
      method: "hookAnchorProvider",
      at: now(),
      url: location.href,
      result: "Anchor provider hooks installed",
    });

    return true;
  }

  function scanAndHook() {
    try {
      hookConnectionPrototype();
    } catch (error) {
      reportHookIssue("scan", "hookConnectionPrototype", error);
    }

    try {
      hookAnchorProvider();
    } catch (error) {
      reportHookIssue("scan", "hookAnchorProvider", error);
    }

    try {
      hookDiscoveredWallets();
    } catch (error) {
      reportHookIssue("scan", "hookDiscoveredWallets", error);
    }

    try {
      if (window.solana) {
        hookWallet(window.solana);
      }

      if (window.phantom?.solana) {
        hookWallet(window.phantom.solana);
      }
    } catch (error) {
      reportHookIssue("scan", "walletFallback", error);
    }
  }

  const intervalId = window.setInterval(scanAndHook, 700);
  scanAndHook();

  postEvent({
    kind: "SYSTEM",
    phase: "INFO",
    method: "inpageHookReady",
    at: now(),
    url: location.href,
    result: "Connection + wallet + network hooks initialized",
  });

  window.addEventListener("beforeunload", () => {
    clearInterval(intervalId);
  });
}
