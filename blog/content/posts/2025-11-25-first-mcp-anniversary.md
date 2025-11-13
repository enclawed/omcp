---
date: "2025-11-25T00:00:00+00:00"
publishDate: "2025-11-13T00:00:00+00:00"
draft: true
title: "One Year of MCP: November 2025 Spec Release"
author: "David Soria Parra (Lead Maintainer)"
tags: ["mcp", "spec", "release", "protocol", "anniversary"]
---

## A Year In

It's been exactly one year since we [launched the Model Context Protocol (MCP)](https://www.anthropic.com/news/model-context-protocol). With all the changes that we've made, it feels like decades ago. The protocol has grown leaps and bounds since then and has been adopted by a huge number of developers and organizations. We went from a little open source experiment to the de-facto standard for connecting data and applications to Large Language Models (LLMs).

Not only that, but we've also seen the protocol get adopted by developers and organizations of all sizes - if you think about it, there's likely an MCP server for it! There are _thousands_ of MCP servers out there that can help anyone be productive with their AI tools.

Here are just a few of many (very many) MCP servers that were created to solve very real customer problems:

- Notion [built an MCP server](https://github.com/makenotion/notion-mcp-server) to help you manage your notes.
- Stripe has a [pretty extensive MCP server](https://docs.stripe.com/mcp#tools) to manage all kinds of payment workflows.
- GitHub [built their own MCP server](https://github.com/github/github-mcp-server) to help developers automate their engineering processes.
- Hugging Face [created an MCP server](https://github.com/huggingface/hf-mcp-server) to make model management and dataset search a breeze.
- Postman [built their MCP server](https://github.com/postmanlabs/postman-mcp-server) to help automate API testing workflows.

There's so much more to discover in the MCP ecosystem! To make that easier, earlier this year we also launched the [MCP Registry](https://blog.modelcontextprotocol.io/posts/2025-09-08-mcp-registry-preview/) - all in collaboration with our community. Check it out to find more MCP servers that might be useful what _you_ do.

### Community

I would be remiss if I didn't mention that the success and growth of MCP would not be possible without a huge community around it. This was not a one company effort. Folks from all over the globe, from students to hobbyists, to experts working at startups and big companies, all chipped in to make the protocol what it is today.

![](/posts/images/first-mcp-anniversary/david-mcp-may.webp)

We've seen SDK implementations pop up in languages we hadn't considered from the start. Server implementations we'd never imagined (did you know there is a [MCP server for Blender](https://github.com/ahujasid/blender-mcp)?). Client integrations with tools we didn't know the community needed. We see developers build production systems on top of MCP, contributing [Spec Enhancement Proposals (SEPs)](https://modelcontextprotocol.io/community/sep-guidelines) and SDK patches, and helping each other out in [Discord](https://modelcontextprotocol.io/community/communication) and [GitHub](https://github.com/modelcontextprotocol/modelcontextprotocol). That's not something you can manufacture or even plan for when launching an open source project like MCP.

Through the past year, we've also seen the community rally and organize events where they can talk and learn about MCP, and nothing makes me prouder than seeing the protocol take a life of its own. From events like [MCP Dev Summit](https://mcpdevsummit.ai/), [MCP Night](https://workos.com/mcp-night), [MCP Dev Days](https://developer.microsoft.com/en-us/reactor/series/S-1563/), and even the biggest AI events like [AI Engineer World's Fair](https://wf2025.ai.engineer/worldsfair/2025) - we've seen MCP shine and generate so much excitement.

![](/posts/images/first-mcp-anniversary/kent-jarvis-mcp.webp)

We are _incredibly_ thankful to every single community member, maintainer, and contributor - every change and improvement, whether to our documentation, protocol, samples, SDKs, or just helping others be successful with MCP helped make the protocol what it is today.

### Governance

One of the big changes we've made to the protocol in the past year is establish a formal governance process. As we scaled, it became evident that we needed help not only with streamlining adoption, but also around _how_ we would be evolving the protocol. In service of that goal, we established a formal [governance structure](https://blog.modelcontextprotocol.io/posts/2025-07-31-governance-for-mcp/) that leans heavily on expertise from both community leaders as well as internal Anthropic folks.

Our team of maintainers has been hard at work the entire year, hopping from coast to coast and meeting to both align the protocol with a durable future direction as well as ensure that all voices are heard.

![](/posts/images/first-mcp-anniversary/maintainers-write.webp)

The group of maintainers responsible for MCP is not just a technical team - they are stewards of the protocol evolution. You might've seen that since we put this structure in place, individual maintainers were involved in more than one conversation in Discord and our GitHub repository. We're empowering our maintainers to come up with creative solutions to MCP's most salient challenges and then work on bringing them into the protocol.

![](/posts/images/first-mcp-anniversary/maintainers-meetup.webp)

This governance model has proven its worth over the past year. By combining community expertise with structured decision-making, we've been able to move quickly on critical improvements while ensuring the protocol remains stable and backward compatible. Of course, our work here is not done and we're continuously looking for both input and help in making our structure even better.

## The November 2025 Release

The latest release of the MCP protocol specification ships with a number of highly-anticipated features that came directly from our community deploying and using MCP for production scenarios. People told us what wasn't working, what was missing, and what papercuts prevented them from being able to use MCP. We listened and worked together with our community experts to deliver a number of enhancements that help make MCP even more scalable and reliable.

### Tasks: Long-Running Operations Made Simple

**SEP:** [1686](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/1686)

One of the top requests we heard over and over was around asynchronous data processing. For questions like "_How do I handle operations that take more than a few seconds?_" the answer used to be "_Well, you kind of don't._" That wasn't a good answer.

The new approach for asynchronous operations through **tasks** fixes this. You can now start an operation, go do other things, and come back later to check if it's done. Revolutionary? No. Necessary? Absolutely.

Some noteworthy capabilities that this enables:

- **Asynchronous execution**: Start operations and retrieve results later without blocking
- **Active polling**: Clients can check the status of ongoing work at any time
- **Flexible lifecycle management**: Support for submitted, working, completed, failed, and cancelled states
- **Task isolation**: Proper security boundaries with session-based access control

From the multitude of MCP servers that we've seen out there, this is particularly helpful for scenarios such as the ones below.

- Healthcare & life sciences data analysis that processes hundreds of thousands of data points
- Enterprise automation platforms with complex multi-step workflows
- Code migration tools that run for minutes or hours
- Test execution platforms that need to stream logs from long-running suites
- Deep research tools that spawn multiple agents internally
- Multi-agent systems where agents can work concurrently

Tasks are launching as an **experimental capability**, meaning that it's part of the core protocol but it's not yet finalized. Asynchronous execution is a tough problem to solve at scale, so we want to give some time to the specification to be battle-tested in real-world scenarios. We'll work closely with the community, SDK developers, as well as client and server implementers to get this right.

### URL Mode Elicitation: Secure Out-of-Band Interactions

**SEP:** [1036](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/1036)

Asking users for their API keys, tokens, or any other credentials directly through the MCP client might seem like quite a scary proposition. This is especially critical when you need to connect an MCP server to an array of _other_ APIs, where the traditional client-to-server authorization flow doesn't quite work. Until now, there wasn't a good alternative - you either had to rely on the client _somehow_ getting those credential securely and passing them to the server, or implement a bunch of custom authorization logic to be used from the start.

**URL mode elicitation** lets you send users to a proper OAuth flow (or any credential acquisition flow, for that matter) in their browser, where they can authenticate securely without your client ever seeing the entered credentials. The credentials are then directly managed by the server and the client only needs to worry about its own authorization flow to the server.

I am excited about adding this in addition to capabilities that we already have, like elicitation, because it allows the protocol to be used for a few scenarios that were quite hard to get right, such as:

- **Secure credential collection**: API keys and passwords never transit through the MCP client
- **External OAuth flows**: MCP servers can now obtain third-party authorization without token passthrough
- **Payment processing**: PCI-compliant financial transactions with secure browser contexts can now be done outside the client

All the server does is send a URL that the client will provide an affordance for. When the user completes the flow in their browser, they will effectively pass the data _directly_ to the server without any extra middlemen or manual steps. Simple!

### Sampling with Tools: Agentic Servers

**SEP:** [1577](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/1577)

This functionality allows MCP servers to run their own agentic loops using the client's tokens (still under the user's control, of course), and reduces the complexity of client implementations, context support becoming explicitly optional. This came from the fact that [sampling](https://modelcontextprotocol.io/specification/2025-06-18/client/sampling) doesn't support tool calling, although it's a cornerstone of modern agentic behaviour. With the new spec release, this is no longer a gap!

Now that sampling with tools is available, this also means that all of the scenarios below are possible!

- **Tool calling in sampling requests**: Servers can now include tool definitions and specify tool choice behavior
- **Server-side agent loops**: Servers can implement sophisticated multi-step reasoning
- **Parallel tool calls**: Support for concurrent tool execution
- **Better context control**: The ambiguous `includeContext` parameter is being soft-deprecated in favor of explicit capability declarations

As an example, a research server can spawn multiple agents internally, coordinate their work, and deliver a coherent result while using nothing other than standard MCP primitives without custom scaffolding or complex orchestration code.

### Security and Enterprise Features

As the protocol matures, we also can't ignore the myriad of security and authentication/authorization needs. MCP is not just a hobby protocol - we've seen it adopted in some of the most mission-critical workloads. This translates into a direct need to ensure that all data is protected and access is properly managed.

Working with security and authentication experts from across the community, we've developed a number of enhancements shipping with this release:

- **[SEP-991](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/1296)**: URL-based client registration using OAuth Client ID Metadata Documents (you might've already seen our [blog post on this change from earlier this year](https://blog.modelcontextprotocol.io/posts/client_registration/))
- **[SEP-1046](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/1046)**: OAuth client credentials flow support for machine-to-machine authorization
- **[SEP-990](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/990)**: Enterprise IdP policy controls for MCP OAuth flows
- **[SEP-1024](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/1024)**: Client security requirements for local server installation
- **[SEP-835](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/835)**: Default scopes definition in authorization specification

To learn more about other upcoming auth and security improvements you can follow the [`auth`](https://github.com/modelcontextprotocol/modelcontextprotocol/issues?q=is%3Aissue%20state%3Aopen%20label%3Aauth) and [`security`](https://github.com/modelcontextprotocol/modelcontextprotocol/issues?q=is%3Aissue%20state%3Aopen%20label%3Asecurity) tags in the specification repository.

### Developer Experience Improvements

One of the core tenets of MCP is _simplicy_ - we want to make the developer and integration experience as intuitive as easy possible. To help achieve this, the latest spec release also adds a few minor changes that help make the protocol easier to use for developers.

- **[SEP-986](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/986)**: Standardized format for tool names
- **[SEP-1319](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/1319)**: Decoupled request payload from RPC methods definition
- **[SEP-1699](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/1699)**: SSE polling via server-side disconnect for better connection management
- **[SEP-1309](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/1309)**: Improved specification version management for SDKs

## Community and Governance

As I mentioned above, MCP grew beyond what any of us initially imagined. To help make that growth sustainable, we also worked on better documenting contribution and support processes, such as:

- **[SEP-1302](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/1302/)**: Formalization of Working Groups and Interest Groups
- **[SEP-1730](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/1730/)**: SDKs tiering system to clarify official and community support levels

## Looking Forward

This release is backward compatible. Your existing implementations keep working. The new features are there when you need them.

Looking ahead, we're excited about what's coming next for MCP. The protocol is entering a new phase, one where it's not just about connecting LLMs to data, but about enabling entirely new categories of AI-powered applications.

We're seeing early signals of this transformation already. Developers are building multi-agent systems that coordinate across dozens of MCP servers. Enterprise teams are deploying MCP at scale with sophisticated security and governance controls. Startups are launching products where MCP is the core architectural pattern.

The roadmap ahead includes deeper work on reliability and observability, making it easier to debug and monitor complex MCP deployments. We're exploring better patterns for server composition, allowing you to build sophisticated capabilities by combining simpler building blocks. And we're continuing to refine the security model to meet the needs of the most demanding enterprise environments.

What excites me most isn't what _we're_ planning to build but what _our community_ is going to build. Every week we see MCP servers designed, developed, and deployed in novel ways. Every conversation in Discord reveals new use cases and patterns. The protocol has become a bit of a canvas for AI innovation, and we can't fill it alone.

The next year of MCP will be shaped by more production deployments, more real-world feedback, amplified by the creativity of thousands of developers worldwide. We're here to support that growth, to ensure the protocol evolves thoughtfully, and to keep MCP stable, secure, and simple as it scales.

## Get Started

To get started with all the new goodness in the latest MCP specification release, check out the following resources:

- **Read the changelog**: All major changes are captured in our [Key Changes document](https://modelcontextprotocol.io/specification/draft/changelog)
- **Get to know our docs**: The [MCP documentation](https://modelcontextprotocol.io/docs/getting-started/intro) is the source of truth for the all the inner workings of the protocol
- **Join the discussion**: If you would like to contribute or engage with other MCP maintainers, start with our [GitHub repo](https://github.com/modelcontextprotocol/modelcontextprotocol) and [Discord](https://modelcontextprotocol.io/community/communication#discord)
