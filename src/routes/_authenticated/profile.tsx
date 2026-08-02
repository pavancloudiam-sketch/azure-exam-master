import { createFileRoute, Link } from "@tanstack/react-router";

import { PageShell } from "@/features/shared/components/PageShell";
import { StatusBadge, SurfaceCard } from "@/features/shared/components/ui";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { useOrgAccess } from "@/features/organizations/hooks/use-org-access";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Profile — AskMeExam" },
      { name: "description", content: "Your AskMeExam account details and access." },
      { property: "og:title", content: "Profile — AskMeExam" },
      { property: "og:description", content: "Your account details and access." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ProfilePage,
});

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-border py-3 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

function ProfilePage() {
  const { user, isAdmin } = useAuth();
  const { memberships } = useOrgAccess();

  return (
    <PageShell title="Profile" description="Your account details, role and organisation access.">
      <div className="grid gap-6 lg:grid-cols-2">
        <SurfaceCard title="Account">
          <Row label="Email address" value={user?.email ?? "—"} />
          <Row
            label="Role"
            value={
              <StatusBadge tone={isAdmin ? "info" : "neutral"}>
                {isAdmin ? "Administrator" : "Student"}
              </StatusBadge>
            }
          />
          <Row
            label="Member since"
            value={
              user?.created_at
                ? new Date(user.created_at).toLocaleDateString(undefined, { dateStyle: "medium" })
                : "—"
            }
          />
        </SurfaceCard>

        <SurfaceCard title="Organisations" description="Workspaces you belong to.">
          {memberships.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              You are not a member of an organisation. Personal purchases and attempts stay private
              to your account.
            </p>
          ) : (
            <ul className="space-y-2">
              {memberships.map((membership) => (
                <li key={membership.organizationId} className="flex items-center justify-between gap-3">
                  <span className="truncate text-sm font-medium">{membership.organizationName}</span>
                  <StatusBadge tone={membership.isOrgAdmin ? "info" : "neutral"}>
                    {membership.isOrgAdmin ? "Organisation admin" : "Member"}
                  </StatusBadge>
                </li>
              ))}
            </ul>
          )}
        </SurfaceCard>

        <SurfaceCard title="Security" description="Password and sign-in.">
          <p className="text-sm text-muted-foreground">
            To change your password, sign out and use the password reset link on the sign-in screen.
          </p>
          <Link
            to="/forgot-password"
            className="mt-4 inline-flex min-h-11 items-center rounded-md border border-border px-4 text-sm font-medium text-primary transition-colors hover:bg-surface"
          >
            Reset password
          </Link>
        </SurfaceCard>

        <SurfaceCard title="Data and privacy" description="Export or delete your data.">
          <p className="text-sm text-muted-foreground">
            Manage your data rights, including export and account deletion requests.
          </p>
          <Link
            to="/privacy"
            className="mt-4 inline-flex min-h-11 items-center rounded-md border border-border px-4 text-sm font-medium text-primary transition-colors hover:bg-surface"
          >
            Open privacy centre
          </Link>
        </SurfaceCard>
      </div>
    </PageShell>
  );
}
