+++
date = '2025-11-25T00:00:00+00:00'
publishDate = '2025-11-25T00:00:00+00:00'
draft = true
title = 'One Year of MCP: November 2025 Spec Release'
author = 'David Soria Parra (Lead Maintainer)'
tags = ['mcp', 'spec', 'release', 'protocol', 'anniversary']
+++

## A Year In

It's been exactly one year since we [launched the Model Context Protocol (MCP)](https://www.anthropic.com/news/model-context-protocol). With all the changes that we've made, it feels like decades ago. The protocol has since been adopted by a huge number of developers and organizations, and we've learned a lot from watching people build quite real things with it.

<!--TODO: Add a GIF of MCP usage-->

The growth and fast adoption would not be possible without a _massive_ community that developed around the protocol. We've seen SDK implementations pop up in languages we hadn't even considered. Server implementations we'd never imagined. Client integrations with tools we didn't know existed. We see folks build production systems on top of MCP, filing detailed bug reports, contributing Spec Enhancement Proposals (SEPs), and helping each other out in Discord and GitHub. That's not something you can manufacture — it just happens when you build something people _actually need_.

<!--TODO: Add some photos from events/community gatherings-->

We are _incredibly_ thankful to every single community member, maintainer, and contributor - every contribution, whether to our documentation, protocol, samples, SDKs, or just evangelizing MCP helped make the protocol what it is today.

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

Asking users for their API keys through your MCP client is a terrible idea. We all know this. But until now, there wasn't a good alternative.

**URL mode elicitation** lets you send users to a proper OAuth flow in their browser, where they can authenticate securely without your client ever seeing their credentials. It's what we should have had from day one.

**What This Enables:**

- **Secure credential collection**: API keys and passwords never transit through the MCP client
- **External OAuth flows**: MCP servers can obtain third-party authorization without token passthrough
- **Payment processing**: PCI-compliant financial transactions with secure browser contexts

The server sends a URL. The client shows it to the user. The user clicks it and completes whatever flow they need to in their browser. The MCP client never touches the sensitive bits. Simple.

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
