# ChronoTrace Solana

ChronoTrace Solana is a developer-focused browser extension that turns noisy wallet and RPC activity into a clean, inspectable timeline. It gives teams a DevTools-style transaction narrative from wallet action to on-chain confirmation, with lifecycle timing and decoded context in one place. It is built to reduce debugging guesswork when Solana transactions feel "stuck," "slow," or "unclear."

## Problem It Solves

Solana dApp debugging is usually split across wallet popups, browser console logs, RPC responses, and explorers. That fragmented workflow makes it hard to answer simple questions fast:
- Where did time go?
- Was delay caused by user approval, RPC propagation, or finalization?
- Which request actually produced this signature?

ChronoTrace Solana unifies those steps into one traceable timeline and structured inspector.

<img width="1535" height="727" alt="image" src="https://github.com/user-attachments/assets/f356f400-c56d-40e3-988b-3e6b84dab3ae" />

## Feature List

- Real-time RPC event capture for wallet and connection flows
- Function-call trace list with timestamps, method, endpoint, duration, and status
- Timeline mode with segmented lifecycle visualization and hover insights
- Lifecycle log cards (start, wallet confirm, pending, confirmed, explorer)
- Clean UI mode for simplified transaction understanding
- JSON mode for deep raw inspection
- Account Storage mode for related account data and binary decode hints
- Signature-aware transaction enrichment using RPC methods such as getTransaction and getSignatureStatuses
- Explorer link generation for quick external verification

## Basic Architecture

### 1) In-page Hook Layer
- Location: extension/src/inpage.js
- What it does: wraps wallet/provider and connection methods, emits BEFORE/AFTER/INFO events, and attaches timing metadata.
- Why it matters: this is the source of high-fidelity client-side transaction intent and call timing.

### 2) Bridge and Transport Layer
- Location: extension/src/content.js and extension/src/background.js
- What it does: forwards captured events from page context to extension runtime, persists them in local storage, and broadcasts updates to UI.
- Why it matters: provides reliable event flow and replayability in the panel.

### 3) Trace Builder and Enrichment Layer
- Location: extension/src/components/traceUtils.js and extension/src/components/TracePanel.jsx
- What it does:
	- Groups raw events into traces by call identity
	- Computes timelines and durations
	- Extracts/infers signatures
	- Queries RPC for status/details and account storage insights
- Why it matters: converts low-level logs into meaningful transaction lifecycle state.

### 4) Inspector UI Layer
- Location: extension/src/components/TraceList.jsx and extension/src/components/TraceDetail.jsx
- What it does:
	- Renders trace list and selection state
	- Presents multiple analysis views (Timeline, Clean UI, JSON, Account Storage)
	- Displays lifecycle progression and timing summaries
- Why it matters: gives developers one place to inspect both summary and deep details.

### 5) Visual Styling Layer
- Location: extension/src/panel.css
- What it does: implements compact timeline rendering, lifecycle colors, card hierarchy, and readable dark theme contrast.
- Why it matters: clear visual hierarchy makes debugging faster and less error-prone.

## How Each Feature Works

### Real-time Capture
Method wrappers in inpage.js emit structured events on invocation and completion. Each event includes phase, method, call id, and timing fields.

### Trace List
TracePanel merges related events into a single trace and shows a sortable list with key metadata for rapid scanning.

### Timeline View
TraceDetail builds lifecycle steps from trace and RPC enrichment data, scales them on a single timeline, and provides hover-based segment details.

### Clean UI
A reduced-complexity interpretation of transaction context focusing on status, fee, compute, cluster, and key parameters.

### JSON View
Shows raw trace payloads and enriched explorer/RPC payloads for full-fidelity debugging.

### Account Storage View
Fetches related accounts and decodes available data structures, including heuristics for binary layouts and discriminator-like patterns.

### Explorer Verification
Builds cluster-correct links from signature context so a trace can be cross-checked externally in one click.

## Current Status

ChronoTrace Solana is actively iterating on timeline UX and lifecycle accuracy to feel close to browser network tooling while staying Solana-specific.
