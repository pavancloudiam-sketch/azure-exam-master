import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

import { failure, json, notAuthenticated, requireUser } from "../result";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_my_attempts",
  title: "List my exam attempts",
  description:
    "List the signed-in student's own exam attempts, newest first, with mode, status, score and pass/fail outcome.",
  inputSchema: {
    status: z
      .enum(["in_progress", "submitted", "cancelled", "expired"])
      .describe("Optional attempt status filter.")
      .optional(),
    limit: z.number().int().describe("How many attempts to return (1-50, default 20).").optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, limit }, ctx) => {
    const userId = requireUser(ctx);
    if (!userId) return notAuthenticated();
    const take = Math.min(Math.max(limit ?? 20, 1), 50);
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("attempts")
      .select(
        "id, exam_id, status, mode, started_at, submitted_at, scaled_score, percentage, passed, duration_seconds, exams(title)",
      )
      // RLS already scopes attempts to the caller; the filter keeps the intent explicit.
      .eq("user_id", userId)
      .order("started_at", { ascending: false })
      .limit(take);
    if (status) query = query.eq("status", status);
    const { data, error } = await query;
    if (error) return failure(error.message);
    return json(data ?? [], { attempts: data ?? [] });
  },
});
