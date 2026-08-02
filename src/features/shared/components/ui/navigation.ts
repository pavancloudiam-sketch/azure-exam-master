import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  Building2,
  ClipboardList,
  Palette,
  LayoutDashboard,
  Home,
  ShieldCheck,
  FileQuestion,
  FileText,
  FolderOpen,
  HelpCircle,
  History,
  Layers,
  ListTree,
  MessageSquare,
  GraduationCap,
  Receipt,
  Settings,
  Sparkles,
  Tag,
  Upload,
  Lock,
  User,
  Users,
} from "lucide-react";

export type NavItem = { to: string; label: string; icon: LucideIcon; exact?: boolean };

/** Marketing navigation for signed-out visitors. Never contains app internals. */
export const publicNav: NavItem[] = [
  { to: "/", label: "Home", icon: Home, exact: true },
  { to: "/certifications", label: "Certifications", icon: BookOpen },
  { to: "/pricing", label: "Pricing", icon: Tag },
  { to: "/about", label: "How it works", icon: HelpCircle },
];

/** Primary student workspace navigation. */
export const studentNav: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/exams", label: "Practice exams", icon: FileQuestion },
  { to: "/attempts", label: "My attempts", icon: History },
  { to: "/study", label: "Study Assistant", icon: GraduationCap },
  { to: "/interview", label: "Interview Coach", icon: MessageSquare },
  { to: "/certifications", label: "Certifications", icon: BookOpen },
  { to: "/resources", label: "Resources", icon: FolderOpen },
  { to: "/billing", label: "Purchases", icon: Receipt },
  { to: "/profile", label: "Profile", icon: User },
  { to: "/help", label: "Help and support", icon: HelpCircle },
];

/** Secondary student items pinned to the bottom of the sidebar. */
export const studentUtilityNav: NavItem[] = [{ to: "/privacy", label: "Privacy", icon: Lock }];

/** Organisation items, shown only to authorised organisation administrators. */
export const organizationNav: NavItem[] = [
  { to: "/organization", label: "Organisation", icon: Building2 },
  { to: "/organization/branding", label: "Branding", icon: Palette },
];

/** Platform administration navigation. Never rendered for students. */
export const adminNav: NavItem[] = [
  { to: "/admin", label: "Admin dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/certifications", label: "Certifications", icon: BookOpen },
  { to: "/admin/domains", label: "Domains", icon: Layers },
  { to: "/admin/topics", label: "Topics", icon: ListTree },
  { to: "/admin/exams", label: "Exams", icon: ClipboardList },
  { to: "/admin/blueprints", label: "Blueprints", icon: Ruler },
  { to: "/admin/readiness", label: "Question-bank readiness", icon: Gauge },

  { to: "/admin/questions", label: "Questions", icon: FileQuestion },
  { to: "/admin/import", label: "Bulk import", icon: Upload },
  { to: "/admin/documents", label: "Documents", icon: FileText },
  { to: "/admin/ai/generator", label: "AI question generator", icon: Sparkles },
  { to: "/admin/ai", label: "AI modules", icon: Sparkles },
  { to: "/admin/students", label: "Students", icon: Users },
  { to: "/admin/organizations", label: "Organisations", icon: Building2 },
  { to: "/admin/billing", label: "Billing", icon: Receipt },
  { to: "/admin/privacy", label: "Data rights", icon: Lock },
  { to: "/admin/settings", label: "Application settings", icon: Settings },
  { to: "/admin/audit", label: "Audit logs", icon: ShieldCheck },
];

/** Admin items pinned to the bottom of the admin sidebar. */
export const adminUtilityNav: NavItem[] = [
  { to: "/dashboard", label: "View student portal", icon: GraduationCap },
  { to: "/profile", label: "Admin profile", icon: User },
];

/** Back-compatible alias used by the design-system preview and legacy nav components. */
export const mainNav: NavItem[] = studentNav;
