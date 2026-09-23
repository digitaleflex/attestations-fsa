"use client";

import * as React from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarSeparator,
  SidebarFooter,
  SidebarMenuButton,
  SidebarRail,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  useSidebar,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import {
  LayoutDashboard,
  Users,
  BookOpen,
  FileText,
  Settings,
  LogOut,
  Home,
  AlertCircle,
  ClipboardCheck,
  FileCheck,
  Bell,
  Mail,
  User,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

interface NavLink {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavSection {
  title: string;
  links: NavLink[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: "Principal",
    links: [
      { href: "/admin/dashboard", label: "Vue d'ensemble", icon: LayoutDashboard },
    ],
  },
  {
    title: "Formation",
    links: [
      { href: "/admin/users", label: "Apprenants", icon: Users },
      { href: "/admin/formations", label: "Catalogue Pédagogique", icon: BookOpen },
      { href: "/admin/exams", label: "Examens", icon: ClipboardCheck },
      { href: "/admin/corrections", label: "Corrections", icon: FileCheck },
    ],
  },
  {
    title: "Administration",
    links: [
      { href: "/admin/attestations", label: "Attestations", icon: FileText },
      { href: "/admin/reclamations", label: "Réclamations", icon: AlertCircle },
      { href: "/admin/contacts", label: "Messages", icon: Mail },
      { href: "/admin/notifications", label: "Notifications", icon: Bell },
    ],
  },
];

const SYSTEM_LINKS: NavLink[] = [
  { href: "/admin/settings", label: "Paramètres", icon: Settings },
  { href: "/admin/profile", label: "Mon profil", icon: User },
  { href: "/", label: "Site public", icon: Home },
];

function isLinkActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === "/admin/dashboard") return pathname === href;
  if (href === "/") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavItem({ item, pathname }: { item: NavLink; pathname: string | null }) {
  const Icon = item.icon;
  const isActive = isLinkActive(pathname, item.href);
  return (
    <SidebarMenuItem key={item.href}>
      <SidebarMenuButton
        asChild
        isActive={isActive}
        tooltip={item.label}
        className={`transition-all duration-200 ${
          isActive
            ? "bg-brand text-white shadow-md shadow-brand/30 hover:bg-brand-dark hover:text-white"
            : "text-slate-600 hover:bg-slate-100"
        }`}
      >
        <Link href={item.href} aria-current={isActive ? "page" : undefined}>
          <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-white" : "text-slate-400"}`} />
          <span className="font-medium text-sm">{item.label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function AdminSidebar({ admin }: { admin: any }) {
  const pathname = usePathname();
  const router = useRouter();
  const { state } = useSidebar();

  const handleLogout = async () => {
    try {
        await authClient.signOut();
        await fetch("/api/auth/logout", { method: "POST" });
        router.push("/admin/login");
        router.refresh();
    } catch (error) {
        window.location.href = "/admin/login";
    }
  };

  return (
    <Sidebar collapsible="icon" className="border-r shadow-sm">
      <SidebarHeader className="h-16 flex flex-row items-center border-b border-slate-100 px-4 py-0 shrink-0">
        <SidebarHeaderContent state={state} />
      </SidebarHeader>

      <SidebarContent className="flex-1 px-2 py-6 overflow-x-hidden">
        {NAV_SECTIONS.map((section) => (
          <SidebarGroup key={section.title} className="p-0 pb-4">
            <SidebarGroupLabel className="px-3 pb-1.5 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
              {section.title}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="space-y-1">
                {section.links.map((item) => (
                  <NavItem key={item.href} item={item} pathname={pathname} />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarSeparator className="mx-4 bg-slate-100" />

      <SidebarFooter className="p-4 space-y-4">
        <SidebarMenu className="space-y-1">
          <SidebarGroupLabel className="px-3 pb-1.5 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
            Système
          </SidebarGroupLabel>
          {SYSTEM_LINKS.map((item) => (
            <NavItem key={item.href} item={item} pathname={pathname} />
          ))}
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={handleLogout}
              tooltip="Déconnexion"
              className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 transition-colors"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span className="font-medium text-sm">Déconnexion</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        {admin && state === "expanded" && (
          <div className="mt-2 rounded-xl bg-slate-50 p-3 animate-in fade-in slide-in-from-bottom-2 duration-500 border border-slate-100">
            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1">
              Session active
            </p>
            <p className="font-medium text-slate-700 truncate text-xs">
              {admin.name || admin.email}
            </p>
          </div>
        )}
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

function SidebarHeaderContent({ state }: { state: string }) {
  const isExpanded = state === "expanded";
  return (
    <div className="flex items-center gap-3 overflow-hidden w-full">
      <div className="shrink-0 w-8 h-8 bg-gradient-to-br from-red-500 to-rose-600 rounded-lg flex items-center justify-center shadow-sm">
        <span className="text-white font-bold text-xs">FSA</span>
      </div>
      {isExpanded && (
        <div className="flex flex-col min-w-0 animate-in fade-in duration-200">
          <span className="text-sm font-bold text-slate-800 truncate leading-none mb-1">
            Admin FSA
          </span>
          <span className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold truncate leading-none">
            Gestion Centrale
          </span>
        </div>
      )}
    </div>
  );
}
