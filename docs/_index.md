---
title: Specification
cascade:
  type: docs
breadcrumbs: false
weight: 10
---

{{< callout type="info" >}}
**Protocol Revision**: 2024-11-05
{{< /callout >}}

The [Model Context Protocol](https://modelcontextprotocol.io) (MCP) is an open protocol that enables seamless integration between LLM applications and external data sources and tools. Whether you're building an AI-powered IDE, enhancing a chat interface, or creating custom AI workflows, MCP provides a standardized way to connect LLMs with the context they need.

This specification defines the authoritative protocol requirements based on the TypeScript schema in [schema.ts](https://github.com/modelcontextprotocol/specification/blob/main/schema/schema.ts).

For implementation guides and examples, visit [modelcontextprotocol.io](https://modelcontextprotocol.io).

## Overview

MCP provides a standardized way for applications to:

- Share contextual information with language models
- Expose tools and capabilities to AI systems
- Build composable integrations and workflows

The protocol uses JSON-RPC 2.0 messages to establish communication between:

- **Clients**: Applications that integrate with language models
- **Servers**: Services that provide context and capabilities
- **Hosts**: Processes that manage client connections

## Core Protocol Features

MCP defines several key components:

### Base Protocol
- JSON-RPC message format
- Capability negotiation
- Session lifecycle management

### Context Primitives
- **Resources**: Data exposed via URIs
- **Prompts**: Template-based interactions
- **Tools**: Executable functions
- **Sampling**: LLM generation control

### Cross-Cutting Concerns
- Progress tracking
- Error handling
- Security boundaries
- Backwards compatibility

## Learn More

Explore the detailed specification for each protocol component:

{{< cards >}}
  {{< card link="architecture" title="Architecture" icon="template" >}}
  {{< card link="basic" title="Base Protocol" icon="code" >}}
  {{< card link="server" title="Server Features" icon="server" >}}
  {{< card link="client" title="Client Features" icon="user" >}}
  {{< card link="contributing" title="Contributing" icon="pencil" >}}
{{< /cards >}}
