# ATSA — Attested Tool-Server Admission

Reference implementation of [SEP-2809](../../seps/2809-attested-tool-server-admission.md).

A tool server publishes an offline-signed clearance assertion. A host verifies it against a
locally pinned trust root before dispatching any tool call, and authorizes individual tools
separately from admitting the server.

Nothing here changes the wire protocol. The attestation is fetched out of band from
`/.well-known/mcp-attestation`, so an unextended host never asks for it and an unextended server
never notices, which is what lets the mechanism roll out incrementally.

## What is in here

| Path                             | Contents                                            |
| -------------------------------- | --------------------------------------------------- |
| `schema/attestation.schema.json` | JSON Schema for the Server Attestation Document     |
| `src/canonicalize.ts`            | The exact bytes a signature is computed over        |
| `src/verify.ts`                  | Host verification rules 1–8, and tool authorization |
| `test/vectors/`                  | Committed conformance vectors, one file per rule    |
| `test/generate-vectors.ts`       | Regenerates those vectors reproducibly              |

## Running the tests

```bash
npm test
```

No network, no browser, no key material to supply: the vectors and the trust root they verify
against are committed. Every denial reason in the specification's error registry is exercised by
at least one vector, and a test fails if one stops being covered.

To regenerate the vectors and confirm they are byte-for-byte reproducible:

```bash
npx tsx extensions/atsa/test/generate-vectors.ts
git diff --exit-code extensions/atsa/test/vectors
```

The signing keys are derived from fixed seeds and are committed deliberately. They are test
material and sign nothing real.

## Using it

```ts
import { verifyAttestation, authorizeTool } from "./extensions/atsa/src";

const result = verifyAttestation(sad, trustRoot, {
  origin: "https://tools.example.com",
  requiredClearance: "internal",
  denyByDefault: true,
});

if (!result.admitted) {
  // result.reason is the machine-readable code from the SEP's registry,
  // e.g. "signer_not_trusted"; result.detail says which check failed.
  return;
}

// Admission is not authorization: check each tool against the allow-list
// before any network dispatch, whatever tools/list advertised.
if (!authorizeTool("get_forecast", allowList).admitted) return;
```

## Notes on the specification

Two points where the implementation had to decide something the SEP leaves open. Both are worth
resolving in the text before this reaches Final.

**An unsupported document version has no registered reason code.** SEP-2809 says a verifier "MUST
reject versions it does not understand", but its error registry enumerates nine reasons and none
of them covers it. This implementation reports `unsupported_version` with code `0`, which is
outside the registry's numbering. The specification should either register a code or state that
version rejection is not surfaced in band.

**Key approval is modelled as an explicit list.** Rule 5 requires that "the key is approved for
the asserted clearance" without saying how approval is expressed. A `maxClearance` ceiling and an
explicit list of permitted levels behave differently for non-contiguous approvals, so the trust
root here uses `approvedClearances`, an explicit list, as the unambiguous reading.

Approval is checked against the _canonical_ level name, so an alias cannot be used to widen a
key's scope. That follows from the rules but is not stated in them.
