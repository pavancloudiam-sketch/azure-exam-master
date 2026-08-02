import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/features/auth/hooks/use-auth";
import { listMyMemberships } from "../services/organization-service";

/**
 * Lightweight read used for navigation gating only. Authorisation itself is
 * still enforced by RLS and the server-side role checks.
 */
export function useOrgAccess() {
  const { session } = useAuth();
  const { data } = useQuery({
    queryKey: ["my-memberships"],
    queryFn: listMyMemberships,
    enabled: Boolean(session),
    staleTime: 5 * 60_000,
  });
  const memberships = data ?? [];
  return {
    memberships,
    hasOrganization: memberships.length > 0,
    isOrgAdmin: memberships.some((m) => m.isOrgAdmin),
  };
}
