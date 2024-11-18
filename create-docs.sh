#!/bin/bash

# Create base directories
mkdir -p docs/{guides,recipes,deployment,api,server-api,client-api,typescript,python}

# Function to create an .mdx file with frontmatter
create_mdx() {
    local filepath=$1
    local title=$2
    local description=$3
    
    echo "Creating $filepath..."
    cat > "$filepath" <<EOL
---
title: "$title"
description: "$description"
---

# $title

$description
EOL
}

# Get Started
create_mdx "docs/quickstart.mdx" "Quick Start" "Get started with MCP in minutes with this practical guide"
create_mdx "docs/installation.mdx" "Installation" "Install and configure MCP in your environment"
create_mdx "docs/key-concepts.mdx" "Key Concepts" "Essential concepts in the Model Context Protocol"
create_mdx "docs/development.mdx" "Development" "Development workflow and best practices"

# Guides
create_mdx "docs/guides/first-mcp-server.mdx" "Your First MCP Server" "Build a complete MCP server from scratch"
create_mdx "docs/guides/integrating-with-llm.mdx" "Integrating with LLM Applications" "Add MCP support to your LLM application"
create_mdx "docs/guides/working-with-resources.mdx" "Working with Resources" "Learn how to expose and consume data through MCP"
create_mdx "docs/guides/implementing-tools.mdx" "Implementing Tools" "Create tools that LLMs can invoke"
create_mdx "docs/guides/security-best-practices.mdx" "Security Best Practices" "Secure your MCP implementations"
create_mdx "docs/guides/testing-debugging.mdx" "Testing and Debugging" "Test and debug your MCP servers effectively"

# Recipes
create_mdx "docs/recipes/local-files.mdx" "Local File Access" "Implement local file access in MCP"
create_mdx "docs/recipes/database-integration.mdx" "Database Integration" "Connect databases to your LLM through MCP"
create_mdx "docs/recipes/api-integration.mdx" "API Integration" "Wrap external APIs with MCP"
create_mdx "docs/recipes/realtime-updates.mdx" "Real-time Updates" "Handle live data updates in MCP"

# Deployment
create_mdx "docs/deployment/environment-setup.mdx" "Environment Setup" "Set up your production environment"
create_mdx "docs/deployment/configuration.mdx" "Configuration" "Configure MCP servers for production"
create_mdx "docs/deployment/monitoring.mdx" "Monitoring" "Monitor your MCP servers in production"

# API Reference
create_mdx "docs/api/protocol-overview.mdx" "Protocol Overview" "Understanding the Model Context Protocol"
create_mdx "docs/api/message-types.mdx" "Message Types" "Complete reference of MCP message formats"
create_mdx "docs/api/error-handling.mdx" "Error Handling" "Handle errors in MCP implementations"

# Server APIs
create_mdx "docs/server-api/resource-management.mdx" "Resource Management" "Manage resources in your MCP server"
create_mdx "docs/server-api/tool-implementation.mdx" "Tool Implementation" "Implement tools in your MCP server"
create_mdx "docs/server-api/event-handling.mdx" "Event Handling" "Handle events in your MCP server"

# Client APIs
create_mdx "docs/client-api/connection-management.mdx" "Connection Management" "Manage MCP client connections"
create_mdx "docs/client-api/resource-consumption.mdx" "Resource Consumption" "Work with MCP resources from clients"
create_mdx "docs/client-api/tool-invocation.mdx" "Tool Invocation" "Invoke MCP tools from clients"

# TypeScript SDK
create_mdx "docs/typescript/class-reference.mdx" "TypeScript Class Reference" "Complete TypeScript SDK class documentation"
create_mdx "docs/typescript/type-definitions.mdx" "TypeScript Type Definitions" "TypeScript type system documentation"
create_mdx "docs/typescript/examples.mdx" "TypeScript Examples" "Example TypeScript implementations"

# Python SDK
create_mdx "docs/python/class-reference.mdx" "Python Class Reference" "Complete Python SDK class documentation"
create_mdx "docs/python/type-hints.mdx" "Python Type Hints" "Python type system documentation"
create_mdx "docs/python/examples.mdx" "Python Examples" "Example Python implementations"

echo "Documentation structure created successfully!"