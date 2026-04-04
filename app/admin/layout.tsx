"use client";

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
  SidebarRail
} from '@/components/ui/sidebar';
import { cn } from "@/lib/utils";
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
  Library
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import NotificationCenter from '@/components/admin/NotificationCenter';

const menuItems = [
  { href: '/admin/dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
  { href: '/admin/messages', label: 'Messagerie', icon: Inbox },
  { href: '/admin/stats', label: 'Statistiques', icon: BarChart3 },
  { href: '/admin/attestations', label: 'Attestations', icon: FileText },
  { href: '/admin/formations', label: 'Formations', icon: GraduationCap },
  { href: '/admin/monitoring', label: 'Surveillance', icon: Shield },
  { href: '/admin/resources', label: 'Ressources', icon: Library },
  { href: '/admin/exams', label: 'Examens', icon: ClipboardCheck },
  { href: '/admin/internships', label: 'Stages', icon: Briefcase },
  { href: '/admin/users', label: 'Utilisateurs', icon: Users },
  { href: '/admin/signalements', label: 'Signalements', icon: AlertCircle },
  { href: '/admin/corrections', label: 'Corrections', icon: ClipboardCheck },
  { href: '/admin/profile', label: 'Mon Profil', icon: Home },
  { href: '/admin/settings', label: 'Paramètres', icon: Settings },
];

function SidebarMenuContent() {
  const pathname = usePathname();

  return (
    <>
      {menuItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href || (item.href !== '/admin/dashboard' && pathname.startsWith(item.href));

        return (
          <SidebarMenuItem key={item.href}>
            <SidebarMenuButton
              asChild
              isActive={isActive}
              tooltip={item.label}
              className={`w-full ${isActive ? 'bg-red-600 text-white hover:bg-red-700 hover:text-white' : ''}`}
            >
              <Link href={item.href}>
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Ne pas afficher la sidebar pour la page de login
  const isLoginPage = pathname === '/admin/login' || pathname?.startsWith('/admin/login/');

  const { data: admin, isLoading } = useQuery({
    queryKey: ['admin'],
    queryFn: async () => {
      const res = await fetch('/api/admin');
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    enabled: !isLoginPage,
  });

  // Rediriger si pas admin (sauf page de login)
  if (!isLoginPage && !isLoading && !admin) {
    if (typeof window !== 'undefined') {
      window.location.href = '/admin/login';
    }
    return null;
  }

  if (isLoginPage) {
    return <>{children}</>;
  }

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/admin/login';
  };

  return (
    <SidebarProvider defaultOpen={true}>
      <AdminLayoutInner admin={admin} onLogout={handleLogout}>
        {children}
      </AdminLayoutInner>
    </SidebarProvider>
  );
}

function AdminLayoutInner({ children, admin, onLogout }: { children: React.ReactNode, admin: any, onLogout: () => void }) {
  const { state, isMobile } = useSidebar();
  
  // Sur desktop, on force un padding-left égal à la largeur de la sidebar
  const desktopPadding = state === 'expanded' ? 'md:pl-64' : 'md:pl-[3rem]';

  return (
    <div className="flex min-h-screen w-full bg-slate-50 overflow-x-hidden">
      <Sidebar collapsible="icon" className="border-r shadow-sm">
        <SidebarHeader className="border-b border-slate-100 p-4">
          <SidebarHeaderContent />
        </SidebarHeader>

        <SidebarContent className="flex-1 px-2 py-4">
          <SidebarMenu className="space-y-1">
            <SidebarMenuContent />
          </SidebarMenu>
        </SidebarContent>

        <SidebarSeparator className="mx-4 bg-slate-100" />

        <SidebarFooter className="p-4 space-y-4">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Site public">
                <Link href="/">
                  <Home className="w-4 h-4 shrink-0" />
                  <span>Site public</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton 
                onClick={onLogout} 
                tooltip="Déconnexion"
                className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
              >
                <LogOut className="w-4 h-4 shrink-0" />
                <span>Déconnexion</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>

          <AdminInfo admin={admin} />
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset className={cn(
        "flex flex-col flex-1 transition-[padding] duration-300 ease-in-out bg-slate-50",
        !isMobile && desktopPadding
      )}>
        <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-white px-4">
          <div className="flex-1 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="-ml-1" />
              <div className="h-4 w-px bg-slate-200 mx-2" />
              <h1 className="hidden sm:block text-sm font-medium text-slate-600">Admin | Ferme Agro-Piscicole Cité St André</h1>
            </div>
            
            <div className="flex items-center gap-4">
              <NotificationCenter />
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </SidebarInset>
    </div>
  );
}

function SidebarHeaderContent() {
  const { state } = useSidebar();
  return (
    <div className="flex items-center gap-2 overflow-hidden">
      <div className="shrink-0 w-8 h-8 bg-gradient-to-br from-red-500 to-rose-600 rounded-lg flex items-center justify-center shadow-sm">
        <span className="text-white font-bold text-sm">FSA</span>
      </div>
      {state === 'expanded' && (
        <div className="transition-all duration-300 opacity-100 translate-x-0">
          <span className="text-lg font-bold block whitespace-nowrap text-slate-800">Admin FSA</span>
          <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold whitespace-nowrap">Gestion Centrale</span>
        </div>
      )}
    </div>
  );
}

function AdminInfo({ admin }: { admin: any }) {
  const { state } = useSidebar();
  if (!admin || state !== 'expanded') return null;

  return (
    <div className="mt-2 rounded-xl bg-slate-50 p-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1">Session active</p>
      <p className="font-medium text-slate-700 truncate text-xs">{admin.name || admin.email}</p>
    </div>
  );
}
