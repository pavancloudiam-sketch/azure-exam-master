import type { Database } from "@/integrations/supabase/types";

export type OrgRole = Database["public"]["Enums"]["org_role"];
export type OrgMemberStatus = Database["public"]["Enums"]["org_member_status"];

export type Organization = Database["public"]["Tables"]["organizations"]["Row"];
export type OrganizationMember = Database["public"]["Tables"]["organization_members"]["Row"];
export type OrganizationRole = Database["public"]["Tables"]["organization_roles"]["Row"];
export type OrganizationSettings = Database["public"]["Tables"]["organization_settings"]["Row"];
export type OrganizationBranding = Database["public"]["Tables"]["organization_branding"]["Row"];
export type OrganizationEntitlement =
  Database["public"]["Tables"]["organization_entitlements"]["Row"];

/** A membership joined with the member's profile and organisation-level roles. */
export type MemberWithProfile = OrganizationMember & {
  email: string | null;
  full_name: string | null;
  roles: OrgRole[];
};

/** The signed-in user's own membership, used for tenant-aware navigation. */
export type MyMembership = {
  organization: Organization;
  status: OrgMemberStatus;
  roles: OrgRole[];
  isOrgAdmin: boolean;
};

export const ORG_ROLE_LABELS: Record<OrgRole, string> = {
  owner: "Owner",
  admin: "Organisation admin",
  manager: "Manager",
  member: "Member",
};