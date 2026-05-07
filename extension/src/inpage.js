let web3ConstructorsPromise = null;

async function waitForWeb3Global(timeoutMs = 3000) {
  if (window.solanaWeb3) {
    return window.solanaWeb3;
  }

  return new Promise((resolve) => {
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      if (window.solanaWeb3) {
        window.clearInterval(timer);
        resolve(window.solanaWeb3);
        return;
      }

      if (Date.now() - startedAt >= timeoutMs) {
        window.clearInterval(timer);
        resolve(null);
      }
    }, 100);
  });
}

async function getWeb3Constructors() {
  if (!web3ConstructorsPromise) {
    web3ConstructorsPromise = new Promise((resolve, reject) => {
      const resolveFromGlobal = (solanaWeb3) => {
        resolve({
          Connection: solanaWeb3.Connection,
          PublicKey: solanaWeb3.PublicKey,
          Transaction: solanaWeb3.Transaction,
          TransactionInstruction: solanaWeb3.TransactionInstruction,
        });
      };

      waitForWeb3Global().then((solanaWeb3) => {
        if (solanaWeb3) {
          resolveFromGlobal(solanaWeb3);
          return;
        }

        const script = document.createElement("script");
        script.async = false;
        script.dataset.solTraceWeb3Loader = "1";
        script.src =
          "https://unpkg.com/@solana/web3.js@1.98.4/lib/index.iife.js";
        script.onload = async () => {
          const loadedWeb3 =
            window.solanaWeb3 || (await waitForWeb3Global(1000));
          if (!loadedWeb3) {
            reject(
              new Error(
                "Solana web3.js loaded but window.solanaWeb3 is unavailable",
              ),
            );
            return;
          }

          resolveFromGlobal(loadedWeb3);
        };
        script.onerror = () => {
          reject(new Error("Failed to load Solana web3.js library"));
        };

        (document.head || document.documentElement).appendChild(script);
      });
    });
  }

  return web3ConstructorsPromise;
}

const BRIDGE_EVENT = "__DEVTOOLS_SOLANA_BRIDGE__";
const BRIDGE_MESSAGE_TYPE = "__DEVTOOLS_SOLANA_BRIDGE_MESSAGE__";
const BRIDGE_SOURCE = "sol-trace-inpage";
const REPLAY_COMMAND = "SOL_TRACE_REPLAY_COMMAND";
const REPLAY_RESPONSE = "SOL_TRACE_REPLAY_RESPONSE";

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

  function getProviderCandidates() {
    return [
      window.solana,
      window.backpack?.solana,
      window.phantom?.solana,
      window.solflare,
      window.okxwallet?.solana,
      window.bitgetwallet?.solana,
      window.coin98?.solana,
      window.glow?.solana,
      window.anchor?.provider?.wallet,
    ].filter(Boolean);
  }

  function getWalletProvider() {
    return getProviderCandidates().find(
      (provider) =>
        typeof provider.signTransaction === "function" ||
        typeof provider.signAndSendTransaction === "function",
    );
  }

  async function toPublicKey(value) {
    if (!value) {
      return null;
    }

    try {
      const { PublicKey } = await getWeb3Constructors();
      return new PublicKey(
        typeof value === "string" ? value : value.pubkey || value.publicKey,
      );
    } catch {
      return null;
    }
  }

  function decodeReplayInstructionData(data) {
    const normalized = normalizeInstructionData(data);
    return normalized.bytes || new Uint8Array();
  }

  function getTransactionAccountKeys(txData) {
    const message =
      txData?.transaction?.message || txData?.value?.transaction?.message || {};
    return (message.accountKeys || message.staticAccountKeys || [])
      .map((entry) =>
        typeof entry === "string" ? entry : entry?.pubkey || entry?.publicKey,
      )
      .filter(Boolean);
  }

  function getTransactionMeta(txData) {
    return txData?.meta || txData?.value?.meta || txData?.result?.meta || {};
  }

  function buildStateChangeRows(txData) {
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
      const before = preBalances[index];
      const after = postBalances[index];
      if (before === undefined && after === undefined) {
        continue;
      }

      if (before === after) {
        continue;
      }

      rows.push({
        kind: "lamports",
        account: accountKeys[index] || `Account ${index}`,
        accountIndex: index,
        label: `Account ${index}`,
        beforeValue: `${(before / 1_000_000_000).toFixed(6)} SOL (${before} lamports)`,
        afterValue: `${(after / 1_000_000_000).toFixed(6)} SOL (${after} lamports)`,
        rawBefore: before,
        rawAfter: after,
        delta:
          typeof before === "number" && typeof after === "number"
            ? after - before
            : null,
      });
    }

    return rows;
  }

  function mergeLogs(...sources) {
    const merged = [];
    const seen = new Set();

    for (const source of sources) {
      if (!Array.isArray(source)) {
        continue;
      }

      for (const entry of source) {
        if (typeof entry !== "string" || !entry.trim()) {
          continue;
        }

        const key = entry.trim();
        if (seen.has(key)) {
          continue;
        }

        seen.add(key);
        merged.push(entry);
      }
    }

    return merged;
  }

  async function buildReplayTransaction(txDetails) {
    const transaction = txDetails?.transaction || txDetails;
    const message = transaction?.message;

    if (!message || !Array.isArray(message.accountKeys)) {
      return null;
    }

    const { Transaction, TransactionInstruction } = await getWeb3Constructors();
    const tx = new Transaction();
    const accountKeys = message.accountKeys.map((entry) =>
      typeof entry === "string" ? entry : entry?.pubkey || entry?.publicKey,
    );

    const feePayer =
      transaction?.feePayer || message.feePayer || accountKeys[0] || null;
    const recentBlockhash =
      transaction?.recentBlockhash || message.recentBlockhash || null;

    if (feePayer) {
      const payerKey = await toPublicKey(feePayer);
      if (payerKey) {
        tx.feePayer = payerKey;
      }
    }

    if (recentBlockhash) {
      tx.recentBlockhash = String(recentBlockhash);
    }

    const instructions = Array.isArray(message.instructions)
      ? message.instructions
      : [];

    for (const instruction of instructions) {
      const programId =
        typeof instruction.programId === "string"
          ? instruction.programId
          : accountKeys[instruction.programIdIndex] || null;
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
          accountIndexes.map(async (index) => {
            const accountMeta = message.accountKeys[index];
            const address =
              typeof accountMeta === "string"
                ? accountMeta
                : accountMeta?.pubkey || accountMeta?.publicKey;
            const pubkey = await toPublicKey(address);
            if (!pubkey) {
              return null;
            }

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

      tx.add(
        new TransactionInstruction({
          programId: programKey,
          keys,
          data: decodeReplayInstructionData(instruction.data),
        }),
      );
    }

    return tx;
  }

  function encodeBytesToBase64(bytes) {
    if (!(bytes instanceof Uint8Array) || bytes.length === 0) {
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

  async function rpcRequest(rpcEndpoint, method, params) {
    const response = await fetch(rpcEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: Date.now(),
        method,
        params,
      }),
    }).then((result) => result.json());

    if (response?.error) {
      throw new Error(response.error.message || `RPC ${method} failed`);
    }

    return response?.result;
  }

  async function waitForTransaction(rpcEndpoint, signature, attempts = 12) {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const tx = await rpcRequest(rpcEndpoint, "getTransaction", [
        signature,
        {
          encoding: "json",
          maxSupportedTransactionVersion: 0,
        },
      ]);

      if (tx) {
        return tx;
      }

      await new Promise((resolve) => setTimeout(resolve, 1200));
    }

    return null;
  }

  async function simulateWithWallet(txDetails, rpcEndpoint) {
    const wallet = getWalletProvider();
    if (!wallet?.signTransaction && !wallet?.signAndSendTransaction) {
      throw new Error("No wallet provider available for mock replay");
    }

    // Priority 1: Try to use the original serialized transaction bytes (most accurate)
    const candidate =
      txDetails?.transaction?.serialized ||
      txDetails?.transaction?.serializedTx ||
      txDetails?.serialized ||
      txDetails?.raw?.serialized ||
      null;

    if (candidate) {
      let base64 = null;
      if (candidate instanceof Uint8Array || Array.isArray(candidate)) {
        base64 = encodeBytesToBase64(
          candidate instanceof Uint8Array
            ? candidate
            : Uint8Array.from(candidate),
        );
      } else if (typeof candidate === "string") {
        base64 = candidate;
      }

      if (base64) {
        try {
          const simulation = await rpcRequest(
            rpcEndpoint,
            "simulateTransaction",
            [
              base64,
              {
                encoding: "base64",
                sigVerify: false,
                replaceRecentBlockhash: true,
                commitment: "confirmed",
              },
            ],
          );
          const value = simulation?.value || simulation || {};
          const meta = getTransactionMeta(txDetails);

          return {
            mode: "mock",
            fee: meta.fee || 0,
            computeUnits:
              value.unitsConsumed ??
              value.computeUnitsConsumed ??
              meta.computeUnitsConsumed ??
              0,
            logs: mergeLogs(value.logs || [], meta.logMessages || []),
            stateChanges: buildStateChangeRows(txDetails),
            status: value.err || meta.err ? "failed" : "succeeded",
            error: value.err || meta.err || null,
            replayType: "raw-serialized-simulate",
          };
        } catch (err) {
          console.warn("Serialized simulation failed, trying reconstruction:", err);
        }
      }
    }

    // Priority 2: Try to reconstruct Transaction object (requires web3.js in page)
    const tx = await buildReplayTransaction(txDetails);
    if (tx) {
      try {
        const signedTx = await wallet.signTransaction(tx);
        const signedBytes = signedTx.serialize({
          requireAllSignatures: false,
          verifySignatures: false,
        });
        const serializedTx = encodeBytesToBase64(signedBytes);
        const simulation = await rpcRequest(
          rpcEndpoint,
          "simulateTransaction",
          [
            serializedTx,
            {
              encoding: "base64",
              sigVerify: false,
              replaceRecentBlockhash: true,
              commitment: "confirmed",
            },
          ],
        );

        const value = simulation?.value || simulation || {};
        const meta = getTransactionMeta(txDetails);

        return {
          mode: "mock",
          fee: meta.fee || 0,
          computeUnits:
            value.unitsConsumed ??
            value.computeUnitsConsumed ??
            meta.computeUnitsConsumed ??
            0,
          logs: mergeLogs(value.logs || [], meta.logMessages || []),
          stateChanges: buildStateChangeRows(txDetails),
          status: value.err || meta.err ? "failed" : "succeeded",
          error: value.err || meta.err || null,
          replayType: "wallet-confirmed-simulate",
        };
      } catch (err) {
        throw new Error(
          "Simulation failed: " +
            err.message +
            " (Make sure the page has window.solanaWeb3 available)",
        );
      }
    }

    throw new Error(
      "Cannot replay transaction: This page needs to load the Solana web3.js library. " +
        "Please ensure @solana/web3.js is available as window.solanaWeb3 on this page.",
    );
  }

  async function replayOnChain(txDetails, rpcEndpoint) {
    const wallet = getWalletProvider();
    if (!wallet) {
      throw new Error("No wallet provider available for on-chain replay");
    }

    // The only reliable way to replay transactions is to reconstruct the Transaction object
    // This requires window.solanaWeb3 (web3.js library) to be available on the page
    const tx = await buildReplayTransaction(txDetails);
    if (!tx) {
      throw new Error(
        "Cannot replay transaction: This page needs to load the Solana web3.js library. " +
          "Please ensure @solana/web3.js is available as window.solanaWeb3 on this page.",
      );
    }

    let signature = null;

    try {
      const { Connection } = await getWeb3Constructors();
      const connection = new Connection(rpcEndpoint, "confirmed");

      if (typeof wallet.sendTransaction === "function") {
        try {
          const response = await wallet.sendTransaction(tx, connection, {
            skipPreflight: false,
            preflightCommitment: "confirmed",
            maxRetries: 3,
          });
          signature =
            typeof response === "string"
              ? response
              : response?.signature || response?.txid || null;
        } catch {
          signature = null;
        }
      }

      if (typeof wallet.signAndSendTransaction === "function") {
        try {
          const response = await wallet.signAndSendTransaction(tx);
          signature =
            typeof response === "string"
              ? response
              : response?.signature || response?.txid || null;
        } catch {
          const signedTx = await wallet.signTransaction(tx);
          const signedBytes = signedTx.serialize({
            requireAllSignatures: false,
            verifySignatures: false,
          });
          const serializedTx = encodeBytesToBase64(signedBytes);
          signature = await rpcRequest(rpcEndpoint, "sendTransaction", [
            serializedTx,
            {
              encoding: "base64",
              skipPreflight: false,
              preflightCommitment: "confirmed",
              maxRetries: 3,
            },
          ]);
        }
      } else if (typeof wallet.signTransaction === "function") {
        const signedTx = await wallet.signTransaction(tx);
        const signedBytes = signedTx.serialize({
          requireAllSignatures: false,
          verifySignatures: false,
        });
        const serializedTx = encodeBytesToBase64(signedBytes);
        signature = await rpcRequest(rpcEndpoint, "sendTransaction", [
          serializedTx,
          {
            encoding: "base64",
            skipPreflight: false,
            preflightCommitment: "confirmed",
            maxRetries: 3,
          },
        ]);
      }

      if (!signature) {
        throw new Error("Wallet did not return a valid signature");
      }

      const transaction = await waitForTransaction(rpcEndpoint, signature);
      const meta = transaction
        ? getTransactionMeta(transaction)
        : getTransactionMeta(txDetails);
      const txMeta = getTransactionMeta(txDetails);

      return {
        mode: "real",
        signature,
        fee: meta.fee || 0,
        computeUnits: meta.computeUnitsConsumed || 0,
        logs: mergeLogs(meta.logMessages || [], txMeta.logMessages || []),
        stateChanges: buildStateChangeRows(transaction || txDetails),
        status: meta.err ? "failed" : "succeeded",
        error: meta.err || null,
        replayType: "wallet-confirmed-onchain",
        slot: transaction?.slot || null,
      };
    } catch (err) {
      throw new Error(
        "On-chain replay failed: " +
          err.message +
          " (Make sure the page has window.solanaWeb3 available)",
      );
    }
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
    const ConnectionCtor = window.solanaWeb3?.Connection;
    if (!ConnectionCtor?.prototype) {
      return false;
    }

    const target = ConnectionCtor.prototype;
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

  function watchProviderPath(path) {
    if (!Array.isArray(path) || path.length === 0) {
      return;
    }

    try {
      const [rootKey, ...rest] = path;

      if (rest.length === 0) {
        const descriptor = Object.getOwnPropertyDescriptor(window, rootKey);
        if (descriptor?.configurable === false) {
          return;
        }

        let storedValue = window[rootKey];
        if (storedValue) {
          hookWallet(storedValue);
        }

        Object.defineProperty(window, rootKey, {
          configurable: true,
          enumerable: true,
          get() {
            return storedValue;
          },
          set(nextValue) {
            storedValue = nextValue;
            if (nextValue) {
              try {
                hookWallet(nextValue);
              } catch (error) {
                reportHookIssue("providerPath", path.join("."), error);
              }
            }
          },
        });
        return;
      }

      const parent = resolvePath(window, [rootKey, ...rest.slice(0, -1)]);
      const leafKey = rest[rest.length - 1];
      if (!parent || typeof parent !== "object") {
        return;
      }

      const descriptor = Object.getOwnPropertyDescriptor(parent, leafKey);
      if (descriptor?.configurable === false) {
        return;
      }

      let storedValue = parent[leafKey];
      if (storedValue) {
        hookWallet(storedValue);
      }

      Object.defineProperty(parent, leafKey, {
        configurable: true,
        enumerable: true,
        get() {
          return storedValue;
        },
        set(nextValue) {
          storedValue = nextValue;
          if (nextValue) {
            try {
              hookWallet(nextValue);
            } catch (error) {
              reportHookIssue("providerPath", path.join("."), error);
            }
          }
        },
      });
    } catch (error) {
      reportHookIssue("providerPath", path.join("."), error);
    }
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

      watchProviderPath(["solana"]);
      watchProviderPath(["phantom", "solana"]);
      watchProviderPath(["backpack", "solana"]);
      watchProviderPath(["solflare"]);
      watchProviderPath(["okxwallet", "solana"]);
      watchProviderPath(["bitgetwallet", "solana"]);
      watchProviderPath(["coin98", "solana"]);
      watchProviderPath(["glow", "solana"]);
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

  window.addEventListener("message", async (event) => {
    if (event.source !== window) {
      return;
    }

    const data = event?.data;
    if (
      !data ||
      data.type !== BRIDGE_MESSAGE_TYPE ||
      data.source !== BRIDGE_SOURCE
    ) {
      return;
    }

    const payload = data.payload || {};
    if (payload.kind !== REPLAY_COMMAND) {
      return;
    }

    const { requestId, command } = payload;
    try {
      const result =
        command?.mode === "real"
          ? await replayOnChain(command.txDetails, command.rpcEndpoint)
          : await simulateWithWallet(command.txDetails, command.rpcEndpoint);

      window.postMessage(
        {
          type: BRIDGE_MESSAGE_TYPE,
          source: BRIDGE_SOURCE,
          payload: {
            kind: REPLAY_RESPONSE,
            requestId,
            ok: true,
            result,
          },
        },
        "*",
      );
    } catch (error) {
      window.postMessage(
        {
          type: BRIDGE_MESSAGE_TYPE,
          source: BRIDGE_SOURCE,
          payload: {
            kind: REPLAY_RESPONSE,
            requestId,
            ok: false,
            error: error?.message || String(error),
          },
        },
        "*",
      );
    }
  });

  window.addEventListener("beforeunload", () => {
    clearInterval(intervalId);
  });
}
