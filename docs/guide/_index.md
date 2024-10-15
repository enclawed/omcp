---
title: Guide
cascade:
  type: docs
---
The Model Context Protocol (MCP) is a protocol designed to enable LLM assistant surfaces to receive contextual information from specialized servers. Whether you're building an IDE coding assistant, a chat interface, or any other LLM-powered application, MCP provides a standardized way to obtain and utilize relevant context.

## What is MCP?

MCP separates the concerns of providing context from the LLM interaction loop itself. This separation allows developers to:

- Create pluggable context providers that work across multiple LLM surfaces
- Implement custom context gathering workflows without modifying the LLM application
- Combine multiple context sources to enhance LLM interactions

## Key Components

The protocol consists of two main parts:

1. **MCP Servers**: Processes or services that provide context through various means (file systems, databases, APIs, etc.)
2. **MCP Clients**: Applications that connect to MCP servers to obtain context for LLM interactions

## How to Use This Guide

This guide is structured to help you understand and implement MCP in your applications:

1. Start with the installation and basic setup instructions
2. Learn about core concepts and components
3. Follow practical examples for both client and server implementations
4. Explore advanced features and best practices

Whether you're building a new MCP server, integrating MCP into an existing application, or just exploring the protocol, this guide will help you navigate the implementation process.

Let's begin by setting up your development environment and getting familiar with the basic concepts.
