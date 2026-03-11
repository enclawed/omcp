---
date: "2026-03-16T00:00:00+00:00"
publishDate: "2026-03-16T00:00:00+00:00"
title: "Tool Annotations as Risk Vocabulary: What Hints Can and Can't Do"
author: "Ola Hungerford (Maintainer), Sam Morrow (GitHub), Luca Chang (AWS)"
tags: ["mcp", "tool annotations", "security", "tools"]
ShowToc: true
draft: false
---

MCP tool annotations were introduced nearly a year ago as a way for servers to describe the behavior of their tools — whether they're read-only, destructive, idempotent, or reach outside their local environment. Since then, the community has filed six independent SEPs proposing new annotations, driven in part by a sharper collective understanding of where risk actually lives in agentic workflows. This post recaps where tool annotations are today, what they can and can't realistically do, and offers a framework for evaluating new proposals.

## What Tool Annotations Are

[Tool annotations](https://modelcontextprotocol.io/specification/2025-11-25/server/tools) shipped in the `2025-03-26` spec revision. The current [`ToolAnnotations` interface](https://modelcontextprotocol.io/specification/2025-11-25/schema#toolannotations) looks like this:

```typescript
interface ToolAnnotations {
  title?: string;
  readOnlyHint?: boolean; // default: false
  destructiveHint?: boolean; // default: true
  idempotentHint?: boolean; // default: false
  openWorldHint?: boolean; // default: true
}
```

Every property is a **hint**. The spec is explicit about this: annotations are not guaranteed to faithfully describe tool behavior, and clients **must** treat them as untrusted unless they come from a trusted server.

These four boolean hints give clients a basic risk vocabulary:

- **`readOnlyHint`**: Does the tool modify its environment?
- **`destructiveHint`**: If it does modify things, is the change destructive (as opposed to additive)?
- **`idempotentHint`**: Can you safely call it again with the same arguments?
- **`openWorldHint`**: Does the tool interact with an open world of external entities, or is its domain closed?

The first three hints mostly answer a preflight question: should the client ask for confirmation before calling this tool? `openWorldHint` is different. It's about where the tool reaches and what its output might carry back, which matters after the call as much as before. It's also the hint most sensitive to deployment context. "External" might mean anything outside a corporate network or anything beyond the local machine, depending on where the server runs. The safest posture is to treat anything a tool considers **external** as a potential source of untrusted content.

The defaults are deliberately cautious: a tool with no annotations is assumed to be non-read-only, potentially destructive, non-idempotent, and open-world. The spec assumes the worst until told otherwise. Making annotations optional kept the barrier to entry low for server authors, but it also means coverage is uneven. Many servers ship without them, and clients vary in how strictly they honor the pessimistic defaults. Closing that gap is part of what the current wave of SEPs is trying to do.

## How We Got Here

The original [PR #185](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/185) discussion reveals a fundamental tension that still shapes every annotation proposal today: **what value do hints provide when they can't be trusted?**

Early iterations of PR #185 experimented with variant types and enums, but the design settled on simple booleans for extensibility and simplicity. An earlier proposal for a `sensitive` flag ([PR #176](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/176)) was superseded by the broader annotation set.

The trust concern has always been front and center. As MCP co-creator Justin Spahr-Summers put it during review: "I think the information itself, _if it could be trusted_, would be very useful, but I wonder how a client makes use of this flag knowing that it's _not_ trustable." Basil Hosmer from Anthropic went further, noting that clients should arguably ignore annotations from untrusted servers entirely — "especially the ones that describe operational properties." The resolution was pragmatic: label everything as "hints," require clients to treat them as untrusted by default, and let the trust relationship between client and server determine how much weight to give them.

Since the initial merge, `title` was added as a display annotation ([PR #663](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/663)). A proposed `taskHint` annotation was ultimately implemented as a dedicated `Tool.execution` field instead ([PR #1854](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/1854)), reflecting a pattern of separating execution concerns from metadata hints.

Several earlier proposals have also been closed without merging — including [PR #489](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/489) (stateless, streaming, and async annotations) and [SEP-1075](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/1075) (security annotations). The bar for adding new annotations to the spec is deliberately high. Each now requires a formal SEP with clear rationale for how clients would use it.

## The Active Landscape

Six independent SEPs currently propose new annotations or annotation-adjacent capabilities:

| SEP                                                                               | Proposal                                         | Status               |
| --------------------------------------------------------------------------------- | ------------------------------------------------ | -------------------- |
| [#1913](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/1913)   | Trust and Sensitivity Annotations                | Draft                |
| [#1938](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/1938)   | `agencyHint` tool annotation                     | Rejected (migrating) |
| [#1984](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/1984)   | Comprehensive Tool Annotations for Governance/UX | Draft                |
| [#1561](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/1561) | `unsafeOutputHint`                               | Proposal             |
| [#1560](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/1560) | `secretHint`                                     | Proposal             |
| [#1487](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/1487) | `trustedHint`                                    | Proposal             |

GitHub and OpenAI, among others, have co-authored proposals like SEP-1913 specifically to address gaps they've encountered delivering MCP to their users. Even where a specific proposal has been rejected — as with `agencyHint`, which was turned down in its current form — the underlying need hasn't vanished. The newly-forming Tool Annotations Interest Group also has related proposals like [SEP-1862](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/1862) (Tool Resolution/Preflight Checks) on its agenda, and aims to consider these proposals holistically rather than reviewing them in isolation, because the combinations of annotations are what matter most for understanding the risks and behavior around a given tool.

## The Lethal Trifecta: Why Combinations Matter

In June 2025, Simon Willison described what he called the [lethal trifecta](https://simonwillison.net/2025/Jun/16/the-lethal-trifecta/) for AI agents — three capabilities that, when combined, create the conditions for data theft:

1. **Access to private data**
2. **Exposure to untrusted content**
3. **The ability to externally communicate** (exfiltrate data)

Willison's argument is simple: LLMs follow instructions in content. They can't reliably distinguish between instructions from the user and instructions embedded in a web page, email, or document by an attacker. If an agent has all three of these capabilities available, an attacker who controls any piece of untrusted content can potentially trick the model into reading private data and sending it somewhere it shouldn't go.

We've seen this play out in the wild. [Security researchers have disclosed vulnerabilities](https://layerxsecurity.com/blog/claude-desktop-extensions-rce/) where an attacker embeds malicious instructions in a Google Calendar event description. Any agent reading that event via an MCP-connected calendar server while also holding a local code execution tool is at risk of following the injected instructions — a textbook instance of the lethal trifecta via MCP tool chaining.

What makes this especially relevant to MCP is that the protocol is built for mixing and matching tools from different servers, and agentic workflows demand it. Server A might provide access to private data. Server B might expose untrusted content. Server C might be able to send emails. Individually, each server might be perfectly safe. Combined, they can create exactly the conditions Willison describes.

One commenter on Willison's newsletter captured the connection to tool annotations directly:

> "If the current state is tainted, block (or require explicit human approval for) any action with exfiltration potential... This also makes MCP's mix-and-match story extra risky unless tools carry metadata like: `reads_private_data` / `sees_untrusted_content` / `can_exfiltrate` — and the runtime enforces 'never allow all three in a single tainted execution path.'"

That's the aspiration behind several of the open annotation SEPs: give clients enough metadata to reason about the combination of tools, not just individual tools in isolation.

## What Annotations Can Do

Even with the trust constraints and caveats of only being **hints**, tool annotations still provide meaningful value in several ways:

**Informing human-in-the-loop decisions.** A client can use annotations to decide when to prompt a user for confirmation. A tool marked `readOnlyHint: true` from a trusted server might be auto-approved, while one marked `destructiveHint: true` gets an explicit confirmation step. Concretely: a user asks their agent to clean up old files, the agent reaches for a `delete_file` tool, and because the tool carries `destructiveHint: true`, the client surfaces a confirmation dialog listing exactly what's about to be deleted before anything happens. This is the clearest and most defensible use of annotations today.

**Enabling graduated trust models.** Not all servers are equally untrusted. An enterprise deploying its own internal MCP servers behind authentication has a different trust relationship than a solo developer installing a random server from the internet. Annotations from a trusted server can drive meaningful policy decisions. From an untrusted server, they're informational at best.

In practice, though, client implementations run the spectrum from ignoring annotations entirely, to allowing for more granular approval models, to acting on them unconditionally. Across these approaches, user installation itself often serves as the primary trust signal. Graduated models where annotations are weighted differently based on server provenance, or where conditional policies can be configured or applied based on a combination of context and annotations, are still largely theoretical. Custom registries haven't yet bridged this gap as clients generally don't distinguish servers based on whether they came from a trusted registry.

Part of what drives this uneven landscape is a real philosophical divide in how people use MCP. On one end, developers building ultra-autonomous agents may see confirmations and policy gates as friction to be eliminated, relying instead on isolated environments to limit the blast radius. On the other, enterprise adopters might not touch a tool without guardrails, audit trails, and approval chains. These two camps have very different relationships with annotations: one barely notices they exist, the other wants far more than the current set provides. Both are valid use cases, but the gap between them means annotation support gets pulled in two directions (or, perhaps more often, in neither).

**Improving UX and discoverability.** The `title` annotation exists purely for display purposes. Even without trust implications, annotations that help users understand what tools do — without executing them — improve the overall experience. However, no MCP client currently lets users self-filter available tools by these values. GitHub's read-only mode acts as a production analog to annotation-driven filtering, but is enabled by only about 17% of users. That figure could reflect limited awareness, satisfaction with defaults, or a real gap in tooling for annotation-aware workflows. Whichever reading is right, there's room to grow.

**Supporting policy engines.** Organizations building MCP infrastructure can use annotations as inputs to policy engines that enforce rules like "no destructive tools without approval" or "open-world tools require VPN." The annotations don't need to be perfectly trustworthy if the policy engine has other signals to cross-reference.

## What Annotations Can't Do

This is where expectations need calibrating.

**Annotations can't solve prompt injection.** No amount of metadata on a tool definition will prevent an LLM from following malicious instructions embedded in content. The lethal trifecta is a property of the _runtime interaction_ between the model, the content, and the available tools. Tool annotations describe static properties of tools; they don't control dynamic model behavior.

**Annotations can't make untrusted servers trustworthy.** A malicious server can lie about its annotations. A server claiming `readOnlyHint: true` while actually deleting your files is always possible. This is why the spec says clients **must** treat annotations as untrusted from untrusted servers. Annotations don't create trust; they operate within an existing trust relationship.

**Annotations can't replace deterministic controls.** As we previously noted in [the server instructions post](https://blog.modelcontextprotocol.io/posts/2025-11-03-using-server-instructions/): don't rely on instructions (or annotations) for critical actions that need to happen in conjunction with other actions, especially in security or privacy domains. These are better implemented as deterministic rules or hooks. If you need to guarantee that a tool can't exfiltrate data, the answer is network-level controls, not a boolean hint.

**Annotations can't fully describe tool risk in isolation.** A `search_emails` tool is neither safe nor dangerous on its own. Its risk profile depends entirely on what other tools are available in the same session. Annotations on individual tools are necessary but not sufficient for risk assessment.

## A Framework for Evaluating New Annotations

As the Tool Annotations Interest Group begins its work, here's a framework for evaluating whether a proposed annotation belongs in the spec.

### 1. What client behavior does this annotation enable?

This is the most important question, and one that maintainer Jonathan Hefner raised directly on [PR #616](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/616) (an earlier draft of what became [SEP-1984](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/1984)): "it's not clear to me exactly how a client would behave differently when presented with these annotations." If you can't describe a concrete client action that changes based on the annotation, it probably doesn't belong in the protocol.

The existing annotations pass this test. `readOnlyHint: true` can mean "skip the confirmation dialog." `destructiveHint: true` can mean "show a warning." `idempotentHint: true` can mean "safe to retry on failure." `openWorldHint: true` can mean "scrutinize this tool's output for untrusted content" or "flag that this session now spans your trust boundary." Each maps to a specific client decision, even if different clients make different decisions.

### 2. Does the annotation require trust to be useful?

Some annotations are useful even from untrusted servers (like `title` — worst case, it's a bad display name). Others are only useful if you trust the server (like `readOnlyHint` — a lie here could bypass safety checks). Proposals should be clear about where on this spectrum they fall, because that determines how broadly they can be adopted.

### 3. Could this be handled by `_meta` instead?

The spec provides `Tool._meta` with namespaced keys (e.g., `com.example/my-field`) as the designated extension point for custom metadata. If an annotation is only useful to specialized clients or specific deployment scenarios, it may be better served by `_meta` than by a protocol-level field. The bar for adding to `ToolAnnotations` should be high: the annotation should be broadly useful across the ecosystem.

`_meta` is also a reasonable place to incubate. A vendor can ship a namespaced field, validate it with real usage across their clients and servers, and then bring a SEP with concrete evidence that it works and that others want it. That's a much stronger starting point than a proposal written in the abstract. Several of the open SEPs would benefit from this path: prove it in `_meta` first, promote to the spec second.

### 4. Does it help reason about tool combinations?

Given the increased risks of tools and servers used in combination, the highest-value annotations are ones that help clients reason about what happens when tools are used together. `openWorldHint` already points this way: a client could use it to flag that a session combines closed-world data access tools with open-world communication tools. Future annotations that help clients build a richer picture of combined risk are worth prioritizing.

### 5. Is it a hint or a contract?

This question matters because it determines where enforcement should live. If you need a guarantee, build a contract — in the authorization layer, in the transport, in the runtime. If you need a signal that helps humans and policy engines make better decisions, build a hint. Trying to use hints as contracts creates a false sense of security that's worse than having no annotation at all.

## Where This Is Heading

The Tool Annotations Interest Group, with participation from GitHub, OpenAI, VS Code, and others, is taking on the work of considering these proposals together. The group will evaluate whether runtime annotations are worth adding, which additional annotations serve both server and client authors, and whether tool _response_ annotations should exist alongside tool _definition_ annotations.

Our hope is that this interest group can bring more coherence to what's currently a set of standalone proposals, each solving a real problem but lacking a unified view. The combinations of annotations are what matter most for understanding the risks and behavior around a given tool. That's hard to get right by reviewing proposals in isolation.

If you're building MCP servers, start with the annotations that exist today. Set `readOnlyHint: true` on your read-only tools. Use `destructiveHint: false` for additive operations. Mark closed-domain tools with `openWorldHint: false`. These are small additions that help clients make better decisions right now.

If you're building MCP clients, treat annotations from untrusted servers as informational but not actionable for security decisions. Use them for UX improvements. Build your actual safety guarantees on deterministic controls.

And if you're thinking about proposing a new annotation, ask yourself: what specific client behavior does this enable, and does the benefit survive the constraint that the hint might not be truthful?

## Get Involved

The Tool Annotations Interest Group is forming now. If you're interested in contributing:

- Review the open SEPs linked above and leave feedback
- Join the conversation in `#agents-wg` on the [MCP Contributors Discord](https://modelcontextprotocol.io/community/communication)
- Watch for the formal interest group proposal and channel in the Discord server

## Acknowledgements

This post draws on discussions with the MCP community, particularly the contributors involved in the Tool Annotations Interest Group proposal, including Sam Morrow (GitHub), Robert Reichel (OpenAI), Den Delimarsky (Anthropic), Nick Cooper (OpenAI), Connor Peet (VS Code), and Luca Chang (AWS).
