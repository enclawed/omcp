---
title: Python
type: docs
weight: 2
cascade:
  type: docs
---

The MCP Python SDK provides a comprehensive implementation of the Model Context Protocol, split into several key components:

## Core Components

- **Client Module**: Implements the MCP client interface for connecting to servers
- **Server Module**: Provides a decorator-based API for implementing MCP servers
- **Types Module**: Contains all protocol type definitions and models
- **Shared Components**: Common utilities and base classes used by both client and server

## Transport Options

The SDK supports multiple transport mechanisms for client-server communication:

- **stdio**: Communication over standard input/output streams, ideal for local process-to-process communication
- **SSE (Server-Sent Events)**: HTTP-based transport with server push capabilities, suitable for web deployments

Each transport option has its own benefits:

- stdio is simple and secure for local usage
- SSE works well with existing HTTP infrastructure
- WebSocket provides low-latency bidirectional communication

## Key Design Principles

- **Async-first**: Built on anyio for async/await patterns and compatibility with both asyncio and trio
- **Type Safety**: Full typing support via Pydantic models
- **Protocol Conformance**: Strict adherence to the MCP specification
- **Extensibility**: Easy to extend with custom functionality

## Installation

Install the MCP Python SDK using pip:

```bash
pip install mcp-python
```
or add it to your [pyproject.toml](https://packaging.python.org/en/latest/guides/writing-pyproject-toml/) using [uv]( {{< param "uv_docs" >}} ).
```bash
uv add mcp-python
```
