import { supabase } from "@/integrations/supabase/client";
import type {
  MemberWithProfile,
  MyMembership,
  Organization,
  OrganizationEntitlement,
  OrganizationSettings,
  OrgRole,
} from "../types";
import type {
  InviteMemberInput,
  OrganizationInput,
  OrganizationSettingsInput,
} from "../validation";

/**
 * Every read below is additionally constrained by row level security, so a
 * caller who tampers with the organisation id in the browser still cannot see
 * another tenant's rows. Frontend filtering is convenience only.
 */

export async function listOrganizations(): Promise<Organization[]> {
  const { data, error } = await supabase
    .from("organizations")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw error;
  return data;
}

export async function listMyMemberships(): Promise<MyMembership[]> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return [];

  const { data: memberships, error } = await supabase
    .from("organization_members")
    .select("organization_id, status, organizations(*)")
    .eq("user_id", userId)
    .neq("status", "removed");
  if (error) throw error;

  const { data: roles, error: rolesError } = await supabase
    .from("organization_roles")
    .select("organization_id, role")
    .eq("user_id", userId);
  if (rolesError) throw rolesError;

  return (memberships ?? [])
    .filter((row) => row.organizations)
    .map((row) => {
      const mine = (roles ?? [])
        .filter((r) => r.organization_id === row.organization_id)
        .map((r) => r.role as OrgRole);
      return {
        organization: row.organizations as Organization,
        status: row.status,
        roles: mine,
        isOrgAdmin: row.status === "active" && (mine.includes("owner") || mine.includes("admin")),
      };
    });
}

export async function listOrganizationMembers(
  organizationId: string,
): Promise<MemberWithProfile[]> {
  const { data, error } = await supabase
    .from("organization_members")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true });
  if (error) throw error;

  const { data: roles, error: rolesError } = await supabase
    .from("organization_roles")
    .select("user_id, role")
    .eq("organization_id", organizationId);
  if (rolesError) throw rolesError;

  const userIds = (data ?? []).map((row) => row.user_id);
  const profiles = userIds.length
    ? ((
        await supabase.from("profiles").select("id, email, full_name").in("id", userIds)
      ).data ?? [])
    : [];

  return (data ?? []).map((member) => {
    const profile = profiles.find((p) => p.id === member.user_id);
    return {
      ...member,
      email: profile?.email ?? null,
      full_name: profile?.full_name ?? null,
      roles: (roles ?? [])
        .filter((r) => r.user_id === member.user_id)
        .map((r) => r.role as OrgRole),
    };
  });
}

export async function getOrganizationSettings(
  organizationId: string,
): Promise<OrganizationSettings | null> {
  const { data, error } = await supabase
    .from("organization_settings")
    .select("*")
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listOrganizationEntitlements(
  organizationId: string,
): Promise<OrganizationEntitlement[]> {
  const { data, error } = await supabase
    .from("organization_entitlements")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function listOrganizationAuditLogs(organizationId: string, limit = 25) {
  const { data, error } = await supabase
    .from("audit_logs")
    .select("id, action, entity_type, entity_label, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

/* --------------------------- writes (server RPCs) -------------------------- */

export async function createOrganization(input: OrganizationInput): Promise<Organization> {
  const { data, error } = await supabase.rpc("create_organization", {
    _name: input.name,
    _slug: input.slug.toLowerCase(),
    ...(input.contact_email ? { _contact_email: input.contact_email } : {}),
  });
  if (error) throw error;
  return data as unknown as Organization;
}

export async function inviteMember(organizationId: string, input: InviteMemberInput) {
  const { data, error } = await supabase.rpc("invite_organization_member", {
    _org_id: organizationId,
    _email: input.email,
    _role: input.role,
  });
  if (error) throw error;
  return data;
}

export async function removeMember(organizationId: string, userId: string) {
  const { data, error } = await supabase.rpc("remove_organization_member", {
    _org_id: organizationId,
    _user_id: userId,
  });
  if (error) throw error;
  return data;
}

export async function acceptInvitation(organizationId: string) {
  const { data, error } = await supabase.rpc("accept_organization_invitation", {
    _org_id: organizationId,
  });
  if (error) throw error;
  return data;
}

export async function updateOrganizationSettings(
  organizationId: string,
  input: OrganizationSettingsInput,
) {
  const domains = (input.allowed_email_domains ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  const { error } = await supabase
    .from("organization_settings")
    .update({
      timezone: input.timezone,
      allow_domain_join: input.allow_domain_join === "yes",
      allowed_email_domains: domains,
      seat_limit: input.seat_limit ? Number(input.seat_limit) : null,
    })
    .eq("organization_id", organizationId);
  if (error) throw error;
}

export async function setOrganizationStatus(
  organizationId: string,
  status: "active" | "suspended",
) {
  const { error } = await supabase
    .from("organizations")
    .update({ status })
    .eq("id", organizationId);
  if (error) throw error;
}