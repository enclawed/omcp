---
title: Resources
type: docs
weight: 4
---

# Resources

Resources enable servers to expose arbitrary data to clients in a structured way. Clients can discover available resources, read their contents, and optionally subscribe to updates. Each resource is uniquely identified by a URI.

## Use Cases

Common usecases for resources include file and folder access, but can extend to any other form. See [list of common URI schemes](#list-of-common-uri-schemas) for more information. Here are examples of kinds of resources that an MCP server could expose:

### File Access
A common use case for resources is to expose files. The server should prefix any file-like resource
with the `file://` scheme, and ensure that the client is aware of how to interpret the file by providing
a correct MIME type. When the client issues a `resources/read` request, the server *must* ensure that it
returns the file in the correct encoding for the mime type (e.g., text if possible, or base64 for any binary data).

```json
{
  "uri": "file:///home/user/documents/example.zip",
  "name": "Example Text File",
  "mimeType": "application/octet-stream"
}
```

### Database Schema

Resources can also be used to provide specialized structured information. In the following example we are providing a database schema as a custom JSON format that the client is required to understand:

```json
{
  "uri": "postgres://localhost/some_database/some_table/schema",
  "name": "Database schema for some_database.some_table",
  "mimeType": "application/json;format=MyApplication::DatabaseSchema"
}
```

If the client would request a schema, the server would response with it's custom defined database schema
JSON, for example

```json
{
  "schema": "myschema",
  "table": "test",
  "owner": "a-user",
  "definition": "..."
}
```
### Resource Requests

Resources are identified by URIs and can represent various types of data exposed by the server. Clients can list available resources, read their contents, and optionally subscribe to updates.

#### List Resources Request

The list resources request is sent from the client to the server to retrieve a list of available resources.

_Request_:
- method: 'resources/list'
- params: `ListResourcesParams` defined as follows:

```typescript
interface ListResourcesParams extends WorkDoneProgressParams {
}
```

_Response_:
- result: `ListResourcesResult` defined as follows:

```typescript
interface ListResourcesResult {
  resourceTemplates?: ResourceTemplate[];
  resources?: Resource[];
}
```

Where `ResourceTemplate` and `Resource` are defined as:

```typescript
interface ResourceTemplate {
  uriTemplate: string;
  name: string;
  description?: string;
  mimeType?: string;
}

interface Resource {
  uri: DocumentUri;
  name: string;
  mimeType?: string;
}
```

- error: code and message set in case an exception happens during the resource listing request.

#### Read Resource Request

The read resource request is sent from the client to the server to retrieve the contents of a specific resource.

_Request_:
- method: 'resources/read'
- params: `ReadResourceParams` defined as follows:

```typescript
interface ReadResourceParams extends WorkDoneProgressParams {
  uri: DocumentUri;
}
```

_Response_:
- result: `ReadResourceResult` defined as follows:

```typescript
interface ReadResourceResult {
  contents: (TextResourceContents | BlobResourceContents)[];
}

interface TextResourceContents {
  uri: DocumentUri;
  mimeType?: string;
  text: string;
}

interface BlobResourceContents {
  uri: DocumentUri;
  mimeType?: string;
  blob: string;  // base64 encoded
}
```

- error: code and message set in case an exception happens during the resource read request.

#### Subscribe Request

The subscribe request is sent from the client to the server to subscribe to updates for a specific resource.

_Request_:
- method: 'resources/subscribe'
- params: `SubscribeParams` defined as follows:

```typescript
interface SubscribeParams extends WorkDoneProgressParams {
  uri: DocumentUri;
}
```

_Response_:
- result: void
- error: code and message set in case an exception happens during the subscribe request.

#### Unsubscribe Request

The unsubscribe request is sent from the client to the server to unsubscribe from updates for a specific resource.

_Request_:
- method: 'resources/unsubscribe'
- params: `UnsubscribeParams` defined as follows:

```typescript
interface UnsubscribeParams extends WorkDoneProgressParams {
  uri: DocumentUri;
}
```

_Response_:
- result: void
- error: code and message set in case an exception happens during the unsubscribe request.

#### Resource Updated Notification

The resource updated notification is sent from the server to the client when a subscribed resource has been updated.

_Notification_:
- method: 'notifications/resources/updated'
- params: `ResourceUpdatedParams` defined as follows:

```typescript
interface ResourceUpdatedParams {
  uri: DocumentUri;
}
```

Servers MUST send this notification only for resources that clients have explicitly subscribed to.

#### Resource List Changed Notification

The resource list changed notification is sent from the server to the client when the list of available resources has changed.

_Notification_:
- method: 'notifications/resources/list_changed'
- params: none

Clients SHOULD request an updated resource list upon receiving this notification.


## List of common URI schemas
Here are some common URI schemes used in the context of MCP resources:

https://
: Used to represent a resource available on the web
: Servers SHOULD use this scheme only when the client can fetch the resource directly
: For other cases, servers SHOULD prefer a different or custom scheme

file://
: Used to identify resources that behave like a filesystem
: Does not need to map to an actual physical filesystem
: Servers MAY use XDG MIME types like inode/directory for non-regular files

s3://
: Used for Amazon S3 or S3-compatible object storage resources

gcp://
: Use for Google Cloud object storage resources

git://
: Used to identify Git repositories or specific Git objects

data:
: Used to embed small pieces of data directly in the URI
: Useful for simple, static resources

custom://
: Servers can define custom schemes for application-specific resources
: Should be documented clearly for clients to understand and use properly

zed://
: Reserved for integration with the Zed editor.
  - zed://prompt-library
    : Prompts provided by MCP servers for the Zed prompt library
