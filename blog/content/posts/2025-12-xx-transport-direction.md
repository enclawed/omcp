---
date: "2025-12-09T09:00:00+00:00"
publishDate: "2025-12-09T09:00:00+00:00"
title: "Evolving MCP Transports To Scale For Production"
author: "Kurtis van Gent (Transport WG Maintainer), Shaun Smith (Transport WG Maintainer)"
tags: ["mcp", "governance"]
ShowToc: true
---

# Evolving MCP Transports To Scale For Production

When MCP first launched in November of 2024, most users ran it locally, connecting clients to servers over STDIO. But as MCP has become the go-to standard for LLM integration, the community's needs have evolved. There's growing demand for distributed deployments that can operate at scale.

Pioneers of remote, scaled deployments using the Streamable HTTP transport have found practical challenges which make reusing existing infrastructure deployment patterns hard.

## Roadmap

Over the past few months, the Transport Working Group has worked together with the community and MCP Core Maintainers to develop solutions to these challenges.

In this post we share the roadmap for evolving the Streamable HTTP transport, and invite community feedback to help us shape the future of the protocol.

### A Stateless Protocol

MCP was designed from the start as a stateful protocol, with clients and servers maintaining mutual awareness through a persistent, bidirectional channel.

Connections are initialized with a handshake which shares information like Capabilities and Protocol Version. This state remains fixed for the duration of the connection, and requires techniques such as sticky sessions or distributed session storage to for scaled deployment.

We propose making MCP stateless by:

- Replacing the `initialize` handshake - and sending the shared information with each request/response instead.
- Providing a `discovery` mechanism for Clients to query Server Capabilities if they need the information early (for example for UX purposes).

We're moving toward a more dynamic model where clients can optimistically "just try" what they need and receive helpful error messages if unsupported.

> [!NOTE]
>
> Many SDKs present a _`stateless`_ option in their Server transport configuration. This flag actually controls whether the `Mcp-Session-Id` header is used - read below for more on sessions.

### Elevating Sessions

Today, Sessions are a side effect of a transport connection. For STDIO, sessions are implicit in the process lifecycle. For Streamable HTTP, sessions are created when a Server assigns an `Mcp-Session-Id` during `intialize`. This mixes transport and application layer concerns.

We plan to move Sessions to the _data model layer_ - making them explicit rather than implicit.

This means that MCP applications will be able to handle sessions as part of their domain logic. A cookie style mechanism is the preferred choice.

This makes MCP similar to standard HTTP - where the protocol itself is stateless, while applications build stateful semantics with cookies, tokens and similar mechanisms. The exact approach to session creation is still being worked on - but this removes existing ambiguities on what a session is in remote MCP.

### Elicitations and Sampling

Two standout MCP features enable advanced AI workflows: [Elicitations](https://spec.modelcontextprotocol.io/specification/2025-03-26/client/elicitation) for requesting human input, and [Sampling](https://spec.modelcontextprotocol.io/specification/2025-03-26/client/sampling) for agentic LLM interactions.

In our stateless design, this bidirectional request pattern requires rethinking. Currently when a Server needs more information to complete a Tool Call, it suspends operation and waits for a Client response - meaning it must remember all of its outstanding requests.

To avoid the need to do this, we'll make the Server Request/Response similar to the way Chat APIs work. This means that the Client will return both the Request _and_ Response allowing the Server to reconstruct the necessary state purely from the returned message.

### Update Notifications, Subscriptions

MCP's dynamic nature means that Tools, Prompts, and Resources can change during operation. The current protocol uses server-to-client `ListChangedNotification` messages as an optimization to prompt cache invalidation.

We're replacing the general-purpose `GET` stream with explicit subscription streams. Clients will start specialized streams when they want to subscribe to specific items, and can manage multiple concurrent subscriptions. If a subscription stream is interrupted, the client restarts it with no complex resumption logic required.

To make notifications truly optional optimizations rather than requirements, we're adding Time-To-Live (TTLs) and version numbers (such as [ETag](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/ETag)) to data. This allows clients to make intelligent caching decisions without depending on the notification stream, improving reliability in lossy network conditions.

### JSON-RPC Envelopes

The protocol currently uses JSON-RPC for all message envelopes, including method names and parameters. As we optimize for HTTP deployments, questions arise about whether to move toward more traditional REST patterns.

While we don't yet have consensus on fully replacing JSON-RPC with REST, we concluded that copying the JSON-RPC method name into the HTTP path (or a dedicated header) improves clarity and enables better HTTP caching semantics.

The core tension is between protocol consistency (keeping JSON-RPC everywhere) and HTTP integration (making MCP look like normal web traffic). We're evaluating this tradeoff with real deployment scenarios in mind.

## Summary

The transport changes we outlined fundamentally reorient MCP around stateless, independent requests while preserving the rich features that make it powerful. For server developers, the elimination of session state makes horizontal scaling trivial - no more sticky sessions or distributed session stores. For client hosts, architecture becomes simpler and more predictable.

Most developers using SDKs will see minimal impact, and many will require no code changes at all. The primary difference is architectural: deployments become simpler, serverless platforms become viable for rich MCP features, and the protocol aligns better with modern infrastructure patterns.

## Next Steps

We aim to complete the detailed transport change designs in the first quarter of calendar year 2026, targeting new spec release in June of 2026. Throughout this process, we invite community feedback and participation. These changes enable MCP to scale from local development to global deployments while maintaining the ergonomics that made it successful.

If you have comments or feedback, join us in the [MCP Contributors Discord server](https://modelcontextprotocol.io/community/communication#discord), or engage with Spec Enhancement Proposals (SEPs) [submitted](https://github.com/modelcontextprotocol/modelcontextprotocol/pulls) to the Model Context Protocol repository.

This roadmap represents the collective wisdom of individuals and companies across the MCP ecosystem. We're excited to build this future together.
