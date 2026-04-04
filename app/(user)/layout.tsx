"use client";

export const dynamic = 'force-dynamic';

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  LayoutDashboard,
  FileText,
  BookOpen,
  Briefcase,
  CheckCircle,
  User,
  LogOut,
  Menu,
  X,
  BarChart3,
  HelpCircle,
  LifeBuoy,
  MessageCircle,
  Bell,
  GraduationCap
} from "lucide-react";
import ChatBubble from "@/components/ChatBubble";
import NotificationBell from "@/components/NotificationBell";
import { getCurrentUser } from "@/lib/auth";

export default function UserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Vérification de l'utilisateur pour le menu
  const { data: user, isLoading } = useQuery({
    queryKey: ["user-profile"],
    queryFn: async () => {
      const res = await fetch("/api/user/profile");
      if (!res.ok) {
        if (res.status === 401) {
          router.push("/auth");
        }
        throw new Error("Non autorisé");
      }
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    toast.success("Déconnecté avec succès");
    router.push("/");
  };

  const menuItems = [
    { name: "Tableau de bord", href: "/dashboard", icon: LayoutDashboard },
    { name: "Mes Attestations", href: "/attestations", icon: FileText },
    { name: "Examens", href: "/exams", icon: BookOpen },
    { name: "Stages", href: "/internships", icon: Briefcase },
    { name: "Résultats", href: "/results", icon: BarChart3 },
    { name: "Relevé de notes", href: "/transcript", icon: GraduationCap },
    { name: "Notifications", href: "/notifications", icon: Bell },
    { name: "Support", href: "/support", icon: HelpCircle },
    { name: "Mon Profil", href: "/profile", icon: User },
  ];

  // Mode Focus pour les examens (Pas de sidebar, pas de header)
  const isExamPage = pathname ? pathname.startsWith("/exams/") && pathname !== "/exams" : false;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-10 h-10 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin"></div>
      </div>
    );
  }

  if (isExamPage) {
    return (
      <div className="min-h-screen bg-slate-50">
        {children}
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      
      {/* Sidebar Desktop */}
      <aside 
        className={`hidden lg:flex flex-col bg-white border-r border-slate-200/60 shadow-[4px_0_24px_-10px_rgba(0,0,0,0.05)] transition-all duration-300 z-20 ${
          isSidebarOpen ? "w-64" : "w-20"
        }`}
      >
        <div className="h-20 flex items-center px-5 border-b border-slate-100 justify-between">
          <div className="flex items-center gap-3 overflow-hidden" title="Ferme Agro-piscicole St Andre">
            <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-blue-600 flex items-center justify-center text-white font-bold shadow-sm">
              FSA
            </div>
            {isSidebarOpen && (
              <div className="flex flex-col">
                <span className="font-bold text-slate-800 tracking-tight whitespace-nowrap text-xs">Agro-piscicole</span>
                <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">St Andre</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-6 px-3 space-y-1.5 scrollbar-hide">
          {menuItems.map((item) => {
            const isActive = pathname === item.href || (pathname && pathname.startsWith(`${item.href}/`));
            return (
              <Link key={item.name} href={item.href}>
                <div 
                  className={`flex items-center gap-3.5 px-3 py-3 rounded-xl transition-all duration-300 group ${
                    isActive 
                      ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/25 scale-100" 
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-800 active:scale-95"
                  }`}
                  title={!isSidebarOpen ? item.name : undefined}
                >
                  <item.icon className={`w-5 h-5 flex-shrink-0 transition-transform ${isActive ? "text-white" : "text-slate-400 group-hover:text-emerald-500"}`} />
                  {isSidebarOpen && (
                    <span className="font-medium whitespace-nowrap tracking-wide text-sm">{item.name}</span>
                  )}
                </div>
              </Link>
            )
          })}
        </div>

        <div className="p-4 border-t border-slate-100 bg-white">
          <button 
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-3 text-slate-500 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all active:scale-95"
            title={!isSidebarOpen ? "Déconnexion" : undefined}
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {isSidebarOpen && <span className="font-medium whitespace-nowrap text-sm">Déconnexion</span>}
          </button>
        </div>
      </aside>

      {/* Main content wrapper */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        
        {/* Header (Top Navbar) */}
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-slate-200/60 shadow-sm flex items-center justify-between px-6 lg:px-10 z-10 flex-shrink-0">
          <div className="flex items-center gap-4">
            <button 
              className="lg:hidden p-2 text-slate-500 hover:bg-slate-100 rounded-xl transition-colors"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu className="w-6 h-6" />
            </button>
            <button 
              className="hidden lg:flex items-center justify-center w-10 h-10 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            >
              <Menu className="w-5 h-5" />
            </button>
            <h2 className="hidden sm:block text-xl font-bold text-slate-800 tracking-tight">
              {menuItems.find(i => pathname === i.href || (pathname && pathname.startsWith(`${i.href}/`)))?.name || "Espace Candidat"}
            </h2>
          </div>

          <div className="flex items-center gap-5">
            <NotificationBell />
            <div className="flex items-center gap-3 bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-sm hover:shadow-md transition-shadow cursor-default">
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-emerald-100 to-blue-50 text-emerald-600 border border-emerald-100 flex items-center justify-center font-bold text-sm shadow-inner">
                {user?.name?.charAt(0) || <User className="w-4 h-4" />}
              </div>
              <span className="hidden md:block text-sm font-semibold text-slate-700 pr-3">
                {user?.name || "Candidat"}
              </span>
            </div>
          </div>
        </header>

        {/* Page Content area */}
        <main className="flex-1 overflow-y-auto bg-slate-50/50 p-6 lg:p-10 relative scrollbar-hide pb-24 lg:pb-10">
          <div className="mx-auto max-w-6xl animate-in slide-in-from-bottom-4 fade-in duration-500 ease-out pb-20">
            {children}
          </div>
        </main>

        {/* Floating Help Button - Premium Glassmorphism */}
        <div className="fixed bottom-24 lg:bottom-10 right-6 lg:right-10 z-30 group">
          <Link href="/support">
            <button className="flex items-center gap-3 bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-2xl hover:scale-105 active:scale-95 transition-all duration-300 relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/20 to-emerald-500/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                <LifeBuoy className="w-5 h-5 text-emerald-400 group-hover:rotate-12 transition-transform" />
                <span className="font-bold text-sm tracking-tight">Assistance</span>
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full ring-4 ring-white animate-pulse" />
            </button>
          </Link>
        </div>

        {/* Real-time Messaging System */}
        <ChatBubble />
      </div>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div 
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" 
            onClick={() => setIsMobileMenuOpen(false)}
          ></div>
          <div className="relative w-80 max-w-[85vw] bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-left duration-300 ease-out">
            <div className="h-20 flex items-center justify-between px-6 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-md">
                  FSA
                </div>
                <span className="font-bold text-slate-800 tracking-tight">Portail Candidat</span>
              </div>
              <button 
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-white rounded-full transition-colors shadow-sm"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto py-6 px-4 space-y-2">
              {menuItems.map((item) => {
                const isActive = pathname === item.href || (pathname && pathname.startsWith(`${item.href}/`));
                return (
                  <Link key={item.name} href={item.href} onClick={() => setIsMobileMenuOpen(false)}>
                    <div className={`flex items-center gap-4 px-4 py-3.5 rounded-xl transition-colors font-medium border border-transparent ${
                      isActive 
                        ? "bg-emerald-50 text-emerald-700 border-emerald-100 shadow-sm" 
                        : "text-slate-600 hover:bg-slate-50"
                    }`}>
                      <item.icon className={`w-5 h-5 ${isActive ? "text-emerald-500" : "text-slate-400"}`} />
                      {item.name}
                    </div>
                  </Link>
                )
              })}
            </div>
            <div className="p-4 border-t border-slate-100 bg-slate-50/50">
              <button 
                onClick={handleLogout}
                className="flex items-center justify-center gap-3 w-full px-4 py-3.5 bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-xl transition-colors font-semibold shadow-sm"
              >
                <LogOut className="w-5 h-5" />
                Déconnexion
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Mobile Bottom Bar - Premium Glassmorphism */}
      <nav className="lg:hidden fixed bottom-6 left-6 right-6 z-40">
        <div className="bg-white/80 backdrop-blur-xl border border-white/20 shadow-[0_8px_32px_0_rgba(0,0,0,0.12)] rounded-3xl px-4 py-2 flex items-center justify-between relative overflow-hidden">
          {/* Subtle background glow */}
          <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/5 to-blue-500/5 -z-10" />
          
          {[
            { name: "Accueil", href: "/dashboard", icon: LayoutDashboard },
            { name: "Examens", href: "/exams", icon: BookOpen },
            { name: "Résultats", href: "/results", icon: BarChart3 },
            { name: "Attestations", href: "/attestations", icon: FileText },
            { name: "Notifs", href: "/notifications", icon: Bell },
            { name: "Profil", href: "/profile", icon: User },
          ].map((item) => {
            const isActive = pathname === item.href || (pathname && pathname.startsWith(`${item.href}/`));
            return (
              <Link
                key={item.name}
                href={item.href}
                className="relative flex flex-col items-center gap-1 px-3 py-1.5 rounded-2xl transition-all active:scale-90"
              >
                {isActive && (
                  <div className="absolute inset-x-1 inset-y-1 bg-emerald-500 rounded-2xl -z-10 shadow-lg shadow-emerald-500/20 animate-in fade-in zoom-in duration-300" />
                )}
                <item.icon className={`w-5 h-5 transition-colors duration-300 ${
                  isActive ? "text-white" : "text-slate-400"
                }`} />
                <span className={`text-[9px] font-bold uppercase tracking-tighter transition-colors duration-300 ${
                  isActive ? "text-white" : "text-slate-400"
                }`}>
                  {item.name}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
