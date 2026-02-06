---
name: search-mcp-github
description: Search MCP discussions, issues, and PRs across the modelcontextprotocol GitHub org
user_invocable: true
arguments:
  - name: topic
    description: The topic or keyword to search for
    required: true
---

# Search MCP GitHub

Search across Model Context Protocol GitHub discussions, issues, and pull requests to find relevant information about a topic.

## MCP Docs Server

This plugin includes the `mcp-docs` MCP server (`https://modelcontextprotocol.io/mcp`), which provides a `SearchModelContextProtocol` tool for searching the official MCP documentation. If the server is available, **prefer using it first** to search for specification details, API references, and protocol concepts before falling back to GitHub searches. The MCP docs server is authoritative for current spec content, while GitHub is better for historical decisions, proposals, and community discussion.

## Sources

| Source | URL |
|--------|-----|
| MCP Docs Server | `mcp-docs` MCP server (SearchModelContextProtocol tool) |
| Org Discussions | https://github.com/orgs/modelcontextprotocol/discussions |
| Spec Discussions | https://github.com/modelcontextprotocol/modelcontextprotocol/discussions |
| Spec Issues | https://github.com/modelcontextprotocol/modelcontextprotocol/issues |
| Spec PRs | https://github.com/modelcontextprotocol/modelcontextprotocol/pulls |

## Important: Search Closed Items Too

When researching past decisions, rationale, or history of a feature, **always search CLOSED issues and PRs** in addition to open ones. Closed items often contain:
- Design decisions and their rationale
- Why certain approaches were rejected
- Historical context for current implementations
- Completed feature discussions

## Search Commands

### 1. Search Issues (Open and Closed)

```bash
gh search issues "<topic>" --repo modelcontextprotocol/modelcontextprotocol --limit 20 --json number,title,url,state,body
```

### 2. Search Pull Requests (Open and Closed)

```bash
gh search prs "<topic>" --repo modelcontextprotocol/modelcontextprotocol --limit 20 --json number,title,url,state,body
```

### 3. Search Spec-Level Discussions

```bash
gh api graphql -f query="query { search(query: \"repo:modelcontextprotocol/modelcontextprotocol <topic>\", type: DISCUSSION, first: 20) { nodes { ... on Discussion { title url body category { name } answer { body } } } } }"
```

### 4. Search Org-Level Discussions

```bash
gh api graphql -f query="query { search(query: \"org:modelcontextprotocol <topic>\", type: DISCUSSION, first: 20) { nodes { ... on Discussion { title url body category { name } answer { body } } } } }"
```

## Search Term Variants

GitHub search does **not** treat `"Tool Annotations"` and `"ToolAnnotations"` as equivalent. Before searching, generate variants of the topic to ensure broad coverage:

- **camelCase**: `ToolAnnotations`, `inputSchema`, `readOnlyHint`
- **Separated words**: `Tool Annotations`, `input schema`, `read only hint`
- **Hyphenated/kebab-case**: `tool-annotations`, `input-schema`
- **Singular/plural**: `annotation` vs `annotations`, `resource` vs `resources`

Run the search commands for **each meaningful variant**. For example, searching for "Tool Annotations" should also search for "ToolAnnotations" — the camelCase form matches interface names in the schema and will surface different results (e.g., the original PR that introduced the feature).

## Execution Steps

1. **Generate search term variants** from the topic (camelCase, separated, etc.)
2. **Check for `mcp-docs` server** — if the SearchModelContextProtocol tool is available, search the official docs first for spec-level content
3. **Run all 4 GitHub search commands for each variant** in parallel to gather results from all sources
4. **Deduplicate** results that may appear across variants and across org/repo searches
5. **Summarize findings** grouped by source type:
   - Discussions (with answers if available)
   - Issues (note if open/closed)
   - Pull Requests (note if merged/closed/open)
5. **Highlight key insights** relevant to the user's topic
6. **Provide direct links** to the most relevant items

## Output Format

Present results in this format:

### Discussions
- [Title](url) - Brief summary of discussion content

### Issues
- #123 [Title](url) - **Open/Closed** - Brief summary

### Pull Requests
- #456 [Title](url) - **Merged/Closed/Open** - Brief summary

### Key Insights
Summarize the most important findings and any decisions or consensus reached.

## Deep Dive into a PR

When a search result points to a relevant PR, use these commands to get the full context. PR discussions on GitHub are split across three different comment types, each requiring a different API call.

### 1. Top-Level Comments

General conversation on the PR (not tied to specific lines of code):

```bash
gh pr view <number> --repo modelcontextprotocol/modelcontextprotocol --comments --json comments
```

### 2. Inline Review Comments

Comments left on specific lines of code during review. These are the most common place for substantive design feedback and are **not** included in `gh pr view`:

```bash
gh api repos/modelcontextprotocol/modelcontextprotocol/pulls/<number>/comments --jq '.[] | {user: .user.login, path: .path, line: .line, body: .body, diff_hunk: .diff_hunk}'
```

### 3. Review Summaries

Top-level review bodies submitted with an approve/request-changes/comment verdict:

```bash
gh api repos/modelcontextprotocol/modelcontextprotocol/pulls/<number>/reviews --jq '.[] | {user: .user.login, state: .state, body: .body}'
```

### When to Deep Dive

- When a search result PR looks highly relevant to the topic
- When you need to understand **why** a change was made, not just **what** changed
- When top-level comments are sparse — the real discussion is often in inline reviews

## Tips

- **Always search multiple variants** of the topic — GitHub treats `ToolAnnotations` and `Tool Annotations` as different queries
- Use specific keywords for better results
- Check both the title and body content of results
- For feature history, prioritize merged PRs and closed issues
- Discussion answers often contain authoritative responses
- Cross-reference related issues/PRs mentioned in discussions
