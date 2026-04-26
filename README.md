# ChronoTrace Solana
ChronoTrace Solana is the missing observability layer for Solana dApp teams.

Today, developers still debug one transaction across wallet popups, RPC payloads, explorer tabs, and raw logs. That fragmented workflow kills iteration speed and hides root causes. ChronoTrace turns it into one deterministic flow: capture, decode, inspect, explain.

## Why This Is Necessary (And Missing)

Solana has world-class execution speed, but not world-class execution visibility.

When a transaction fails, developers still ask basic questions manually:

- What exactly was sent from the dApp?
- Which accounts were touched, and how?
- Where did execution fail?
- Was the failure due to params, account state, or compute budget?
- How much compute and fee did this call consume?

ChronoTrace Solana answers these instantly in one place, during development, in DevTools context.

ChronoTrace Solana is not just a dashboard. It is developer infrastructure.

If Solana wants faster shipping cycles, fewer silent failures, and better UX in production dApps, this visibility layer is mandatory. We are building the equivalent of APM for on-chain transaction execution.

<img width="1535" height="727" alt="ChronoTrace panel" src="https://github.com/user-attachments/assets/f356f400-c56d-40e3-988b-3e6b84dab3ae" />

## Core Capabilities

- Live transaction interception
  - Hooks wallet/provider/connection calls at runtime
  - Captures request and response payloads immediately

- Multi-method wallet and RPC coverage
  - Tracks send/sign/signMessage/simulate flows, plus common read/write RPC calls
  - Preserves method-specific context so each trace stays semantically accurate

- Instruction and parameter decoding
  - Shows method-level and instruction-level intent
  - Decodes common Solana programs (System, SPL Token, Token-2022, ATA, Compute Budget, Memo) plus Anchor hints

- Raw payload and decoded view side-by-side
  - Keeps original payloads for low-level verification
  - Surfaces interpreted values for fast human understanding

- Account interaction visibility
  - Lists touched accounts with signer/writable/program roles
  - Identifies fee payer and account role in transaction context
  - Pulls account context/state for deeper debugging
  - Surfaces metadata like executable flag, owner program, lamports, rent epoch, and data size

- Account storage inspection
  - Fetches account data in batches for transaction-relevant accounts
  - Applies binary heuristics to reveal meaningful fields beyond base64 blobs
  - Helps distinguish account behavior (program/account/data holder) with human-readable hints

- Error and log intelligence
  - Parses structured logs
  - Surfaces human-readable failure clues from program output

- Failure-aware trace capture
  - Stores successful and failed outcomes in the same causal timeline
  - Makes it easier to pinpoint the exact stage where execution diverged

- Compute and fee analysis
  - Shows compute units and fee impact per flow
  - Helps identify cost/performance regressions early

- Signature and confirmation tracking
  - Extracts transaction signatures from captured flows
  - Polls status to map pending -> confirmed lifecycle transitions

- Timeline and lifecycle view
  - Request -> wallet -> pending -> confirmed -> explorer
  - Makes latency and stage-level failures visible at a glance

- Session persistence and reset controls
  - Persists captured events in extension storage for stable debugging sessions
  - Supports explicit event clearing to start clean during iterative testing

- Multi-surface extension UX
  - Works with DevTools panel and side panel experiences
  - Keeps trace updates synchronized across extension surfaces

- Explorer deep-link verification
  - One-click compare between local decoded context and on-chain explorer view

## What Is Already Implemented

- In-page interception bridge for send/sign/simulate and RPC methods
- Event transport and persistence through content/background scripts
- Trace grouping and enrichment pipeline for signatures, status, and metadata
- Decoded instruction rendering in the panel UI
- Account storage inspection with raw-byte heuristics and per-account metadata (fee payer/executable/owner/lamports)
- Lifecycle timeline and stage cards in the inspector

## Architecture (High Level)

- In-page hook layer
  - Wraps wallet/provider/connection methods in the page runtime
  - Emits structured BEFORE/AFTER/INFO events with call IDs, arguments, and timing data
  - Captures both successful responses and failure payloads for the same call path
  - File: extension/src/inpage.js

- Extension transport layer
  - Receives in-page events through content script bridge
  - Forwards events to background service worker for persistence
  - Stores and rebroadcasts updates so DevTools/side panel stay in sync
  - Files: extension/src/content.js, extension/src/background.js

- Trace intelligence layer
  - Groups event streams into trace sessions using call identity
  - Normalizes payload shape for send/sign/simulate and RPC call variants
  - Decodes instruction data and extracts signatures/account hints
  - Enriches traces with transaction status, logs, fee, compute, and account context
  - Files: extension/src/components/traceUtils.js, extension/src/components/TracePanel.jsx

- Inspector UI layer
  - Renders timeline, decode, account context, logs, and failure analysis in one view
  - Uses lifecycle stages to make transaction progression and latency obvious
  - Supports raw and interpreted views for fast triage plus deep debugging
  - File: extension/src/components/TraceDetail.jsx

## How It Works (End-to-End)

1. Intercept
   - A dApp calls wallet/provider/connection methods (for example send/sign/simulate).
   - ChronoTrace captures the request immediately in-page with a unique call ID.

2. Bridge
   - Captured events move from page context -> content script -> background worker.
   - Events are persisted and broadcast to extension UIs in near real-time.

3. Build Trace
   - The panel groups related BEFORE/AFTER/INFO events into one transaction story.
   - It aligns call timing, method names, payloads, and returned signatures.

4. Decode + Enrich
   - Instruction bytes and parameters are decoded into readable intent.
   - RPC enrichment fetches status, logs, fee/compute usage, and account metadata/state context.

5. Explain
   - UI presents a deterministic flow: request -> chain progress -> outcome.
   - Developers can answer root-cause questions without jumping across multiple tools.

## Design Principles

- Capture first, decode second
  - Never lose the raw event; interpretation can evolve later.

- Preserve causality
  - Every derived insight maps back to an original call/event in the trace.

- Fast path for triage, deep path for forensics
  - One glance should show status; one click should expose raw details.

## Impact

- Faster debugging loops for Solana teams
- Lower cost of transaction failure triage
- Better release confidence before mainnet pushes
- Better DX translates into better end-user reliability

## Roadmap

- Richer CPI and nested instruction tree visualization
- Stronger program-specific error dictionaries
- Transaction replay helpers from captured payloads
- Team-shareable trace sessions and comparisons
