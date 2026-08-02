import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";
import { isCurrentUserAdmin } from "@/features/auth/services/auth-service";
import { logEvent } from "@/features/observability";

/** Role gate. The parent `_authenticated` layout already guarantees a session. */
export const Route = createFileRoute("/_authenticated/_admin")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    const userId = data.user?.id;
    if (!userId || !(await isCurrentUserAdmin(userId))) {
      // Authorization failures are logged without identifying the account:
      // the correlation id is enough to trace repeated probing.
      logEvent({
        code: "authz.denied",
        severity: "warn",
        message: "Admin area access denied",
        context: { has_session: Boolean(userId) },
      });
      throw redirect({ to: "/dashboard" });
    }
    return { isAdmin: true };
  },
  component: () => <Outlet />,
});