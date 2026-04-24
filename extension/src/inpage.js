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
  const textDecoder = new TextDecoder();

  const SYSTEM_PROGRAM_ID = "11111111111111111111111111111111";
  const TOKEN_PROGRAM_ID = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
  const TOKEN_2022_PROGRAM_ID = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
  const ASSOCIATED_TOKEN_PROGRAM_ID =
    "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
  const MEMO_PROGRAM_ID = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";
  const MEMO_PROGRAM_V2_ID = "Memo1UhkJRfHyvLMcVucJwxXeuD728EqVDDwQDxFMNo";
  const COMPUTE_BUDGET_PROGRAM_ID =
    "ComputeBudget111111111111111111111111111111";
  const BASE58_ALPHABET =
    "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  const BASE58_MAP = BASE58_ALPHABET.split("").reduce((acc, ch, idx) => {
    acc[ch] = idx;
    return acc;
  }, {});

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

  function readU32LE(bytes, offset = 0) {
    if (!bytes || bytes.length < offset + 4) {
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

  function readU64LE(bytes, offset = 0) {
    if (!bytes || bytes.length < offset + 8) {
      return null;
    }

    try {
      const view = new DataView(
        bytes.buffer,
        bytes.byteOffset,
        bytes.byteLength,
      );
      return view.getBigUint64(offset, true).toString();
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

  function tryDecodeBase58(value) {
    if (
      typeof value !== "string" ||
      value.length === 0 ||
      !/^[1-9A-HJ-NP-Za-km-z]+$/.test(value)
    ) {
      return null;
    }

    const bytes = [0];
    for (const char of value) {
      const mapped = BASE58_MAP[char];
      if (mapped === undefined) {
        return null;
      }

      let carry = mapped;
      for (let j = 0; j < bytes.length; j += 1) {
        const x = bytes[j] * 58 + carry;
        bytes[j] = x & 0xff;
        carry = x >> 8;
      }

      while (carry > 0) {
        bytes.push(carry & 0xff);
        carry >>= 8;
      }
    }

    let leading = 0;
    while (leading < value.length && value[leading] === "1") {
      leading += 1;
    }

    return Uint8Array.from([...new Array(leading).fill(0), ...bytes.reverse()]);
  }

  function tryDecodeBase64(value) {
    if (
      typeof value !== "string" ||
      value.length === 0 ||
      value.length % 4 !== 0 ||
      !/^[A-Za-z0-9+/=]+$/.test(value)
    ) {
      return null;
    }

    try {
      const raw = atob(value);
      return Uint8Array.from(raw, (ch) => ch.charCodeAt(0));
    } catch {
      return null;
    }
  }

  function normalizeInstructionData(raw) {
    if (!raw) {
      return { bytes: null, encoding: null };
    }

    if (raw instanceof Uint8Array) {
      return { bytes: raw, encoding: "bytes" };
    }

    if (Array.isArray(raw) && raw.every((n) => typeof n === "number")) {
      return { bytes: Uint8Array.from(raw), encoding: "array" };
    }

    if (typeof raw === "string") {
      const b58 = tryDecodeBase58(raw);
      if (b58) {
        return { bytes: b58, encoding: "base58" };
      }

      const b64 = tryDecodeBase64(raw);
      if (b64) {
        return { bytes: b64, encoding: "base64" };
      }
    }

    return { bytes: null, encoding: null };
  }

  function decodeSystemInstruction(bytes) {
    if (!(bytes instanceof Uint8Array) || bytes.length < 4) {
      return null;
    }

    const discriminator = readU32LE(bytes, 0);
    const amount = readU64LE(bytes, 4);
    const map = {
      0: "CreateAccount",
      1: "Assign",
      2: "Transfer",
      3: "CreateAccountWithSeed",
      4: "AdvanceNonceAccount",
      5: "WithdrawNonceAccount",
      6: "InitializeNonceAccount",
      7: "AuthorizeNonceAccount",
      8: "Allocate",
      9: "AllocateWithSeed",
      10: "AssignWithSeed",
      11: "TransferWithSeed",
      12: "UpgradeNonceAccount",
    };

    return {
      program: "System Program",
      instructionType: map[discriminator] || `Unknown(${discriminator})`,
      discriminator,
      lamports:
        discriminator === 0 ||
        discriminator === 2 ||
        discriminator === 5 ||
        discriminator === 11
          ? amount
          : undefined,
      allocatedSpace:
        discriminator === 0 || discriminator === 8
          ? readU64LE(bytes, 12)
          : undefined,
    };
  }

  function decodeTokenInstruction(bytes, token2022 = false) {
    if (!(bytes instanceof Uint8Array) || bytes.length < 1) {
      return null;
    }

    const discriminator = bytes[0];
    const map = {
      0: "InitializeMint",
      1: "InitializeAccount",
      2: "InitializeMultisig",
      3: "Transfer",
      4: "Approve",
      5: "Revoke",
      6: "SetAuthority",
      7: "MintTo",
      8: "Burn",
      9: "CloseAccount",
      10: "FreezeAccount",
      11: "ThawAccount",
      12: "TransferChecked",
      13: "ApproveChecked",
      14: "MintToChecked",
      15: "BurnChecked",
      16: "InitializeAccount2",
      17: "SyncNative",
      18: "InitializeAccount3",
      19: "InitializeMultisig2",
      20: "InitializeMint2",
      21: "GetAccountDataSize",
      22: "InitializeImmutableOwner",
      23: "AmountToUiAmount",
      24: "UiAmountToAmount",
      25: "InitializeMintCloseAuthority",
      26: "TransferFeeExtension",
      27: "ConfidentialTransferExtension",
      28: "DefaultAccountStateExtension",
      29: "Reallocate",
      30: "MemoTransferExtension",
      31: "CreateNativeMint",
      32: "InitializeNonTransferableMint",
      33: "InterestBearingMintExtension",
      34: "CpiGuardExtension",
      35: "InitializePermanentDelegate",
      36: "TransferHookExtension",
      37: "ConfidentialTransferFeeExtension",
      38: "WithdrawExcessLamports",
      39: "MetadataPointerExtension",
      40: "GroupPointerExtension",
      41: "GroupMemberPointerExtension",
    };

    const hasAmount = [3, 4, 7, 8, 12, 13, 14, 15].includes(discriminator);
    const amount = hasAmount ? readU64LE(bytes, 1) : undefined;
    const decimals =
      discriminator === 12 ||
      discriminator === 13 ||
      discriminator === 14 ||
      discriminator === 15
        ? bytes[9]
        : undefined;

    return {
      program: token2022 ? "SPL Token 2022" : "SPL Token",
      instructionType: map[discriminator] || `Unknown(${discriminator})`,
      discriminator,
      amount,
      decimals,
    };
  }

  function decodeAssociatedTokenInstruction(bytes) {
    const discriminator =
      bytes instanceof Uint8Array && bytes.length > 0 ? bytes[0] : 0;
    const map = {
      0: "Create",
      1: "CreateIdempotent",
      2: "RecoverNested",
    };

    return {
      program: "Associated Token Program",
      instructionType: map[discriminator] || `Unknown(${discriminator})`,
      discriminator,
    };
  }

  function decodeComputeBudgetInstruction(bytes) {
    if (!(bytes instanceof Uint8Array) || bytes.length < 1) {
      return null;
    }

    const discriminator = bytes[0];
    const map = {
      0: "RequestUnitsDeprecated",
      1: "RequestHeapFrame",
      2: "SetComputeUnitLimit",
      3: "SetComputeUnitPrice",
      4: "SetLoadedAccountsDataSizeLimit",
    };

    return {
      program: "Compute Budget Program",
      instructionType: map[discriminator] || `Unknown(${discriminator})`,
      discriminator,
      units:
        discriminator === 0 || discriminator === 2
          ? readU32LE(bytes, 1)
          : undefined,
      heapBytes:
        discriminator === 1 || discriminator === 4
          ? readU32LE(bytes, 1)
          : undefined,
      microLamports: discriminator === 3 ? readU64LE(bytes, 1) : undefined,
      additionalFee: discriminator === 0 ? readU32LE(bytes, 5) : undefined,
    };
  }

  function decodeMemoInstruction(bytes) {
    if (!(bytes instanceof Uint8Array)) {
      return null;
    }

    let text = "";
    try {
      text = textDecoder.decode(bytes);
    } catch {
      text = "";
    }

    return {
      program: "Memo Program",
      instructionType: "Memo",
      memo: text,
    };
  }

  function decodeAnchorDiscriminator(bytes) {
    if (!(bytes instanceof Uint8Array) || bytes.length < 8) {
      return null;
    }

    return {
      instructionType: "AnchorInstruction",
      anchorDiscriminatorHex: bytesToHex(bytes.slice(0, 8), 8).replace(
        / /g,
        "",
      ),
    };
  }

  function decodeInstructionData(programId, bytes) {
    if (!(bytes instanceof Uint8Array) || !programId) {
      return null;
    }

    if (programId === SYSTEM_PROGRAM_ID) {
      return decodeSystemInstruction(bytes);
    }

    if (programId === TOKEN_PROGRAM_ID) {
      return decodeTokenInstruction(bytes, false);
    }

    if (programId === TOKEN_2022_PROGRAM_ID) {
      return decodeTokenInstruction(bytes, true);
    }

    if (programId === ASSOCIATED_TOKEN_PROGRAM_ID) {
      return decodeAssociatedTokenInstruction(bytes);
    }

    if (programId === COMPUTE_BUDGET_PROGRAM_ID) {
      return decodeComputeBudgetInstruction(bytes);
    }

    if (programId === MEMO_PROGRAM_ID || programId === MEMO_PROGRAM_V2_ID) {
      return decodeMemoInstruction(bytes);
    }

    return decodeAnchorDiscriminator(bytes);
  }

  function normalizePubkey(value) {
    if (!value) {
      return null;
    }

    if (typeof value === "string") {
      return value;
    }

    if (typeof value?.pubkey === "string") {
      return value.pubkey;
    }

    if (typeof value?.toBase58 === "function") {
      try {
        return value.toBase58();
      } catch {
        return null;
      }
    }

    const serialized = toSerializable(value);
    return typeof serialized === "string" ? serialized : null;
  }

  function summarizeAccountState(account) {
    if (!account || typeof account !== "object") {
      return null;
    }

    const data = account.data;
    const parsed =
      data && typeof data === "object" && !Array.isArray(data)
        ? data.parsed
        : null;

    let dataEncoding = null;
    let dataLength = null;
    if (Array.isArray(data)) {
      dataEncoding = typeof data[1] === "string" ? data[1] : "unknown";
      if (typeof data[0] === "string") {
        const normalized = normalizeInstructionData(data[0]);
        dataLength = normalized.bytes?.length ?? null;
      }
    } else if (typeof data === "string") {
      const normalized = normalizeInstructionData(data);
      dataLength = normalized.bytes?.length ?? data.length;
      dataEncoding = normalized.encoding || "string";
    } else if (data instanceof Uint8Array) {
      dataLength = data.length;
      dataEncoding = "bytes";
    } else if (parsed) {
      dataEncoding = "jsonParsed";
    }

    return {
      lamports:
        typeof account.lamports === "number" ? account.lamports : undefined,
      owner: normalizePubkey(account.owner),
      executable: Boolean(account.executable),
      rentEpoch:
        account.rentEpoch !== undefined
          ? toSerializable(account.rentEpoch)
          : undefined,
      space: typeof account.space === "number" ? account.space : undefined,
      dataEncoding,
      dataLength,
      parsedType: parsed?.type || undefined,
      parsedInfo: parsed?.info ? toSerializable(parsed.info) : undefined,
    };
  }

  function summarizeReadRequest(method, args) {
    const first = args?.[0];
    const second = args?.[1];

    if (method === "getAccountInfo" || method === "getParsedAccountInfo") {
      return {
        targetAccount: normalizePubkey(first),
        commitment: second?.commitment || null,
        encoding: second?.encoding || null,
      };
    }

    if (method === "getMultipleAccountsInfo") {
      const accounts = Array.isArray(first)
        ? first.map((value) => normalizePubkey(value)).filter(Boolean)
        : [];
      return {
        accountCount: accounts.length,
        accounts: accounts.slice(0, 12),
        commitment: second?.commitment || null,
      };
    }

    if (
      method === "getProgramAccounts" ||
      method === "getParsedProgramAccounts"
    ) {
      return {
        programId: normalizePubkey(first),
        filterCount: Array.isArray(second?.filters) ? second.filters.length : 0,
        commitment: second?.commitment || null,
      };
    }

    if (method === "getTokenAccountsByOwner") {
      return {
        owner: normalizePubkey(first),
        filter: toSerializable(second),
      };
    }

    if (method === "getBalance") {
      return {
        targetAccount: normalizePubkey(first),
        commitment: second?.commitment || null,
      };
    }

    if (method === "getTokenAccountBalance") {
      return {
        tokenAccount: normalizePubkey(first),
        commitment: second?.commitment || null,
      };
    }

    return {
      argCount: Array.isArray(args) ? args.length : 0,
      argsPreview: toSerializable(args),
    };
  }

  function summarizeReadResult(method, result) {
    if (!result || typeof result !== "object") {
      return { valueType: typeof result };
    }

    if (method === "getBalance") {
      return {
        lamports: typeof result.value === "number" ? result.value : undefined,
        slot: result.context?.slot,
      };
    }

    if (method === "getTokenAccountBalance") {
      return {
        amount: result.value?.amount,
        decimals: result.value?.decimals,
        uiAmountString: result.value?.uiAmountString,
        slot: result.context?.slot,
      };
    }

    if (method === "getAccountInfo" || method === "getParsedAccountInfo") {
      return {
        slot: result.context?.slot,
        exists: Boolean(result.value),
        account: summarizeAccountState(result.value),
      };
    }

    if (method === "getMultipleAccountsInfo") {
      const list = Array.isArray(result.value)
        ? result.value
            .map((entry) => summarizeAccountState(entry))
            .filter(Boolean)
        : [];

      return {
        slot: result.context?.slot,
        accountCount: list.length,
        accounts: list.slice(0, 12),
      };
    }

    if (
      method === "getProgramAccounts" ||
      method === "getParsedProgramAccounts"
    ) {
      const list = Array.isArray(result)
        ? result
        : Array.isArray(result.value)
          ? result.value
          : [];

      return {
        accountCount: list.length,
        accounts: list.slice(0, 12).map((entry) => ({
          pubkey: normalizePubkey(entry?.pubkey),
          state: summarizeAccountState(entry?.account),
        })),
      };
    }

    if (method === "getTokenAccountsByOwner") {
      const list = Array.isArray(result.value) ? result.value : [];
      return {
        accountCount: list.length,
        accounts: list.slice(0, 12).map((entry) => ({
          pubkey: normalizePubkey(entry?.pubkey),
          state: summarizeAccountState(entry?.account),
        })),
      };
    }

    return {
      keys: Object.keys(result).slice(0, 12),
      preview: toSerializable(result),
    };
  }

  function readBeforeBuilder(method, args) {
    return {
      readRequest: summarizeReadRequest(method, args),
    };
  }

  function readAfterBuilder(method, result) {
    return {
      readResult: summarizeReadResult(method, result),
    };
  }

  function summarizeInstruction(ix, index) {
    const programId = toSerializable(ix?.programId);
    const programIdLabel =
      typeof programId === "string"
        ? programId
        : String(programId || "Unknown");
    const normalizedData = normalizeInstructionData(ix?.data);
    const decoded = decodeInstructionData(programIdLabel, normalizedData.bytes);

    return {
      index,
      programId: programIdLabel,
      accountKeys: Array.isArray(ix?.keys)
        ? ix.keys.map((key) => ({
            pubkey: toSerializable(key?.pubkey),
            isSigner: Boolean(key?.isSigner),
            isWritable: Boolean(key?.isWritable),
          }))
        : [],
      dataLength:
        normalizedData.bytes?.length ??
        ix?.data?.length ??
        ix?.data?.byteLength ??
        null,
      dataEncoding: normalizedData.encoding,
      dataPreviewHex: normalizedData.bytes
        ? bytesToHex(normalizedData.bytes, 24)
        : "",
      decoded,
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

  function emitAfter(
    kind,
    method,
    startedAt,
    result,
    error,
    callId,
    extra = {},
  ) {
    const payload = {
      kind,
      phase: "AFTER",
      method,
      durationMs: now() - startedAt,
      at: now(),
      url: location.href,
      callId,
      ...extra,
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

  function wrapFunction(target, method, label, beforeBuilder, afterBuilder) {
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
        const afterExtra = afterBuilder
          ? afterBuilder(method, result, args)
          : {};
        emitAfter(label, method, startedAt, result, null, callId, afterExtra);
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

  function wrapMethod(target, method, kind, beforeBuilder, afterBuilder) {
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
        const afterExtra = afterBuilder
          ? afterBuilder(method, result, args)
          : {};
        emitAfter(kind, method, startedAt, result, null, callId, afterExtra);
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

    READ_METHODS.forEach((method) =>
      wrapMethod(target, method, "READ", readBeforeBuilder, readAfterBuilder),
    );
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
