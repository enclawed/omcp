# Contributing to the Open Model Context Protocol

You do not need permission to contribute. There is no sponsor to find, no working group to
join, no meeting to attend, and no chat server to be vetted in. Open a pull request.

Every submission is judged openly, on GitHub, against the same five requirements. Nothing else.

## The submission bar

### 1. It follows good coding practices

Readable, consistent with the surrounding code, and no gratuitous churn. Match the conventions
already in the files you touch rather than importing your own. Keep the diff scoped to the
problem you are solving.

### 2. It solves a real problem

Speculative abstractions and changes that exist only to be tidy are not problems. Something has
to actually be broken, missing, or unworkable in production.

### 3. The problem is clearly stated

Your pull request must say, in plain language and up front:

- **What the problem is** — the concrete failure, gap, or limitation.
- **Who hits it and when** — the conditions that produce it, so a reader can recognise it.
- **Why the change fixes it** — how the solution addresses the cause rather than the symptom.

A PR that does not state its problem cannot be reviewed on merit, because there is nothing to
measure the solution against.

### 4. It ships working unit tests that anyone can verify independently

This is the part that is not negotiable.

- Tests must **actually exercise the change**, covering the failing case from requirement 3 and
  the behaviour you claim to have fixed.
- Tests must **pass on a clean checkout** with no manual setup steps, no credentials, and no
  access to anything private.
- Tests must be **independently verifiable by anybody** — a stranger clones the branch, runs the
  test command, and observes the same result you did.
- **Ship the data the tests need.** Fixtures, sample payloads, schemas, and example documents
  belong in the repository alongside the tests. A test that depends on data only you possess, on
  a live network service, or on a private endpoint is not independently verifiable and does not
  meet this bar.

If the change is untestable as written, that is evidence the design needs revisiting — not
grounds for an exemption.

### 5. It documents itself

Whoever opens the pull request writes the chapter for the official reference documentation that
covers the change, and ships it in the same pull request.

Not a changelog line and not a comment — the section a reader who has never seen your feature
would need in order to use it correctly. It states what the change does, how to use it, and where
its edges are.

The author is the person who understands the change best at the moment it is written, which is
why the job is theirs. Documentation written later, by someone else, is documentation that does
not get written.

A change that alters observable behaviour and ships without its chapter is incomplete, the same
way it would be incomplete without its tests.

## Authorship

Authorship belongs to humans. The person who opens a pull request is its author, is accountable
for it, and is credited for it.

We do not ask which tools you used to get there, and there is nothing to disclose. A good idea is
a good idea regardless of what executed it, and work is judged on what it does — against the five
requirements above — not on how it was produced.

## Practical steps

```bash
git clone https://github.com/enclawed/omcp.git
cd omcp
nvm install   # install the correct Node version
npm install   # install dependencies
git checkout -b your-change
```

Required tooling: Node.js 24 or above, TypeScript, TypeScript JSON Schema (for generating JSON
schema), and optionally [Mintlify](https://mintlify.com/) for docs and nvm for Node versions.

### Schema changes

Schema changes go in `schema/draft/schema.ts`. Validate them with:

```bash
npm run check:schema:ts
```

`schema/draft/schema.json` and `docs/specification/draft/schema.mdx` are generated from
`schema/draft/schema.ts`; do not edit them directly. Generate them with:

```bash
npm run generate:schema
```

#### Resolving merge conflicts in generated files

If your branch conflicts with `main` in generated files (`schema/*/schema.json`,
`docs/specification/*/schema.mdx`, `docs/seps/*.mdx`), do not resolve them by hand. Merge `main`,
resolve conflicts in the source files (e.g. `schema/draft/schema.ts`), then regenerate and commit:

```bash
git merge main
npm run generate
git add .
git commit
```

These files are marked with `-merge` in `.gitattributes`, so git keeps your branch's copy and
flags them as conflicted instead of inserting conflict markers.

### Documentation changes

Documentation is written in MDX in the [`docs`](./docs) directory. Preview and lint it with:

```bash
npm run serve:docs
npm run check:docs
npm run format
```

When writing docs: keep content clear and technically accurate, follow the existing file
structure and `kebab-case.mdx` naming, include code examples and proper frontmatter, verify
links with `npm run check:docs:links`, and update `docs.json` when adding pages.

### The published specification

Every change to `docs/specification/`, `schema/`, or `seps/` is republished as HTML and PDF. CI
builds it in strict mode on every pull request, so a change that introduces a broken link, an
unsupported component, or a diagram that fails to render fails the build. Preview it locally with
`npm run build:spec -- --no-pdf`. See
[Published Specification](docs/community/published-specification.mdx).

The builder in `scripts/spec-site/` has its own tests, run with `npm test`.

> [!NOTE]
> Run all schema and documentation checks at once with `npm run prep`.

## Protocol changes

Substantial protocol changes are written up as a proposal file in the [`seps/`](./seps)
directory and submitted as a pull request, so that the reasoning lives in version control next
to the specification it changes. See [`seps/README.md`](./seps/README.md).

A proposal is a technical document, not an application. It needs no sponsor and no prior
approval to be opened, and it is reviewed in the pull request thread in the open. It is a pull
request like any other, and the five requirements above apply to it unchanged — including the
tests, the data to run them, and the reference chapter.

## Review

Review happens in the pull request, in public, in writing. A change is evaluated on whether it
meets the five requirements — not on who submitted it, and not on conversations held anywhere
that is not the pull request.

A submission that is rejected is rejected with a stated technical reason. Silence is not review,
and a closed PR without one is a bug in the process.

## Compatibility

omcp maintains drop-in interoperability with the wider Model Context Protocol ecosystem.
Changes that break wire compatibility need to justify the break explicitly in the pull request
and provide a migration path.

## License

By contributing, you agree that your code or specification contributions will be licensed under
the Apache License 2.0. Documentation contributions (excluding specifications) are licensed
under CC-BY 4.0. See [LICENSE](LICENSE).

## Security

Please review our [Security Policy](SECURITY.md) for reporting security issues.
