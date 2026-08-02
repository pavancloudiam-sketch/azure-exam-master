import * as React from "react";
import { useRouter } from "@tanstack/react-router";
import type { Session, User } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import { isCurrentUserAdmin } from "../services/auth-service";

export type AuthState = {
  session: Session | null;
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
};

const AuthContext = React.createContext<AuthState>({
  session: null,
  user: null,
  isAdmin: false,
  loading: true,
});

/**
 * Single app-wide auth subscriber. Do not add competing
 * `onAuthStateChange` listeners elsewhere.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [session, setSession] = React.useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = React.useState(false);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let active = true;

    const { data: subscription } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setLoading(false);
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        router.invalidate();
      }
    });

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [router]);

  const userId = session?.user.id ?? null;

  React.useEffect(() => {
    let active = true;
    if (!userId) {
      setIsAdmin(false);
      return;
    }
    void isCurrentUserAdmin(userId).then((result) => {
      if (active) setIsAdmin(result);
    });
    return () => {
      active = false;
    };
  }, [userId]);

  const value = React.useMemo<AuthState>(
    () => ({ session, user: session?.user ?? null, isAdmin, loading }),
    [session, isAdmin, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return React.useContext(AuthContext);
}