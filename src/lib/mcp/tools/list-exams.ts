import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

import { failure, json, notAuthenticated, requireUser } from "../result";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_exams",
  title: "List practice exams",
  description:
    "List published AskMeExam practice exams, optionally filtered to one certification, including question count, time limit and passing score.",
  inputSchema: {
    certification_id: z.string().uuid().describe("Optional certification id from list_certifications.").optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ certification_id }, ctx) => {
    if (!requireUser(ctx)) return notAuthenticated();
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("exams")
      .select(
        "id, title, description, question_count, time_limit_minutes, passing_score, allow_timed, allow_practice, certification_id, certifications(name, exam_code)",
      )
      .eq("is_published", true)
      .eq("is_active", true)
      .order("title");
    if (certification_id) query = query.eq("certification_id", certification_id);
    const { data, error } = await query.limit(50);
    if (error) return failure(error.message);
    return json(data ?? [], { exams: data ?? [] });
  },
});
