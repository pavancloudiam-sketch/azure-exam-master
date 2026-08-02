import { createFileRoute } from "@tanstack/react-router";

import {
  apiJson,
  authenticateApiRequest,
  isFailure,
} from "@/features/enterprise/services/api-auth.server";

/** Read-only organisation profile for the tenant that owns the API key. */
export const Route = createFileRoute("/api/public/v1/organization")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await authenticateApiRequest(
          request,
          "/api/public/v1/organization",
          "org:read",
        );
        if (isFailure(auth)) return auth.response;

        const { data } = await auth.admin
          .from("organizations")
          .select("id, name, slug, status, created_at")
          .eq("id", auth.organizationId)
          .maybeSingle();

        return apiJson({ data }, auth.requestId);
      },
    },
  },
});