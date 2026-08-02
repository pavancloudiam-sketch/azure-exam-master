import { supabase } from "@/integrations/supabase/client";
import { logError } from "@/features/observability";

/** Only same-origin absolute paths are accepted as post-auth destinations. */
export function safeRedirect(target: string | undefined, fallback = "/dashboard"): string {
  if (!target) return fallback;
  if (!target.startsWith("/") || target.startsWith("//")) return fallback;
  return target;
}

export async function signInWithPassword(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function registerWithPassword(input: {
  email: string;
  password: string;
  fullName: string;
}) {
  return supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      emailRedirectTo: `${window.location.origin}/auth`,
      data: { full_name: input.fullName },
    },
  });
}

export async function sendPasswordReset(email: string) {
  const result = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  if (result.error) {
    logError("auth.password_reset_failed", "Password reset request failed", result.error, {
      stage: "request",
    });
  }
  return result;
}

export async function updatePassword(password: string) {
  const result = await supabase.auth.updateUser({ password });
  if (result.error) {
    logError("auth.password_reset_failed", "Password update failed", result.error, {
      stage: "update",
    });
  }
  return result;
}

export async function isCurrentUserAdmin(userId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (error) {
    logError("db.query_failed", "Role lookup failed", error, { rpc: "has_role" });
    return false;
  }
  return data === true;
}