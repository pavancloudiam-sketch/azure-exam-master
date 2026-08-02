import { createFileRoute } from "@tanstack/react-router";

import {
  apiJson,
  authenticateApiRequest,
  isFailure,
} from "@/features/enterprise/services/api-auth.server";

/**
 * Members of the key's own organisation. The tenant filter is derived from the
 * key, never from a query parameter, so a caller cannot read another tenant.
 */
export const Route = createFileRoute("/api/public/v1/members")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await authenticateApiRequest(
          request,
          "/api/public/v1/members",
          "members:read",
        );
        if (isFailure(auth)) return auth.response;

        const url = new URL(request.url);
        const limit = Math.min(Number(url.searchParams.get("limit") ?? 50) || 50, 200);
        const offset = Math.max(Number(url.searchParams.get("offset") ?? 0) || 0, 0);

        const { data, count } = await auth.admin
          .from("organization_members")
          .select("user_id, status, invited_at, joined_at", { count: "exact" })
          .eq("organization_id", auth.organizationId)
          .neq("status", "removed")
          .order("invited_at", { ascending: false })
          .range(offset, offset + limit - 1);

        return apiJson({ data: data ?? [], total: count ?? 0, limit, offset }, auth.requestId);
      },
    },
  },
});