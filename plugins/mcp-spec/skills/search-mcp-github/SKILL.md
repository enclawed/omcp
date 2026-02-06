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

## Sources

| Source | URL |
|--------|-----|
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

## Execution Steps

1. **Run all 4 search commands** in parallel to gather results from all sources
2. **Deduplicate** results that may appear in both org and repo searches
3. **Summarize findings** grouped by source type:
   - Discussions (with answers if available)
   - Issues (note if open/closed)
   - Pull Requests (note if merged/closed/open)
4. **Highlight key insights** relevant to the user's topic
5. **Provide direct links** to the most relevant items

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

## Tips

- Use specific keywords for better results
- Check both the title and body content of results
- For feature history, prioritize merged PRs and closed issues
- Discussion answers often contain authoritative responses
- Cross-reference related issues/PRs mentioned in discussions
