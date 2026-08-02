import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  Building2,
  Palette,
  LayoutDashboard,
  Home,
  ShieldCheck,
  FileQuestion,
  MessageSquare,
  GraduationCap,
  Receipt,
  Lock,
} from "lucide-react";

export type NavItem = { to: string; label: string; icon: LucideIcon };

export const mainNav: NavItem[] = [
  { to: "/", label: "Home", icon: Home },
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/exams", label: "Exams", icon: FileQuestion },
  { to: "/study", label: "Study Assistant", icon: GraduationCap },
  { to: "/interview", label: "Interview Coach", icon: MessageSquare },
  { to: "/certifications", label: "Certifications", icon: BookOpen },
];

export const accountNav: NavItem[] = [
  { to: "/billing", label: "Purchases", icon: Receipt },
  { to: "/organization", label: "Organisation", icon: Building2 },
  { to: "/organization/branding", label: "Branding", icon: Palette },
  { to: "/privacy", label: "Privacy", icon: Lock },
];

export const adminNav: NavItem[] = [{ to: "/admin", label: "Admin", icon: ShieldCheck }];