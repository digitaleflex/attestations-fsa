import { SidebarProvider, Sidebar, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarInset } from "@/components/ui/sidebar";

export default function AdminDashboard() {
  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <span className="text-lg font-bold">Admin FSA</span>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={true}>
                <a href="/admin/dashboard">Dashboard</a>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <a href="/admin/attestations/new">Nouvelle attestation</a>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <a href="/admin/attestations">Liste des attestations</a>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <a href="/admin/logout">Déconnexion</a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <main className="p-8">
          <h1 className="text-3xl font-bold mb-6">Dashboard Admin</h1>
          {/* Ici le contenu du dashboard, à compléter selon les besoins */}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
} 