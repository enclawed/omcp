---
date: "2025-12-09T09:00:00+00:00"
publishDate: "2025-12-09T09:00:00+00:00"
title: "Exploring the Future of MCP Transports"
author: "Kurtis Van Gent (Transport WG Maintainer), Shaun Smith (Transport WG Maintainer)"
tags: ["mcp", "governance", "transports"]
ShowToc: true
---

When MCP first launched in November of 2024, quite a few of its users relied on local environments, connecting clients to servers over [STDIO](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports#stdio). As MCP became the go-to standard for LLM integrations, community needs evolved, leading to the build-out of infrastructure around remote servers. There's now growing demand for distributed deployments that can operate at scale.

The [Streamable HTTP](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports#streamable-http) transport was a significant step forward, enabling remote MCP deployments and unlocking new use cases. However, as enterprise deployments scale to millions of daily requests, early adopters have encountered practical challenges that make it difficult to leverage existing infrastructure patterns. The friction of stateful connections has become a bottleneck for managed services and load balancing.

Some of these challenges include:

- **Infrastructure Complexity:** Load balancers and API gateways must parse full JSON-RPC payloads to route traffic, rather than using standard HTTP patterns.
- **Scaling Friction:** Stateful connections force "sticky" routing that pins traffic to specific servers, preventing effective auto-scaling.
- **High Barrier for Simple Tools:** Developers building simple, ephemeral tools are often required to manage complex backend storage to support basic multi-turn interactions.
- **Ambiguous Session Scope:** There is no predictable mechanism for defining where a conversation context starts and ends across distributed systems.

## Roadmap

Over the past few months, the Transport Working Group has worked together with the community and MCP Core Maintainers to develop solutions to these challenges.

In this post we share the roadmap for evolving the Streamable HTTP transport and invite community feedback to help shape the future of MCP transports.

### A Stateless Protocol

MCP was originally designed as a stateful protocol. Clients and servers maintain mutual awareness through a persistent, bidirectional channel that begins with a handshake to exchange capabilities and protocol version information. Because this state remains fixed throughout the connection, scaling requires techniques like sticky sessions or distributed session storage.

We are exploring ways to make MCP stateless by:

- Replacing the [`initialize` handshake](https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle#initialization) and sending the shared information with each request and response instead.
- Providing a `discovery` mechanism for clients to query server capabilities if they need the information early, for scenarios such as UX hydration.

These changes enable a more dynamic model where clients can optimistically attempt operations and receive clear error messages if a capability is unsupported.

> **NOTE:** Many SDKs offer a _`stateless`_ option in their server transport configuration. This flag controls whether the `Mcp-Session-Id` header is used - read below for more on sessions.

### Elevating Sessions

Currently, sessions are a side effect of the transport connection. With STDIO, sessions are implicit in the process lifecycle; with Streamable HTTP, sessions are created when a server assigns an `Mcp-Session-Id` during initialization. This can lead to confusion between transport and application layer concerns.

We are looking at moving sessions to the _data model layer_, making them explicit rather than implicit.

This would allow MCP applications to handle sessions as part of their domain logic. We're exploring several approaches, with a cookie-like mechanism being one potential candidate to decouple session state from the transport layer.

This direction mirrors standard HTTP, where the protocol itself is stateless while applications build stateful semantics using cookies, tokens, and similar mechanisms. The exact approach to session creation is still being designed, with the goal of removing existing ambiguities around what a session means in remote MCP scenarios.

### Elicitations and Sampling

Two existing MCP features enable key AI workflows that developers want: [Elicitations](https://spec.modelcontextprotocol.io/specification/2025-11-25/client/elicitation) for requesting human input, and [Sampling](https://spec.modelcontextprotocol.io/specification/2025-11-25/client/sampling) for agentic LLM interactions.

To support these features at scale, we need to rethink the bidirectional communication pattern they rely on. Currently, when a server needs more information to complete a tool call, it suspends operation and waits for a client response—meaning it must remember all outstanding requests.

To avoid this problem, we'll make server requests and responses work similarly to chat APIs. The server will return the elicitation request as usual, and the client will return both the request _and_ response, allowing the server to reconstruct the necessary state purely from the returned message. This avoids managing potentially long-running state between specific nodes and may eliminate the need for back-end storage entirely.

### Update Notifications and Subscriptions

MCP's dynamic nature means that [tools](https://modelcontextprotocol.io/specification/2025-11-25/server/tools), [prompts](https://modelcontextprotocol.io/specification/2025-11-25/server/prompts), and [resources](https://modelcontextprotocol.io/specification/2025-11-25/server/resources) can change during operation. The current protocol uses server-to-client `ListChangedNotification` messages as an optimization to prompt cache invalidation.

We're replacing the general-purpose `GET` stream with explicit subscription streams. Clients will start specialized streams when they want to subscribe to specific items, and can manage multiple concurrent subscriptions. If a subscription stream is interrupted, the client restarts it with no complex resumption logic required.

To make notifications truly optional optimizations rather than requirements, we're adding Time-To-Live (TTLs) and version numbers (such as [ETag](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/ETag)) to data. This allows clients to make intelligent caching decisions without depending on the notification stream, improving reliability in lossy network conditions.

### JSON-RPC Envelopes

The protocol currently uses JSON-RPC for all message envelopes, including method names and parameters. As we optimize for HTTP deployments, questions arise about whether to move toward more traditional REST patterns.

While we decided not to replace the JSON-RPC message bodies, we agreed that routing-critical information (such as the RPC method or tool name) should be exposed via standard HTTP Paths or Headers, allowing infrastructure to handle traffic without parsing JSON bodies.

### Pluggable Transports

The MCP Specification already supports [Custom Transports](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports#custom-transports) allowing integrators to deploy transports such as gRPC or WebSockets.

The STDIO and Streamable HTTP transports are defined as **Standard**, guaranteeing support in the SDKs and enabling interoperability by default across the ecosystem.

We will put a renewed effort into making Custom Transports easier to deploy by improving how they plug into the SDKs. This is preferred over adding new standard transport types, which would unnecessarily proliferate connectivity options for standard deployments.

## Summary

These changes fundamentally reorient MCP around stateless, independent requests while preserving the rich features that make it powerful. For server developers, eliminating session state simplifies horizontal scaling—no more sticky sessions or distributed session stores. For clients, the architecture becomes simpler and more predictable.

Most developers using SDKs will see minimal impact, and many will require no code changes at all. The primary difference is architectural: deployments become simpler, serverless platforms become viable for rich MCP features, and the protocol aligns better with modern infrastructure patterns.

## Next Steps

Work begins immediately, with the target of agreeing SEPs in Q1 2026 for inclusion in the next specification release (tentatively June 2026). Throughout this process, we invite community feedback and participation. These changes enable MCP to scale from local development to global deployments while maintaining the ergonomics that made it successful.

If you have comments or feedback, join us in the [MCP Contributors Discord server](https://modelcontextprotocol.io/community/communication#discord), or engage with Spec Enhancement Proposals (SEPs) [submitted](https://github.com/modelcontextprotocol/modelcontextprotocol/pulls) to the Model Context Protocol repository.

This roadmap represents the collective wisdom of individuals and companies across the MCP ecosystem. We're excited to build this future together.
