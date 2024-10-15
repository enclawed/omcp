---
title: Server
type: docs
weight: 1
cascade:
  type: docs
---

This guide walks you through setting up and implementing a basic MCP server using Python.

## Installation

Install the MCP Python SDK using pip:

```bash
pip install mcp-python
```
or add it to your [pyproject.toml](https://packaging.python.org/en/latest/guides/writing-pyproject-toml/) using [uv]( {{< param "uv_docs" >}} ).
```bash
uv add mcp-python
```

## Server API Overview

The Python SDK provides a decorator-based API for implementing MCP servers. The main `Server` class offers decorators for handling different types of requests:

### Resource Handling
- `@server.list_resources()`: Lists available resources
- `@server.read_resource()`: Reads content of a specific resource
- `@server.subscribe_resource()`: Handles resource subscription requests
- `@server.unsubscribe_resource()`: Handles unsubscribe requests

### Tool Support
- `@server.list_tools()`: Lists available tools
- `@server.call_tool()`: Handles tool execution requests

### Prompt Management
- `@server.list_prompts()`: Lists available prompts
- `@server.get_prompt()`: Retrieves specific prompt templates

### Progress & Logging
- `@server.progress_notification()`: Handles progress updates
- `@server.set_logging_level()`: Controls server logging

The decorators automatically handle request/response formatting and protocol compliance, allowing you to focus on implementing the core functionality.

## Basic Server Implementation

Here's a minimal example of implementing an MCP server:

```python
from mcp_python.server import Server
import anyio

# Create a new server instance
server = Server("example-server")

# Implement resource handling
@server.list_resources()
async def list_resources():
    # Return list of available resources
    return [
        {
            "uri": "example://resource1",
            "name": "Example Resource 1",
            "description": "An example resource"
        }
    ]

@server.read_resource()
async def read_resource(uri):
    # Return content for the requested resource
    if uri == "example://resource1":
        return "Example resource content"
    raise ValueError(f"Unknown resource: {uri}")

# Main server loop
async def main():
    # Use stdio transport for this example
    async with stdio_server() as (read_stream, write_stream):
        await server.run(
            read_stream,
            write_stream,
            server.create_initialization_options()
        )

if __name__ == "__main__":
    anyio.run(main)
```

## Advanced Server Features

### Adding Tool Support

```python
@server.list_tools()
async def list_tools():
    return [
        {
            "name": "example-tool",
            "description": "An example tool",
            "parameters": {
                "type": "object",
                "properties": {
                    "param1": {"type": "string"}
                }
            }
        }
    ]

@server.call_tool()
async def call_tool(name, **kwargs):
    if name == "example-tool":
        return f"Tool executed with params: {kwargs}"
    raise ValueError(f"Unknown tool: {name}")
```

### Adding Prompt Support

```python
@server.list_prompts()
async def list_prompts():
    return [
        {
            "name": "example-prompt",
            "description": "An example prompt",
            "parameters": {
                "type": "object",
                "properties": {
                    "param1": {"type": "string"}
                }
            }
        }
    ]

@server.get_prompt()
async def get_prompt(name, arguments):
    if name == "example-prompt":
        return PromptResponse(
            messages=[
                Message(
                    role="user",
                    content=f"Example prompt with args: {arguments}"
                )
            ],
            desc="Example prompt response"
        )
    raise ValueError(f"Unknown prompt: {name}")
```

## Running the Server

Start the server from the command line:

```bash
python your_server.py
```

For SSE or WebSocket transport, you'll need to use an ASGI server like Hypercorn:

```bash
hypercorn your_server:app --bind 0.0.0.0:8000
```

## Best Practices

1. Always implement proper error handling for all server methods
2. Use typing hints for better code clarity and IDE support
3. Document your server's capabilities and resources
4. Implement logging for debugging purposes
5. Follow the MCP specification for consistent behavior

## Common Patterns

### Resource Updates

```python
async def notify_resource_update(uri, session):
    await session.send_resource_updated(uri)
```

### Progress Notifications

```python
async def long_running_operation(session):
    for i in range(100):
        await session.send_progress_notification(
            "operation-1",
            progress=i,
            total=100
        )
```

### Logging

```python
async def log_operation(session):
    await session.send_log_message(
        level="info",
        data="Operation completed",
        logger="example-server"
    )
```
