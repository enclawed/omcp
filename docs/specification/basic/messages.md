---
title: Messages
type: docs
weight: 20
---
{{< callout type="info" >}}
**Protocol Revision**: {{< param protocolRevision >}}
{{< /callout >}}

All messages in MCP **MUST** follow the [JSON-RPC 2.0](https://www.jsonrpc.org/specification) specification. The protocol defines three types of messages:

### Requests

Requests are sent from the client to the server or vice versa. They **MUST** include a unique `id` and expect a response.

### Responses

Responses are sent in reply to requests. They **MUST** include the same `id` as the corresponding request.

### Notifications

Notifications are sent from the client to the server or vice versa. They do not expect a response and **MUST NOT** include an `id`.

### Ping Messages

Either party can send ping messages to check if the other is still alive and responsive:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "ping"
}
```

The receiver MUST respond promptly with an empty result:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {}
}
```

If the receiver fails to respond in a timely manner, the sender MAY disconnect.
