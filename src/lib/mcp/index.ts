import { auth, defineMcp } from "@lovable.dev/mcp-js";
import type { McpDefinitionInput } from "@lovable.dev/mcp-js";

import getAttemptResultTool from "./tools/get-attempt-result";
import listCertificationsTool from "./tools/list-certifications";
import listExamsTool from "./tools/list-exams";
import listMyAttemptsTool from "./tools/list-my-attempts";

// The OAuth issuer must be the direct Supabase host: the published build
// rewrites SUPABASE_URL to a proxy host that fails RFC 8414 issuer matching.
// Vite inlines this literal at build time.
const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "entra-path",
  title: "Entra Path",
  version: "0.1.0",
  instructions:
    "Read-only tools for the signed-in AskMeExam student: browse Microsoft Entra ID certifications and published practice exams, review their own attempt history, and read the scored result of a submitted attempt. Exam answer keys and other students' data are never exposed.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  // The SDK's tool type declares outputSchema as required-but-possibly-undefined,
  // which this project's exactOptionalPropertyTypes rejects for tools that omit it.
  tools: [
    listCertificationsTool,
    listExamsTool,
    listMyAttemptsTool,
    getAttemptResultTool,
  ] as unknown as McpDefinitionInput["tools"],
});
