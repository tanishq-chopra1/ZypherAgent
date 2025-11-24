import "jsr:@std/dotenv/load";

import {
  AnthropicModelProvider,
  createZypherContext,
  ZypherAgent,
} from "jsr:@corespeed/zypher@0.5.1";

import { ReadFileTool, ListDirTool } from "@corespeed/zypher/tools";

function getRequiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

// Convert whatever Zypher returns into an async iterable of events.
// Handles both ModelStream (with .events()) and Observable-like values.
async function* toAsyncIterable(source: any): AsyncGenerator<any> {
  if (source == null) return;
  if (typeof source.events === "function") {
    source = source.events();
  }

  if (typeof source.then === "function") {
    const awaited = await source;
    yield* toAsyncIterable(awaited);
    return;
  }

  if (typeof source[Symbol.asyncIterator] === "function") {
    for await (const v of source) yield v;
    return;
  }

  if (typeof source[Symbol.iterator] === "function") {
    for (const v of source) yield v;
    return;
  }

  if (typeof source.subscribe === "function") {
    const queue: any[] = [];
    let done = false;
    let error: any = null;

    const subscription = source.subscribe({
      next: (v: any) => queue.push(v),
      error: (e: any) => {
        error = e;
      },
      complete: () => {
        done = true;
      },
    });

    try {
      while (!done || queue.length) {
        if (error) throw error;
        if (queue.length) {
          yield queue.shift();
        } else {
          await new Promise((r) => setTimeout(r, 10));
        }
      }
    } finally {
      if (subscription && typeof subscription.unsubscribe === "function") {
        subscription.unsubscribe();
      }
    }
    return;
  }

  yield source;
}

// Agent creation helper
async function createAgent() {
  const workspaceDir = Deno.cwd();
  const context = await createZypherContext(workspaceDir);

  const provider = new AnthropicModelProvider({
    apiKey: getRequiredEnv("ANTHROPIC_API_KEY"),
  });

  const agent = new ZypherAgent(context, provider);

  // Give the agent the ability to inspect your repo
  agent.mcp.registerTool(ReadFileTool);
  agent.mcp.registerTool(ListDirTool);

  // Optional: Firecrawl MCP for web context (only if you set FIRECRAWL_API_KEY)
  const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
  if (firecrawlKey) {
    await agent.mcp.registerServer({
      id: "firecrawl",
      type: "command",
      command: {
        command: "npx",
        args: ["-y", "firecrawl-mcp"],
        env: {
          FIRECRAWL_API_KEY: firecrawlKey,
        },
      },
    });
  }

  return agent;
}

// Main entry point
async function run() {
  const question = Deno.args.join(" ").trim();
  if (!question) {
    console.error(
      "Usage: deno run -A main.ts \"Your question about this repo\"",
    );
    Deno.exit(1);
  }

  const workspaceDir = Deno.cwd();
  const agent = await createAgent();

  const model =
    Deno.env.get("ANTHROPIC_MODEL") ?? "claude-sonnet-4-20250514";

  const taskPrompt = `
You are **Zypher Repo Navigator**, an AI agent helping a developer understand
and improve the code in the repository at:

\`${workspaceDir}\`

User question:
"${question}"

Instructions:
- Use your file tools (list + read) to inspect the most relevant files before answering.
- Explain things in clear, beginner-friendly **markdown**.
- Prefer short code snippets only when they are really needed for explanation.
- Do NOT dump entire files.
- Organize your response into sections like:
  - Overview
  - Relevant Files
  - How Things Work (step-by-step)
  - Suggestions / Next Steps (if appropriate)
`.trim();

  const stream = agent.runTask(taskPrompt, model);
  const events = toAsyncIterable(stream);
  const encoder = new TextEncoder();

  try {
    for await (const event of events) {
      if (event && event.type === "text" && typeof event.content === "string") {
        await Deno.stdout.write(encoder.encode(event.content));
      }
    }
    // Final newline for nice shell prompt
    await Deno.stdout.write(encoder.encode("\n"));
  } catch (err) {
    console.error("Fatal error while streaming task events:", err);
    Deno.exit(1);
  }
}

if (import.meta.main) {
  run();
}
