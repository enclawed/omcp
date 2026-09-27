# Tamper-Evident Audit Record Contract

A canonical byte form, a SHA-256 hash chain, and a verification procedure for audit records, with
a typed extension mechanism. Specified by
[SEP-3004](../../seps/3004-tamper-evident-audit-record-contract.md).

It composes with [ATSA](../atsa): ATSA decides whether a server may be admitted and which of its
tools are in bounds, and this contract makes each of those decisions auditable in a form that
cannot be quietly rewritten afterwards. Both canonicalize the same way, so a record and an
attestation hash consistently.

## Provenance

The contract, its reference verifier, and its conformance vectors are the work of
**Notboatanchor Labs LLC**, published at
[notboatanchor/audit-record-contract](https://github.com/notboatanchor/audit-record-contract)
under the Apache License 2.0, and vendored here from commit `105f3e2`
("Initial standalone publication: Tamper-Evident Audit Record Contract 1.0.0-draft.1",
2026-09-24).

Copyright and licence notices are retained; see [`NOTICE`](NOTICE) and the repository's
[`NOTICE`](../../NOTICE).

### Changes made on import

Apache-2.0 §4(b) asks that modifications be stated. These are all of them:

| File                            | Change                                                |
| ------------------------------- | ----------------------------------------------------- |
| `src/audit-record-contract.ts`  | **None.** Byte-identical to upstream.                 |
| `src/vectors.ts`                | **None.** Byte-identical to upstream.                 |
| `spec/audit-record-contract.md` | **None.** Byte-identical to upstream.                 |
| `NOTICE`                        | **None.** Byte-identical to upstream.                 |
| `vectors/run.ts`                | Not imported; replaced by `test/conformance.test.ts`. |

The upstream files are excluded from this repository's formatter and linter so they stay
byte-identical and the vendoring remains verifiable:

```bash
curl -sL https://raw.githubusercontent.com/notboatanchor/audit-record-contract/105f3e2/vectors/audit-record-contract.ts \
  | diff - extensions/audit-record/src/audit-record-contract.ts
```

## What was added here

`test/conformance.test.ts` runs the vectors under this repository's test runner, so a regression
fails the build instead of printing to a console nobody reads.

`test/additional-vectors.ts` supplies **four rejecting vectors that the upstream suite lacks**.
Two of its requirements were covered by accepting cases only:

| Requirement | Upstream coverage        | Consequence                                                           |
| ----------- | ------------------------ | --------------------------------------------------------------------- |
| C-REC-3     | 1 accepting, 0 rejecting | A verifier that always returned "ok" would pass the known-answer test |
| C-REC-5     | 1 accepting, 0 rejecting | The same, for emission completeness                                   |

The added vectors tamper with a protected core field, alter an extension's data, omit a required
`event_type`, and record a required event with no session link — each of which must be rejected.
They are kept in a separate file so the upstream suite stays byte-identical, and they are offered
back to that project.

Every requirement now has both an accepting and a rejecting case, and a test fails if that stops
being true.

## Running it

```bash
npm test
```

No network, no browser, no key material. 30 vectors: 26 vendored, 4 added.
