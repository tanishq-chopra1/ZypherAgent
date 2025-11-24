# Zypher Code Navigator

An AI agent built with [Zypher](https://zypher.corespeed.io) that helps you
understand and refactor any codebase directly from the CLI.

Run it inside a repository, ask questions in natural language, and the agent will:

- Read relevant source files using Zypher's `ReadFileTool`
- Optionally create markdown notes (e.g. `notes/overview.md`) with summaries
  and refactor plans using `EditFileTool`
- Optionally call a Firecrawl MCP server to research external docs (if configured)

This project is my technical assessment submission for **CoreSpeed**.

---

## Features

- 🧠 **Agentic loop** using `ZypherAgent.runTask` with streaming events
- 📂 **Workspace-aware**: points Zypher at the current directory
- 🛠️ **File tools**: uses `ReadFileTool` and `EditFileTool` to inspect & update files
- 📝 **Markdown output**: clean, dev-friendly responses

---

## Tech Stack

- [Deno](https://deno.com/) + TypeScript
- [@corespeed/zypher](https://github.com/CoreSpeed-io/zypher-agent)
- Anthropic Claude as the model provider

---

## Setup

### 1. Clone the repo

```bash
git clone https://github.com/<your-username>/zypher-code-navigator.git
cd zypher-code-navigator
