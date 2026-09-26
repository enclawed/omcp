# ATSA 1.0 — Attested Tool-Server Admission

Reference implementation of [SEP-2809](../../seps/2809-attested-tool-server-admission.md).

A tool server publishes an offline-signed clearance assertion. A host verifies it against a
locally pinned trust root before dispatching any tool call, and authorizes individual tools
separately from admitting the server.

Nothing here changes the wire protocol. The attestation is fetched out of band from
`/.well-known/mcp-attestation`, so an unextended host never asks for it and an unextended server
never notices, which is what lets the mechanism roll out incrementally.

**Version 1.0.** The extension version and the document version are separate: this is ATSA 1.0,
and the documents it reads carry `"v": "1.0"`. A verifier rejects a MAJOR it does not understand
and accepts a higher MINOR, which is additive. The version is a string because JSON does not
distinguish `1.0` from `1`.

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

## Points this implementation settled

Implementing the specification surfaced two under-specified points. Both were resolved in
SEP-2809 before it reached Final, which is the process working rather than a workaround.

**Rejecting an unsupported document version had no reason code.** The SEP required verifiers to
reject versions they do not understand, but its registry enumerated only the numbered rules. It
now registers `unsupported_version` (0), which precedes the numbered rules because a document
whose version is not understood cannot be evaluated against them. `tool_not_admitted` is
numbered 9.

**Key approval is an explicit list.** Rule 5 required that "the key is approved for the asserted
clearance" without saying how approval is expressed. A ceiling and an explicit list differ for
non-contiguous approvals, so the trust root uses `approvedClearances`, an explicit list of
canonical level names. Approval is compared against the canonical name, so an alias cannot widen
a key's scope — now stated in rule 5 itself.
