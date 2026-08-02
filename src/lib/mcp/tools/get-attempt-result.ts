import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

import { failure, json, notAuthenticated, requireUser } from "../result";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_attempt_result",
  title: "Get attempt result",
  description:
    "Get the scored result of one of the signed-in student's submitted attempts, including the scaled score, pass mark and per-domain breakdown. Live answer keys are never returned.",
  inputSchema: {
    attempt_id: z.string().uuid().describe("Attempt id from list_my_attempts."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ attempt_id }, ctx) => {
    if (!requireUser(ctx)) return notAuthenticated();
    const supabase = supabaseForUser(ctx);
    // The security-definer RPC enforces ownership and only returns results for
    // attempts that have actually been submitted.
    const { data, error } = await supabase.rpc("get_attempt_result", { _attempt_id: attempt_id });
    if (error) return failure(error.message);
    const result = Array.isArray(data) ? data[0] : data;
    if (!result) return failure("No result available for that attempt. It may still be in progress.");
    return json(result, { result: result as Record<string, unknown> });
  },
});
