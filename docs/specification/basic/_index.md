---
title: Base Protocol
cascade:
  type: docs
weight: 2
---

The Model Context Protocol (MCP) defines a set of JSON-RPC methods for communication between clients and servers in AI-assisted applications. MCP uses [JSON-RPC 2.0](https://www.jsonrpc.org/specification) as its base protocol.

All messages in MCP **MUST** follow the [JSON-RPC 2.0](https://www.jsonrpc.org/specification) specification. The protocol defines three fundamental types of messages:

| Type           | Description                            | Requirements                          |
|----------------|----------------------------------------|---------------------------------------|
| `Requests`     | Messages sent to initiate an operation | Must include unique ID and method name|
| `Responses`    | Messages sent in reply to requests     | Must include same ID as request       |
| `Notifications`| One-way messages with no reply         | Must not include an ID                |

The Model Context Protocol consists of several key components that work together:

**Protocol Layers:**

- **Base Protocol**: Core JSON-RPC message types and fundamental operations such as capability exchange
- **Lifecycle Management**: Connection initialization, capability negotiation, and session control
- **Server Features**: Resources, prompts, and tools exposed by servers
- **Client Features**: Sampling and root directory capabilities
- **Utilities**: Cross-cutting concerns like logging and argument completion

All implementations **MUST** support the base protocol and lifecycle management components. Other components **MAY** be implemented based on the specific needs of the application.

These protocol layers establish clear separation of concerns while enabling rich interactions between clients and servers. The modular design allows implementations to support exactly the features they need.

### Model Context Protocol specific methods

MCP defines methods based on JSON-RPC that clients and servers implement:

{{< cards >}}
  {{< card link="lifecycle" title="Lifecycle" icon="refresh" >}}
  {{< card link="resources" title="Resources" icon="document" >}}
  {{< card link="prompts" title="Prompts" icon="chat-alt-2" >}}
  {{< card link="tools" title="Tools" icon="adjustments" >}}
  {{< card link="logging" title="Logging" icon="annotation" >}}
  {{< card link="sampling" title="Sampling" icon="code" >}}
{{< /cards >}}

### Authentication

Authentication mechanisms are not part of the core MCP specification. Implementations **MAY** provide authentication based on the transport they use.

## Specification

The official specification can be found in [TypeScript source](http://github.com/modelcontextprotocol/specification/tree/main/schema/schema.ts) and [JSON Schema](http://github.com/modelcontextprotocol/specification/tree/main/schema/schema.json) formats. The TypeScript version serves as the source of truth, while the JSON Schema version is generated from it.
