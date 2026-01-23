# SEP-2133: Extensions

- **Status**: Draft
- **Type**: Standards Track
- **Created**: 2025-01-21
- **Author(s)**: Peter Alexander <pja@anthropic.com> (@pja-ant)
- **Sponsor**: None (seeking sponsor)
- **PR**: [#2133](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2133)

## Abstract

This SEP establishes a lightweight framework for extending the Model Context Protocol through optional, composable extensions. This proposal defines a governance model and presentation structure for extensions that allows the MCP ecosystem to evolve while maintaining core protocol stability. Extensions enable experimentation with new capabilities without forcing adoption across all implementations, providing clear extension points for the community to propose, review, and adopt enhanced functionality.

At this stage we are only defining official extensions, i.e. those maintained by MCP maintainers. Externally maintained extensions will likely come at a later stage once this initial SEP is approved.

## Motivation

MCP currently lacks any form of guidance on how extensions are to be proposed or adopted. Without a process, it is unclear how these extensions are governed, what expectations there are around implementation, how they should be referenced in the specification, etc.

## Specification

### Definition

An MCP extension is an optional addition or change to the spec that provides functionality or guidance that is either experimental in nature (i.e. not yet ready for core protocol inclusion) or only applies in a limited domain (e.g. internal to a company, or only within a specific industry).

Extensions are identified using a unique _extension identifier_ with the format: `{vendor-prefix}/{extension-name}`, e.g. `io.modelcontextprotocol/oauth-client-credentials` or `com.example/websocket-transport`. Breaking changes should use a new identifier, e.g. `io.modelcontextprotocol/oauth-client-credentials-v2`. The names follow the same rules as the [\_meta keys](https://modelcontextprotocol.io/specification/draft/basic/index#meta), except that the prefix is mandatory.

Extensions may have settings that are sent in client/server messages for fine-grained configuration.

For now, we only define _Official Extensions_. _Unofficial extensions_ will not yet be recognized by MCP governance, but may be introduced and governed by developers and distributed in non official channels like GitHub.

### Official Extensions

Official extensions live inside the MCP github org at https://github.com/modelcontextprotocol/ and are officially developed and recommended by MCP maintainers. Official extensions use the `io.modelcontextprotocol` vendor prefix in their extension identifiers.

An _extension repository_ is a repository within the official modelcontextprotocol github org with the `ext-` prefix, e.g. https://github.com/modelcontextprotocol/ext-auth.

- Extension repositories are created at the core maintainers discretion with the purpose of grouping extensions in a specific area (e.g. auth, transport, financial services).
- A repository has a set of maintainers (identified by MAINTAINERS.md) appointed by the core maintainers that are responsible for the repository and extensions within it.

An _extension_ is a versioned specification document within an extension repository, e.g. https://github.com/modelcontextprotocol/ext-auth/blob/main/specification/draft/oauth-client-credentials.mdx

- Extension specifications should use the same language as the core specification (i.e. [[BCP 14](https://www.rfc-editor.org/info/bcp14)] [[RFC2119](https://datatracker.ietf.org/doc/html/rfc2119)] [[RFC8174](https://datatracker.ietf.org/doc/html/rfc8174)]) and should be worded as if they were part of the core specification.

While day-to-day governance is delegated to extension repository maintainers, the core maintainers retain ultimate authority over official extensions, including the ability to modify, deprecate, or remove any extension.

### Lifecycle

For official extensions, the lifecycle is similar to a SEP, but delegated to the extension repository maintainers:

1. Author creates a SEP in the main MCP repository using the [standard SEP guidelines](https://modelcontextprotocol.io/community/sep-guidelines) but with a new type: **Extensions Track**. This type follows the same review and acceptance process as Standards Track SEPs, but clearly indicates that the proposal is for an extension rather than a core protocol addition.
2. Extension SEPs are reviewed by the relevant extension repository maintainers.
3. Once approved, the author should produce a PR that introduces the extension to the extension repository and reference in the main spec (see _Spec Recommendation_ section).
4. Approved extensions may be implemented in clients / servers / SDKs immediately (see _SDK Implementation_).

Eventually, some extensions may transition to being core protocol features. This should be treated as a standard protocol SEP with separate core maintainer review.

### Spec Recommendation

Extensions will be referenced from a new page on the MCP website at [modelcontextprotocol.io/extensions](http://modelcontextprotocol.io/extensions) (to be created) with links to their specification.

Links to relevant extensions may also be added to the core specification as appropriate (e.g. https://modelcontextprotocol.io/specification/draft/basic/authorization may link to ext-auth extensions), but they MUST be clearly advertised as optional extensions and should be links only (not copies of specification text).

### SDK Implementation

SDKs may optionally implement extensions. Where implemented, extensions MUST be disabled by default and require explicit opt-in. SDK documentation SHOULD list supported extensions.

SDK maintainers have full autonomy over extension support in their SDKs:

- Maintainers are solely responsible for the implementation and maintenance of any extensions they choose to support.
- Maintainers are under no obligation to implement any extension or accept contributed implementations. Extension support is not required for 100% protocol conformance or the upcoming SDK conformance tiers.
- This SEP does not prescribe how SDKs should structure or package extensions. Maintainers may provide extension points, plugin systems, or any other mechanism they see fit.

### Evolution

All extensions evolve **independently** of the core protocol, i.e. a new version of an extension may be published without review by the core maintainers.

Extensions should be versioned, but exact versioning approach is not specified here.

### Negotiation

Clients and servers advertise their support for extensions in the [ClientCapabilities](https://modelcontextprotocol.io/specification/2025-06-18/schema#clientcapabilities) and [ServerCapabilities](https://modelcontextprotocol.io/specification/2025-06-18/schema#servercapabilities) fields respectively, and in the [Server Card](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/1649) (currently in progress).

A new "extensions" field will be introduced to each that is a map of _extension identifiers_ to per-extension settings objects. Each extension specifies the schema of its settings object; an empty object indicates no settings.

#### Client Capabilities

Clients advertise extension support in the `initialize` request:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2025-06-18",
    "capabilities": {
      "roots": {
        "listChanged": true
      },
      "extensions": {
        "io.modelcontextprotocol/ui": {
          "mimeTypes": ["text/html;profile=mcp-app"]
        }
      }
    },
    "clientInfo": {
      "name": "ExampleClient",
      "version": "1.0.0"
    }
  }
}
```

#### Server Capabilities

Servers advertise extension support in the `initialize` response:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "2025-06-18",
    "capabilities": {
      "tools": {},
      "extensions": {
        "io.modelcontextprotocol/ui": {}
      }
    },
    "serverInfo": {
      "name": "ExampleServer",
      "version": "1.0.0"
    }
  }
}
```

#### Server-Side Capability Checking

Servers SHOULD check client capabilities before offering extension-specific features:

```typescript
const hasUISupport = clientCapabilities?.extensions?.[
  "io.modelcontextprotocol/ui"
]?.mimeTypes?.includes("text/html;profile=mcp-app");

if (hasUISupport) {
  // Register tools with UI features
} else {
  // Register text-only fallback
}
```

#### Graceful Degradation

If one party supports an extension but the other does not, the supporting party MUST assume that features introduced by the extension will not work and revert to core protocol behavior. Extensions SHOULD document their expected fallback behavior. For example, a server offering UI-enhanced tools should still return meaningful text content for clients that do not support the UI extension.

### Legal Requirements

#### Trademark Policy

- Use of MCP trademarks in extension identifiers does not grant trademark rights. Third parties may not use 'MCP', 'Model Context Protocol', or confusingly similar marks in ways that imply endorsement or affiliation.
- MCP makes no judgment about trademark validity of terms used in extensions.

#### Antitrust

- Extension developers acknowledge that they may compete with other participants, have no obligation to implement any extension, are free to develop competing extensions and protocols, and may license their technology to third parties including for competing solutions.
- Status as an official extension does not create an exclusive relationship.
- Extension repository maintainers act in individual capacity using best technical judgment.

#### Licensing

Official extensions must be available under the Apache 2.0 license.

#### Contributor License Grant

By submitting a contribution to an official MCP extension repository, you represent that:

1. You have the legal authority to grant the rights in this agreement
2. Your contribution is your original work, or you have sufficient rights to submit it
3. You grant to Linux Foundation and recipients of the specification a perpetual, worldwide, non-exclusive, no-charge, royalty-free, irrevocable license to:
   - Reproduce, prepare derivative works of, publicly display, publicly perform, sublicense, and distribute the contribution
   - Make, have made, use, offer to sell, sell, import, and otherwise transfer implementations

#### No Other Rights

Except as explicitly set forth in this section, no other patent, trademark, copyright, or other intellectual property rights are granted under this agreement, including by implication, waiver, or estoppel.

### Not Specified

This SEP does not specify all aspects of an extension system. The following is an incomplete list of what this SEP does not address:

- **Schema**: we do not specify a mechanism for extensions to advertise how they modify the schema.
- **Dependencies**: we do not specify if/how extensions may have dependencies on specific core protocol versions, or interdependencies with other extensions (or versions of extensions).
- **Profiles**: we do not specify a way of grouping extensions.

These are omitted not because they are unimportant, but because they may be added later and the goal of this SEP is simply to get some initial extension structure off the ground and defers detailed technical discussion around more complex/debatable aspects of extensions.

## Rationale

This design for extensions uses the following principles:

- **Start simple**: the intention is to have a relatively simple mechanism that allows people to start building and proposing extensions in a structured way.
- **Clear governance**: For now, the focus is on clear governance and less on implementation details.
- **Refine later**: Over time, once we have more experience with extensions, we can adjust the approach appropriately.

Some specific design choices:

- **Why extension repositories instead of individual/independent extensions?** Repositories provide a natural group and governance structure that allows for the repository maintainers to enforce structure and conformity to extensions. It avoids a failure case of different extensions in an area working in incompatible ways. Also provides a way to delegate much of the governance work.
- **Why not require core maintainer review for official extensions?** Delegated reviews allows for extensions to evolve autonomously without being bottlenecked on core maintainer review, which is already a (often months) long process.
- **Why separate versioning?** Extensions are additions to the spec and optional so there is no need to tie versions together. Separate versions allow for more rapid iteration.

## Backward Compatibility

Extensions are purely additive in nature, so there are no backwards compatibility concerns.

The design described in this SEP is consistent with existing official extensions ([ext-apps](https://github.com/modelcontextprotocol/ext-apps) and [ext-auth](https://github.com/modelcontextprotocol/ext-auth)), which already use the patterns specified here for capability negotiation and extension identifiers.

Individual extensions themselves should consider and account for backwards compatibility in their design, both across core protocol versions and extension versions. Extensions should also document their approach to backwards compatibility and stability (e.g. an extension may advertise itself as "experimental" indicating that it may break without notice).

## Security Implications

Extensions must implement all related security best practices in the area that they extend.

Clients and servers should treat any new fields or data introduced as part of an extension as untrusted and should be comprehensively validated.

## Reference Implementation

To be provided.
