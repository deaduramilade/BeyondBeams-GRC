import {
  Activity, BarChart3, BookOpen, BookOpenCheck, Building2, ClipboardCheck,
  FileCheck2, FileClock, FileText, Gauge, Home, Landmark, ListChecks,
  MessageSquare, Radar, Scale, Settings, ShieldCheck, Siren, SlidersHorizontal,
  Sparkles, Users, UserRoundCog,
} from "lucide-react";

export const appTiles = [
  { href: "/app", label: "Home", icon: Home, color: "text-teal-300" },
  { href: "/app/insights", label: "Risk Insights", icon: BarChart3, color: "text-sky-300" },
  { href: "/app/risks", label: "Risk Register", icon: BookOpenCheck, color: "text-emerald-300" },
  { href: "/app/collaboration", label: "Collaboration", icon: MessageSquare, color: "text-cyan-300" },
  { href: "/app/library", label: "Risk Library", icon: BookOpen, color: "text-amber-300" },
  { href: "/app/roles", label: "User Roles", icon: UserRoundCog, color: "text-violet-300" },
  { href: "/app/frameworks", label: "Frameworks & Compliance", icon: ShieldCheck, color: "text-lime-300" },
  { href: "/app/audit", label: "Audit Trail", icon: FileClock, color: "text-orange-300" },
  { href: "/app/settings", label: "Settings", icon: Settings, color: "text-slate-300" },
] as const;

export const grcNav = [
  { href: "/app/risks", label: "Risk identification", icon: BookOpenCheck },
  { href: "/app/assessments", label: "Assessment & scoring", icon: Gauge },
  { href: "/app/governance", label: "Governance workbench", icon: ClipboardCheck },
  { href: "/app/treatments", label: "Treatment plans", icon: ListChecks },
  { href: "/app/controls", label: "Control management", icon: SlidersHorizontal },
  { href: "/app/frameworks", label: "Frameworks & compliance", icon: Scale },
  { href: "/app/emerging-risks", label: "Emerging risks", icon: Radar },
  { href: "/app/vendors", label: "Third-party risk", icon: Building2 },
  { href: "/app/incidents", label: "Incidents & issues", icon: Siren },
  { href: "/app/audit", label: "Audit & assurance", icon: ClipboardCheck },
  { href: "/app/policies", label: "Policies & procedures", icon: FileText },
] as const;

export const utilityNav = [
  { href: "/app/translator", label: "Board translator", icon: Sparkles },
  { href: "/app/library", label: "Industry library", icon: BookOpen },
] as const;

export const quickCreates = [
  { href: "/app/risks/new", label: "New Risk", icon: Activity },
  { href: "/app/assessments?create=1", label: "New Assessment", icon: Gauge },
  { href: "/app/risks/new?mapping=1", label: "New Framework Mapping", icon: FileCheck2 },
  { href: "/app/roles?invite=1", label: "Invite Member", icon: Users },
] as const;

export const allWorkspaceLinks = [...appTiles, ...grcNav, ...utilityNav];