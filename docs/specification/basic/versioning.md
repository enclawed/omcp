---
title: Versioning
type: docs
weight: 80
---
{{< callout type="info" >}}
**Protocol Revision**: {{< param protocolRevision >}}
{{< /callout >}}

The Model Context Protocol uses string-based version identifiers following the format `YYYY-MM-DD` to indicate the last date significant changes were made. The current protocol version is `2024-11-05`.

Version negotiation happens during the initial handshake - clients declare their supported version in the `initialize` request, and servers respond with their preferred version. Clients and servers **MUST** agree on a compatible protocol version to proceed with communication.

A key aspect of the versioning scheme is that version strings may remain unchanged even when the protocol is updated, as long as changes maintain backwards compatibility. This allows for incremental improvements while preserving interoperability.

Clients have the flexibility to support multiple protocol versions simultaneously. When connecting to a server, a client can indicate the latest version it supports while maintaining the ability to fall back to older versions if needed. However, servers will specify a single version they wish to use in their initialize response.

The protocol provides appropriate error handling if version negotiation fails, allowing clients and servers to gracefully terminate connections when they cannot agree on a compatible version.
