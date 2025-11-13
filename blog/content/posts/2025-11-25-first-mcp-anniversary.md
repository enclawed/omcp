+++
date = '2025-11-25T00:00:00+00:00'
publishDate = '2025-11-13T00:00:00+00:00'
draft = true
title = 'One Year of MCP: November 2025 Spec Release'
author = 'David Soria Parra (Lead Maintainer)'
tags = ['mcp', 'spec', 'release', 'protocol', 'anniversary']
+++

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

We've seen SDK implementations pop up in languages we hadn't considered from the start. Server implementations we'd never imagined (did you know there is a [MCP server for Blender](https://github.com/ahujasid/blender-mcp)?). Client integrations with tools we didn't know the community needed. We see developers build production systems on top of MCP, contributing [Spec Enhancement Proposals (SEPs)](https://modelcontextprotocol.io/community/sep-guidelines) and SDK patches, and helping each other out in [Discord](https://modelcontextprotocol.io/community/communication) and [GitHub](https://github.com/modelcontextprotocol/modelcontextprotocol). That's not something you can manufacture or even plan for when launching an open source project like MCP.

Through the past year, we've also seen the community rally and organize events where they can talk and learn about MCP, and nothing makes me prouder than seeing the protocol take a life of its own.

<!--TODO: Add some photos from events/community gatherings-->

We are _incredibly_ thankful to every single community member, maintainer, and contributor - every contribution, whether to our documentation, protocol, samples, SDKs, or just evangelizing MCP helped make the protocol what it is today.

### Governance



## The November 2025 Release

The latest release of the MCP spec ships with a number of highly-anticipated features that came directly from our community deploying and using MCP for production scenarios. People told us what wasn't working, what was missing, and what papercuts prevented them from being able to use MCP. We listened and worked together with our community experts to deliver a number of enhancements that help make MCP even more scalable and reliable.

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

MCP servers can now call tools and run their own loops. They use the client's LLM tokens (with user approval), but they handle the orchestration themselves.

**New Capabilities:**

- **Tool calling in sampling requests**: Servers can now include tool definitions and specify tool choice behavior
- **Server-side agent loops**: Servers can implement sophisticated multi-step reasoning
- **Parallel tool calls**: Support for concurrent tool execution
- **Better context control**: The ambiguous `includeContext` parameter is being soft-deprecated in favor of explicit capability declarations

A research server can spawn multiple agents internally, coordinate them, and give you back a coherent result. All through standard MCP.

### Security and Enterprise Features

The community has contributed several important security enhancements:

- **SEP-991**: URL-based client registration using OAuth Client ID Metadata Documents
- **SEP-1046**: OAuth client credentials flow support for machine-to-machine authorization
- **SEP-990**: Enterprise IdP policy controls during MCP OAuth flows
- **SEP-1024**: Client security requirements for local server installation
- **SEP-835**: Default scopes definition in authorization specification

### Developer Experience Improvements

We're making MCP easier to work with:

- **SEP-986**: Standardized format for tool names
- **SEP-1319**: Decoupled request payload from RPC methods definition
- **SEP-1699**: SSE polling via server-side disconnect for better connection management
- **SEP-1309**: Improved specification version management

## Community and Governance

MCP has grown beyond what we initially imagined. This release includes some structure around that growth:

- **SEP-1302**: Formalization of Working Groups and Interest Groups
- **SEP-1730**: SDKs tiering system to clarify official and community support levels

We need clear ways for people to contribute and participate. These changes help with that.

## Looking Forward

This release is backward compatible. Your existing implementations keep working. The new features are there when you need them.

Thanks to everyone who's contributed over the past year—the maintainers, SDK developers, server builders, client implementers, and community members who've filed issues and helped others. You made this happen.

## Get Started

Ready to try these new features?

- **Read the full specification**: Check out the [November 2025 specification draft](https://github.com/modelcontextprotocol/modelcontextprotocol)
- **Update your SDKs**: New SDK releases supporting these features are coming soon
- **Join the discussion**: Connect with the community on [Discord](https://discord.gg/modelcontextprotocol) and [GitHub](https://github.com/modelcontextprotocol)
