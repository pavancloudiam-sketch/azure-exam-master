import type { ToolContext } from "@lovable.dev/mcp-js";

export function notAuthenticated() {
  return {
    content: [{ type: "text" as const, text: "Not authenticated. Reconnect this integration and sign in to AskMeExam." }],
    isError: true,
  };
}

export function failure(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true };
}

export function json(payload: unknown, structured: Record<string, unknown>) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
    structuredContent: structured,
  };
}

export function requireUser(ctx: ToolContext) {
  return ctx.isAuthenticated() ? ctx.getUserId() : null;
}
