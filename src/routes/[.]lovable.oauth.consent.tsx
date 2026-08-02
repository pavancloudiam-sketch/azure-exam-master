import * as React from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";
import {
  PrimaryButton,
  SecondaryButton,
  StatusAlert,
  SurfaceCard,
} from "@/features/shared/components/ui";

type AuthorizationClient = { name?: string | null; client_id?: string | null };
type AuthorizationDetails = {
  client?: AuthorizationClient | null;
  scope?: string | null;
  redirect_url?: string | null;
  redirect_to?: string | null;
};
type OAuthResult = { data: AuthorizationDetails | null; error: { message: string } | null };
// `supabase.auth.oauth` is beta and not in the generated types yet.
type OAuthNamespace = {
  getAuthorizationDetails: (id: string) => Promise<OAuthResult>;
  approveAuthorization: (id: string) => Promise<OAuthResult>;
  denyAuthorization: (id: string) => Promise<OAuthResult>;
};
function oauth(): OAuthNamespace {
  return (supabase.auth as unknown as { oauth: OAuthNamespace }).oauth;
}

export const Route = createFileRoute("/.lovable/oauth/consent")({
  // Browser-only: the session lives in localStorage, which SSR cannot read.
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    authorization_id: typeof search["authorization_id"] === "string" ? search["authorization_id"] : "",
  }),
  head: () => ({
    meta: [
      { title: "Authorise an app — AskMeExam" },
      {
        name: "description",
        content: "Review and approve an AI assistant's request to use AskMeExam as you.",
      },
      { property: "og:title", content: "Authorise an app — AskMeExam" },
      { property: "og:description", content: "Approve or deny access to your AskMeExam account." },
      { name: "robots", content: "noindex" },
    ],
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Missing authorization_id");
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      const next = location.pathname + location.searchStr;
      throw redirect({ to: "/auth", search: { redirect: next } });
    }
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await oauth().getAuthorizationDetails(authorizationId);
    if (error) throw new Error(error.message);
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data;
  },
  component: ConsentPage,
  errorComponent: ({ error }) => (
    <main className="mx-auto w-full max-w-md flex-1 px-6 py-12">
      <h1 className="text-2xl font-semibold">Authorisation request</h1>
      <StatusAlert tone="error" title="Could not load this request" className="mt-6">
        {String((error as Error)?.message ?? error)}
      </StatusAlert>
    </main>
  ),
  notFoundComponent: () => (
    <main className="mx-auto w-full max-w-md flex-1 px-6 py-12">
      <h1 className="text-2xl font-semibold">Authorisation request not found</h1>
    </main>
  ),
});

function ConsentPage() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = React.useState<"approve" | "deny" | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const clientName = details?.client?.name ?? "this application";

  async function decide(approve: boolean) {
    setBusy(approve ? "approve" : "deny");
    setError(null);
    const { data, error: decisionError } = approve
      ? await oauth().approveAuthorization(authorization_id)
      : await oauth().denyAuthorization(authorization_id);
    if (decisionError) {
      setBusy(null);
      return setError(decisionError.message);
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(null);
      return setError("No redirect was returned by the authorisation server.");
    }
    window.location.href = target;
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-12">
      <h1 className="text-2xl font-semibold">Connect {clientName} to AskMeExam</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {clientName} is asking to use AskMeExam as you. It will be able to read the same
        certifications, practice exams, attempts and results that you can see when you sign in —
        nothing belonging to other students.
      </p>

      <SurfaceCard className="mt-6 space-y-4">
        {error ? (
          <StatusAlert tone="error" title="Could not complete">
            {error}
          </StatusAlert>
        ) : null}
        <PrimaryButton
          className="w-full"
          loading={busy === "approve"}
          disabled={busy !== null}
          onClick={() => void decide(true)}
        >
          Approve access
        </PrimaryButton>
        <SecondaryButton
          className="w-full"
          loading={busy === "deny"}
          disabled={busy !== null}
          onClick={() => void decide(false)}
        >
          Deny
        </SecondaryButton>
        <p className="text-xs text-muted-foreground">
          You can revoke this access at any time by removing the connection in the app you are
          connecting from.
        </p>
      </SurfaceCard>
    </main>
  );
}
