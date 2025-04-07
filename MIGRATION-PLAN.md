# Documentation Migration Plan

## Overview
This document outlines the plan for merging the MCP documentation from two repositories:
- Current repo (`modelcontextprotocol/specification`): Hugo/Hextra format
- Imported repo (`modelcontextprotocol/docs`): Mintlify/MDX format

The goal is to create a unified documentation system under Mintlify while preserving the full commit history from both repositories.

## Repository Structure
- Keep `specification/` as the main repository
- Move `imported-docs/` content into a new `user-guide/` directory
- Maintain separate schema validation and examples in the root

## Content Migration Approach
- Convert Hugo/Hextra shortcodes (like `{{< callout >}}`) to Mintlify MDX components
- Preserve all Mermaid diagrams (natively supported in both)
- Update internal links across all documents
- Keep versioned specification documentation intact

## Mintlify Configuration
- Keep `docs.json` as the configuration file (Mintlify's latest format)
- Update navigation structure to include specification pages
- Add specification versions as separate navigation groups

## Structure Reorganization
- `/docs/` → User guide documentation (from imported repo)
- `/specification/` → Specification docs (from current repo)
- `/resources/` → Resources (from current repo)
- `/schema/` → Schema definitions (keep as-is)

## Link and Reference Handling
- Update all `{{< ref >}}` links to Mintlify format
- Preserve external links to GitHub repos
- Update the specification links in the user guide to internal links

## Content Conversion Tasks
- Identify and convert all Hugo shortcodes
- Replace front matter metadata for Mintlify compatibility
- Convert weight-based ordering to explicit ordering in docs.json

## Implementation Steps
1. Import docs repository as Git subtree (preserving history) ✓
2. Create new directory structure
3. Convert and migrate content
4. Update configuration files
5. Test build locally with Mintlify
6. Review and validate content
7. Deploy to production