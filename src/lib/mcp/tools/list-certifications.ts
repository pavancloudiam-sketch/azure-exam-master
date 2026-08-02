import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

import { failure, json, notAuthenticated, requireUser } from "../result";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_certifications",
  title: "List certifications",
  description:
    "List the Microsoft Entra ID certifications available to practise on AskMeExam, with their exam code, version and lifecycle status.",
  inputSchema: {
    search: z.string().trim().describe("Optional text to match against the certification name or exam code.").optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ search }, ctx) => {
    if (!requireUser(ctx)) return notAuthenticated();
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("certifications")
      .select("id, code, name, exam_code, version, lifecycle_status, allow_new_attempts, description")
      .eq("is_active", true)
      .order("name");
    if (search) query = query.or(`name.ilike.%${search}%,exam_code.ilike.%${search}%,code.ilike.%${search}%`);
    const { data, error } = await query.limit(50);
    if (error) return failure(error.message);
    return json(data ?? [], { certifications: data ?? [] });
  },
});
