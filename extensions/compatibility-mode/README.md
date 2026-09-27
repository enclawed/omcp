# Compatibility mode

Holds an omcp implementation to MCP-defined behaviour, so an operator decides when to take what
omcp adds rather than having it decided for them.

|             |                           |
| ----------- | ------------------------- |
| Name        | `compatibility_mode`      |
| Values      | `no` (default), `yes`     |
| Environment | `OMCP_COMPATIBILITY_MODE` |

```ts
import { resolveCompatibilityMode, omcpAdditionsEnabled } from "./src";

const mode = resolveCompatibilityMode(); // explicit argument, then env, then "no"

if (omcpAdditionsEnabled(mode)) {
  // attestation, audit records, and anything else omcp adds
}
```

Nothing here is on the wire: this is a local decision, never negotiated with a peer. Incoming
omcp elements are ignored rather than rejected, in either mode, because rejecting would make an
omcp peer fail against a compatibility-mode implementation — the interoperability the setting
exists to protect.

An unrecognised value raises an error instead of falling back to the default. Reading `enabled`
as "no" would switch compatibility off for someone asking for it on.

Reference chapter: [Compatibility Mode](https://omcp.tech/extensions/compatibility-mode/overview).
