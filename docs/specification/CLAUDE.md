# Documentation Style Guide

## General Structure

1. Every markdown file MUST start with a frontmatter section containing:

   ```yaml
   ---
   title: [Page Title]
   type: docs
   weight: [numeric weight for ordering]
   ---
   ```

2. After frontmatter, include the protocol revision callout:
   ```markdown
   {{< callout type="info" >}} **Protocol Revision**: {{< param protocolRevision >}}
   {{< /callout >}}
   ```

## Writing Style

1. Technical Requirements

   - Use RFC 2119 keywords (MUST, SHOULD, MAY) in all capitals when specifying
     requirements
   - Each requirement should be clear and unambiguous
   - Include code examples for technical concepts

2. Code Blocks

   - Use TypeScript for interface and type definitions
   - Include language identifier in code fence (```typescript)
   - Format code consistently with 2-space indentation

3. Lists and Structure

   - Use bullet points for related items without hierarchy
   - Use numbered lists for sequential steps or prioritized items
   - Indent sub-bullets consistently

4. Technical Accuracy
   - All code examples must be syntactically correct
   - Reference official specifications when applicable
   - Include links to related documentation

## Content Organization

1. Page Structure

   - Start with a brief overview/introduction
   - Use clear H2 (##) and H3 (###) headings
   - Group related concepts under common headings
   - End with relevant links or next steps if applicable

2. Section Hierarchy

   - Use H1 (#) for document title only
   - Use H2 (##) for major sections
   - Use H3 (###) for subsections
   - Avoid going deeper than H4

3. Cross-References
   - Use relative links for internal references
   - Use absolute links for external references
   - Include hover text for non-obvious links

## Formatting Conventions

1. Code and Technical Terms

   - Use backticks for inline code and technical terms
   - Use code blocks for multi-line code examples
   - Use proper syntax highlighting

2. Emphasis

   - Use bold (\*\*) for important terms and concepts
   - Use italics (\*) sparingly, mainly for emphasis
   - Avoid underlining

3. Tables
   - Use tables for structured data comparison
   - Include header row
   - Align columns consistently

## Special Elements

1. Callouts

   - Use for important notices or version information
   - Include type (info, warning, etc.)
   - Keep content concise

2. Cards
   - Use for navigation sections
   - Include relevant icons
   - Keep titles short and descriptive

## Language and Tone

1. Voice

   - Use active voice
   - Be direct and concise
   - Maintain technical precision

2. Terminology

   - Use consistent terminology throughout
   - Define technical terms on first use
   - Follow industry standard terminology

3. Audience
   - Write for technical implementers
   - Assume familiarity with basic concepts
   - Explain complex concepts clearly
