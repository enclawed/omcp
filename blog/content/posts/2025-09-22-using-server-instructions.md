+++
date = '2025-09-22T00:00:00+00:00'
publishDate = '2025-09-22T00:00:00+00:00'
draft = false
title = 'Server Instructions: Giving LLMs a user manual for your server'
author = 'Ola Hungerford (Maintainer)'
tags = ['automation', 'mcp', 'server instructions', 'tools']
+++

Many of us are still exploring the nooks and crannies of MCP and learning how to best use the building blocks of the protocol to enhance our agents and applications.  Some features, like [Prompts](https://blog.modelcontextprotocol.io/posts/2025-07-29-prompts-for-automation/), are more frequently implemented and used.  Others may appear a bit more obscure but have a lot of influence on how well an agent will understand your server.  Server instructions are one of the latter.

## The Problem

Imagine you're a Large Language Model (LLM) who just got handed a collection of tools from servers A, B, and C to complete a task.  They might have already been carefully pre-selected or they might be more like what my physical workbench looks like in my garage - a mishmash of whatever I've been using in the last few weeks.

Now lets say that the developer of Server A has pre-existing knowledge or preferences about how best to use their tools or prompts, as well as more background information about the underlying systems that power them.

Some examples could include:

- 'Tool C should always be used after tool A and B'
- 'This prompt or tool works best if specialized tools from other servers X and Y are available'
- 'Server A tools are rate limited to 10 requests per minute'
- 'Always look up the user's language and accessibility preferences before attempting to fetch any resources with this server.'
- 'Only use tool A to ask the user for their preferences if elicitation is supported.  Otherwise, fall back to using default user preferences.'

## Solutions

One solution could be to include this extra information in every tool description or prompt provided by the server.  Going back to the physical tool analogy, however: you can only depend on "labeling" each tool if there is enough space to describe them.  A model's context window is limited - there's only so much information you can fit into that space.  And even if all those labels can fit within your model's context limits, the more tokens you cram into that space, the more likely it is you might cause more confusion than clarity.

Alternatively, relying on just prompts to give common instructions like this means that:

- The prompt always needs to be selected by the user, and
- The instructions are more likely to get lost in the shuffle of other messages.  

Imagine a pile of post-it notes, all filled with instructions on how to do things with a drawer full of tools.  It's totally possible that you have the right notes lined up in front of you to do everything reliably, but it's not always the most efficient way to provide this type of context.

For global instructions that you want the LLM to always follow - instead of including them in multiple tool descriptions or prompts, it can make more sense to include them in the model's system prompt instead.

This is where **server instructions** come in. Server instructions give the server a way to inject information that the LLM should always read in order to understand how to use the server - independent of individual prompts, tools, or messages.

**Note:** because the exact way that the MCP host uses server instructions is up to the implementer, it's not always guaranteed that they will be injected into the system prompt.  It's always recommended to evaluate a client's behavior with your server and its tools before relying on this functionality.

## Implementing Server Instructions Example: Optimizing Common GitHub Workflows

A concrete example of server instructions in action comes from my experiments with the [GitHub MCP server](https://github.com/github/github-mcp-server). Even with advanced options like toolsets for optimizing tool selection, models may not consistently follow optimal multi-tool workflow patterns or struggle to 'learn' the right combinations of tools through trial and error.

### The Problem: Detailed Pull Request Reviews

One common use case where I thought instructions could be helpful is when asking an LLM to "Review pull request #123." Without more guidance, a model might decide to over-simplify and use the `create_and_submit_pull_request_review` tool to add all review feedback in a single comment.  This isn't as helpful as leaving multiple inline comments for a detailed code review.

### The Solution: Workflow-Aware Instructions

One solution I tested with the GitHub server is to add instructions based on enabled toolsets.  My hypothesis was that this would improve the consistency of workflows across models, while still ensuring that we're only loading relevant instructions for the tools we want to use.  Here is an example of what I added for if the `pull_requests` toolset is enabled:

```go
func GenerateInstructions(enabledToolsets []string) string {
    var instructions []string
    
    // Universal context management - always present
    baseInstruction := "GitHub API responses can overflow context windows. Strategy: 1) Always prefer 'search_*' tools over 'list_*' tools when possible, 2) Process large datasets in batches of 5-10 items, 3) For summarization tasks, fetch minimal data first, then drill down into specifics."
    
    // Toolset-specific instructions
    if contains(enabledToolsets, "pull_requests") {
        instructions = append(instructions, "PR review workflow: Always use 'create_pending_pull_request_review' → 'add_comment_to_pending_review' → 'submit_pending_pull_request_review' for complex reviews with line-specific comments.")
    }
    
    return strings.Join(append([]string{baseInstruction}, instructions...), " ")
}
```

### Measuring Effectiveness: Quantitative Results

To validate the impact of server instructions, I ran a simple controlled evaluation in VSCode comparing model behavior with and without the PR review workflow instruction. Using 40 GitHub PR review sessions on the same set of code changes, I measured whether models followed the optimal three-step workflow.

I used the following tool usage pattern to differentiate between successful vs unsuccessful reviews:

- **Success:** `create_pending_pull_request_review` → `add_comment_to_pending_review` → `submit_pending_pull_request_review`
- **Failure:** Single-step `create_and_submit_pull_request_review` OR no review tools used.  (Sometimes the model decided just to summarize feedback but didn't leave any comments on the PR.)

You can find more setup details and raw data from this evaluation in [this repo](https://github.com/olaservo/mcp-server-instructions-demo).

For this sample of chat sessions, I got the following results:

| Model | With Instructions | Without Instructions | Improvement |
|-------|------------------|---------------------|-------------|
| **GPT-5-Mini** | 8/10 (80%) | 2/10 (20%) | **+60%** |
| **Claude Sonnet-4** | 9/10 (90%) | 10/10 (100%) | N/A |
| **Overall** | 17/20 (85%) | 12/20 (60%) | **+25%** |

In this example, GPT-5-Mini benefitted most from explicit workflow guidance, since Sonnet almost always followed the inline comment workflow by default.

## Implementing Server Instructions: General Tips For Server Developers

One key to good instructions is focusing on **what tools and resources don't convey**:

1. **Capture cross-feature relationships**:
    
    ```json
    {
      "instructions": "Always call 'authenticate' before any 'fetch_*' tools. The 'cache_clear' tool invalidates all 'fetch_*' results."
    }
    ```
    
2. **Document operational patterns**:
    
    ```json
    {
      "instructions": "For best performance: 1) Use 'batch_fetch' for multiple items, 2) Check 'rate_limit_status' before bulk operations, 3) Results are cached for 5 minutes."
    }
    ```
    
3. **Specify constraints and limitations**:
    
    ```json
    {
      "instructions": "File operations limited to workspace directory. Binary files over 10MB will be rejected. Rate limit: 100 requests/minute across all tools."
    }
    ```
    

### Anti-Patterns to Avoid

❌ **Don't repeat tool descriptions**:

```json
// Bad - duplicates what's in tool.description
"instructions": "The search tool searches for files. The read tool reads files."

// Good - adds relationship context
"instructions": "Use 'search' before 'read' to validate file paths. Search results expire after 10 minutes."
```

❌ **Don't include marketing or superiority claims**:

```json
// Bad
"instructions": "This is the best server for all your needs! Superior to other servers!"

// Good
"instructions": "Specialized for Python AST analysis. Not suitable for binary file processing."
```

❌ **Don't write a manual**:

```json
// Bad - too long and detailed
"instructions": "This server provides comprehensive functionality for... [500 words]"

// Good - concise and actionable
"instructions": "GitHub integration server. Workflow: 1) 'auth_github', 2) 'list_repos', 3) 'clone_repo'. API rate limits apply - check 'rate_status' before bulk operations."
```

### What Server Instructions Can't Do:

- **Guarantee certain behavior:** As with any text you give to an LLM, your instructions aren't going to be followed the same way all the time.  Anything you ask a model to do is like rolling a dice. The reliability of any instructions will vary based on randomness, sampling parameters, model, client implementation, other servers and tools at play, and many other variables.
	- Don't rely on instructions for any critical actions that need to happen in conjunction with other actions, especially in security or privacy domains. These are better implemented as deterministic rules or hooks.
- **Account for suboptimal tool design:** Tool descriptions and other aspects of interface design for agents are still going to make or break how well LLMs can use your server when they need to take an action.

## Currently Supported Host Applications

At the time of writing only a few host applications support server instructions.  For a complete list, refer to the [Clients](https://modelcontextprotocol.io/clients) page in the MCP documentation.

For a basic demo of server instructions in action, you can use the [Everything reference server](https://github.com/modelcontextprotocol/servers/tree/main/src/everything) to confirm that your client supports this feature:

1. Install the Everything Server in your host. The link above includes instructions on how to do this in a few popular applications.  In the example below, we're using [Claude Code](https://docs.anthropic.com/en/docs/claude-code/mcp).
2. Once you've confirmed that the server is connected, ask the model: `does the everything server tools have any special 
  instructions?`
3. If the model can see your instructions, you should get a response like the one below:

<img
    src="/posts/images/claude_code_instructions.JPG"
    alt="Screenshot of response which reads: Server instructions are working!"
  />

## Wrapping Up

Although it's just a simple text field, this post skimmed the surface of how server instructions can be used and implemented in both MCP servers.  Be sure to share your own examples, thoughts, and questions on [Discord](https://modelcontextprotocol.io/community/communication).  

## Acknowledgements

Parts of this blog post were sourced from discussions with the MCP community, contributors, and maintainers including:

- [@akolotov](https://github.com/akolotov)
- [@cliffhall](https://github.com/cliffhall)
- [@connor4312](https://github.com/connor4312)
- [@digitarald](https://github.com/digitarald)
- [@dsp-ant](https://github.com/dsp-ant)
- [@evalstate](https://github.com/evalstate)
- [@ivan-saorin](https://github.com/ivan-saorin)
- [@jegelstaff](https://github.com/jegelstaff)
- [@localden](https://github.com/localden)
- [@tadasant](https://github.com/tadasant)
- [@toby](https://github.com/toby)
