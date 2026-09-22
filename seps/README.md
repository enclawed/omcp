# Proposals

A proposal is a design document for a substantial change to the Open Model Context Protocol —
and it is **a pull request**. There is no separate track, no sponsor to find, and no approval to
request before opening one.

Full guidelines: https://openmodelcontextprotocol.org/community/sep-guidelines

## Why this directory is still called `seps/`

These documents were historically called Specification Enhancement Proposals, and every one of
them is numbered by the pull request that introduced it. The directory keeps its name and the
existing numbering so that every proposal inherited from upstream — and every external citation
of one — keeps a stable, resolvable identity.

What changed is the process around them, not the documents. A proposal is reviewed in its pull
request, in the open, on technical merit.

## SEP file structure

Each proposal is a single markdown file in this directory named `NNNN-short-title.md`, where
`NNNN` is the number of the pull request that introduced it. Use `0000` as a placeholder until
the PR exists, then rename.

Start from [`TEMPLATE.md`](./TEMPLATE.md). The structure is:

| Section                      | Required | Contents                                                                 |
| ---------------------------- | -------- | ------------------------------------------------------------------------ |
| **Preamble**                 | yes      | Title, status, type, creation date, author(s), PR link                   |
| **Abstract**                 | yes      | ~200 word technical summary                                              |
| **Motivation**               | yes      | The problem: what breaks, who hits it, under what conditions             |
| **Specification**            | yes      | Syntax and semantics, detailed enough for interoperable reimplementation |
| **Rationale**                | yes      | Why this design, what else was considered, objections raised             |
| **Backward Compatibility**   | if any   | What breaks, how severe, and the migration path                          |
| **Security Implications**    | yes      | Attack surface, privacy, authn/authz, validation — or "none", explicitly |
| **Reference Implementation** | yes      | Link to a prototype reviewers can run, with its setup and data           |
| **Tests**                    | yes      | The tests that verify it, and where the data they need lives             |
| **Reference Documentation**  | yes      | The chapter written for the official reference docs, in the same PR      |

Optional sections: Performance Implications, Alternatives Considered, Open Questions,
Acknowledgments.

### Preamble fields

```markdown
- **Status**: Draft | In-Review | Accepted | Rejected | Withdrawn | Final | Superseded
- **Type**: Standards Track | Informational | Process | Extensions Track
- **Created**: YYYY-MM-DD
- **Author(s)**: Name <email> (@github-username)
- **PR**: https://github.com/enclawed/omcp/pull/{NUMBER}
```

The markdown file is the canonical record of status; PR labels mirror it so proposals can be
filtered. Authors maintain the status of their own proposals.

## The bar

A proposal is a pull request, so the same five requirements apply:

1. It follows good coding practices.
2. It solves a real problem.
3. It states that problem clearly.
4. It ships working tests anybody can verify independently — **including the data to run them**.
5. It ships its chapter for the official reference documentation, written by its author.

Authorship belongs to humans. Nobody asks which tools you used to get there.

## Rendering

`docs/seps/*.mdx` is generated from this directory. Do not edit those files by hand; run:

```bash
npm run generate:seps
```
