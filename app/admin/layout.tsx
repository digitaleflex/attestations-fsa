import * as React from "react";
<<<<<<< HEAD
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import NotificationCenter from "@/components/admin/NotificationCenter";
import PusherAdminListener from "@/components/admin/PusherAdminListener";

/**
 * Layout Admin optimisé (Server Component)
 * La sécurité (redirection) est gérée par le middleware.ts pour éviter les boucles.
 */
export default async function AdminLayout({
=======

import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarInset,
  SidebarFooter,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
  SidebarMenuButton,
  SidebarRail,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  LayoutDashboard,
  FileText,
  GraduationCap,
  Users,
  Settings,
  AlertCircle,
  BarChart3,
  LogOut,
  Home,
  ClipboardCheck,
  Briefcase,
  Inbox,
  Shield,
  Key,
  Mail,
  ChevronDown,
  ChevronRight,
  User,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { usePathname, useRouter } from "next/navigation";
import NotificationCenter from "@/components/admin/NotificationCenter";
import PusherAdminListener from "@/components/admin/PusherAdminListener";

const menuGroups = [
  {
    label: "Principal",
    items: [
      { href: "/admin/dashboard", label: "Tableau de bord", icon: LayoutDashboard },
      { href: "/admin/stats", label: "Statistiques", icon: BarChart3 },
    ]
  },
  {
    label: "Pédagogique",
    items: [
      { href: "/admin/exams", label: "Examens", icon: GraduationCap },
      { href: "/admin/submissions", label: "Gestion des Copies", icon: ClipboardCheck },
      { href: "/admin/corrections", label: "Corrections Profil", icon: User },
      { href: "/admin/attestations", label: "Attestations", icon: FileText },
      { href: "/admin/formations", label: "Formations", icon: GraduationCap },
    ]
  },
  {
    label: "Candidats",
    items: [
      { href: "/admin/users", label: "Utilisateurs", icon: Users },
      { href: "/admin/internships", label: "Gestion des Stages", icon: Briefcase },
    ]
  },
  {
    label: "Communication",
    items: [
      { href: "/admin/notifications", label: "Notifications Poussées", icon: Mail },
      { href: "/admin/contacts", label: "Messages & RDV", icon: Mail },
      { href: "/admin/signalements", label: "Signalements", icon: AlertCircle, badgeKey: "newReports" },
    ]
  },
  {
    label: "Sécurité & Système",
    items: [
      { href: "/admin/monitoring", label: "Surveillance", icon: Shield },
      { href: "/admin/logs", label: "Journaux d'Audit", icon: Shield },
      { href: "/admin/otp-logs", label: "Codes OTP", icon: Key },
      { href: "/admin/settings", label: "Paramètres Généraux", icon: Settings },
    ]
  }
];

function SidebarMenuContent() {
  const pathname = usePathname();
  const { state } = useSidebar();
  
  // État des groupes ouverts (par défaut le premier est ouvert)
  const [openGroups, setOpenGroups] = React.useState<Record<string, boolean>>({
    "Principal": true,
    "Pédagogique": true
  });

  const toggleGroup = (label: string) => {
    setOpenGroups(prev => ({ ...prev, [label]: !prev[label] }));
  };

  const { data: counts } = useQuery({
    queryKey: ["sidebar-counts"],
    queryFn: async () => {
      // Simulation pour l'exemple
      return { newReports: 0 };
    },
    staleTime: 60000
  });

  return (
    <div className="space-y-4">
      {menuGroups.map((group) => {
        const isOpen = openGroups[group.label];
        const hasActiveChild = group.items.some(item => 
          pathname === item.href || (pathname && item.href !== "/admin/dashboard" && pathname.startsWith(item.href))
        );

        return (
          <div key={group.label} className="space-y-1">
            {state === "expanded" && (
              <button 
                onClick={() => toggleGroup(group.label)}
                className="w-full flex items-center justify-between px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors group"
              >
                <span>{group.label}</span>
                {isOpen ? <ChevronDown className="w-3 h-3 transition-transform" /> : <ChevronRight className="w-3 h-3 transition-transform" />}
              </button>
            )}
            
            {(isOpen || (state === "collapsed" && hasActiveChild)) && (
              <div className="space-y-0.5 animate-in fade-in slide-in-from-top-1 duration-200">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = !!(
                    pathname === item.href ||
                    (pathname && item.href !== "/admin/dashboard" && pathname.startsWith(item.href))
                  );
                  const badgeValue = item.badgeKey ? (counts as any)?.[item.badgeKey] : 0;

                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        tooltip={item.label}
                        className={`w-full transition-all duration-200 ${
                          isActive 
                            ? "bg-slate-900 text-white shadow-md shadow-slate-200 hover:bg-slate-800 hover:text-white" 
                            : "text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        <Link href={item.href} className="flex items-center justify-between w-full">
                          <div className="flex items-center gap-2">
                             <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-emerald-400" : "text-slate-400"}`} />
                             <span className="font-medium text-sm">{item.label}</span>
                          </div>
                          {badgeValue > 0 && state === "expanded" && (
                            <Badge className="bg-rose-500 text-white border-none text-[8px] px-1.5 h-4 flex items-center justify-center min-w-[16px]">
                              {badgeValue}
                            </Badge>
                          )}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function AdminLayout({
>>>>>>> c47c5e1 (refactor: supprime les modules Portfolio, Chat, Ressources, Waitlist et Annuaire)
  children,
}: {
  children: React.ReactNode;
}) {
  const headerList = await headers();
  const pathname = headerList.get("x-pathname") || "";
  
  // Récupération de la session (le middleware a optimisé la latence, c'est ici qu'on valide le rôle)
  const session = await auth.api.getSession({
    headers: headerList,
  });

  const isLoginPage = pathname === "/admin/login" || pathname.startsWith("/admin/login/");

  // Sécurité Stricte (RSC Validation)
  if (!isLoginPage) {
    // Si pas connecté ou pas admin -> on bloque et on redirige
    if (!session || session.user.role?.toLowerCase() !== 'admin') {
      redirect("/admin/login");
    }
  } else {
    // Si sur la page de login et déjà connecté en tant qu'admin -> go dashboard
    if (session && session.user.role?.toLowerCase() === 'admin') {
      redirect("/admin/dashboard");
    }
  }

  // Pour la page de login des non-connectés, on n'affiche pas la Sidebar
  if (isLoginPage) {
    return <>{children}</>;
  }

  return (
    <SidebarProvider defaultOpen={true}>
      <AdminSidebar admin={session?.user || null} />

      <SidebarInset className="flex flex-col min-h-screen bg-slate-50">
        <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-2 border-b bg-white px-6">
          <div className="flex-1 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="-ml-1" />
              <div className="h-4 w-px bg-slate-200 mx-2" />
              <h1 className="hidden sm:block text-sm font-medium text-slate-600">
                Admin | Ferme Agro-Piscicole Cité St André
              </h1>
            </div>

            <div className="flex items-center gap-4">
              <NotificationCenter />
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </SidebarInset>

      <PusherAdminListener />
    </SidebarProvider>
  );
}
