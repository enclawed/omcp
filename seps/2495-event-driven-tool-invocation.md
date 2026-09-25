# SEP-2495: Event-Driven Tool Invocation (Server-Push to LLM Re-entry)

- **Status**: Draft
- **Type**: Standards Track
- **Created**: 2026-03-29
- **Author(s)**: Heiko Friedrich (heikofriedrich75@gmail.com)
- **PR**: https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2495

## Abstract

This SEP proposes an event-driven re-entry mechanism for MCP that allows servers to trigger a new LLM turn in response to asynchronous events. Currently, MCP follows a strict request-response pattern: the LLM client can call tools on the server, but the server cannot initiate a new LLM turn when an event occurs. While MCP supports server-to-client notifications (e.g., `notifications/tools/list_changed`), these only update metadata — they never re-enter the LLM loop. This limitation prevents real-time, interactive applications where the LLM acts as the orchestrator reacting to user interactions, sensor data, webhooks, or other asynchronous events from the server side.

## Motivation

The current request-response model of MCP makes the LLM a passive participant rather than an active orchestrator in interactive scenarios. Consider the following concrete example:

**Interactive Desktop App via MCP:**

An MCP server (N.E.O.) provides tools for compiling, previewing, and interacting with live Avalonia desktop applications. The intended workflow:

1. LLM calls `compile_and_preview` → App window appears with a "Generate Quote" button
2. LLM calls `subscribe_events` → Server starts collecting UI events
3. User clicks the button in the app
4. Server detects the click event
5. **GAP:** The server has no way to notify the LLM client that an event occurred and trigger a new assistant turn
6. LLM should automatically call `get_events`, read the click, then call `inject_data` to display a quote and `set_property` to change the background color

What actually happens today: The user must manually send a chat message ("I clicked the button") to prompt the LLM to poll `get_events`. This breaks the interactive experience entirely.

This limitation affects a wide range of use cases:

- **Live dashboards**: Server pushes data updates, LLM re-renders visualizations
- **Chat bots with external triggers**: Webhooks, emails, or messages arrive and the LLM reacts
- **IoT / sensor monitoring**: Threshold alerts trigger LLM analysis
- **Collaborative editing**: Multiple users interact with a shared app, LLM orchestrates
- **Game loops**: User makes a move, server detects it, LLM responds
- **Form wizards**: User fills step 1, LLM dynamically generates step 2 based on input
- **Long-running tasks**: Server signals completion, LLM presents results

> **Imported from upstream.** Proposed as [modelcontextprotocol#2495](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2495)
> by @hf75 on 2026-03-29, where it was still open on 2026-09-25.
> Accepted into omcp on its technical merit. The text is the author's; only the status,
> the sponsor field, and documentation links were changed on import.
>
> **Reviewed 2026-09-25 — not yet accepted.** Held as a draft because the document is incomplete: no Specification, Rationale, Backward Compatibility, or Security Implications. Acceptance needs a prototype a reviewer can run, with its setup and the data to run it; Final also needs conformance tests and the reference documentation chapter.

### Current Workarounds (All Suboptimal)

| Workaround                             | Problem                                  |
| -------------------------------------- | ---------------------------------------- |
| User manually messages the LLM to poll | Breaks interactivity, poor UX            |
| Build all logic into the app itself    | Defeats the purpose of LLM orchestration |
