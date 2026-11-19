import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge, RoleBadge, VerifiedBadge } from "@/components/admin/users/UserBadges";
import { UserAuditLogs } from "@/components/admin/user-audit-logs";
import { UserProfileActions } from "@/components/admin/users/UserProfileActions";


function initialsOf(name?: string | null, email?: string | null): string {
  const base = (name || email || "?").trim();
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length > 1) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return base.slice(0, 2).toUpperCase();
}

function formatDateLocal(value: Date | string | null | undefined): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("fr-FR");
}

function formatDateTimeLocal(value: Date | string | null | undefined): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("fr-FR");
}

export default async function AdminUserProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      attestations: { orderBy: { issuedAt: "desc" } },
      examSessions: { orderBy: { startedAt: "desc" } },
      examEnrollments: { orderBy: { createdAt: "desc" } },
      auditLogs: { orderBy: { timestamp: "desc" }, take: 50 },
    },
  });

  if (!user) notFound();

  const name = user.name || user.email || "Utilisateur";

  return (
    <div className="min-w-0 space-y-6 p-4 sm:p-6 bg-white">
      <PageHeader
        breadcrumb={[
          { label: "Admin", href: "/admin" },
          { label: "Apprenants", href: "/admin/users" },
          { label: name },
        ]}
        title={name}
        description={user.email || undefined}
        action={<UserProfileActions user={{ id: user.id, status: user.status, name: user.name }} />}
      />

      <Card className="p-6 bg-white border border-slate-200">
        <div className="flex items-center gap-4">
          <span
            aria-hidden="true"
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-brand/10 text-xl font-black text-brand-dark"
          >
            {initialsOf(user.name, user.email)}
          </span>
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-slate-800 truncate">{name}</h2>
            <p className="text-sm text-slate-500 truncate">{user.email}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <StatusBadge status={user.status as any} />
              <RoleBadge role={user.role} />
              <VerifiedBadge verified={Boolean(user.emailVerified)} />
            </div>
          </div>
        </div>
      </Card>

      <Tabs defaultValue="identity" className="w-full">
        <TabsList>
          <TabsTrigger value="identity">Identité</TabsTrigger>
          <TabsTrigger value="exams">Examens</TabsTrigger>
          <TabsTrigger value="attestations">Attestations</TabsTrigger>
          <TabsTrigger value="audit">Audit</TabsTrigger>
        </TabsList>

        <TabsContent value="identity">
          <Card className="p-6 bg-white border border-slate-200">
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div><dt className="text-slate-500">Nom</dt><dd className="font-medium">{user.name || "-"}</dd></div>
              <div><dt className="text-slate-500">Email</dt><dd className="font-medium">{user.email || "-"}</dd></div>
              <div><dt className="text-slate-500">Téléphone</dt><dd className="font-medium">{user.phone || "-"}</dd></div>
              <div><dt className="text-slate-500">Adresse</dt><dd className="font-medium">{user.address || "-"}</dd></div>
              <div><dt className="text-slate-500">Date de naissance</dt><dd className="font-medium">{formatDateLocal(user.birthDate)}</dd></div>
              <div><dt className="text-slate-500">Lieu de naissance</dt><dd className="font-medium">{user.birthPlace || "-"}</dd></div>
              <div><dt className="text-slate-500">Rôle</dt><dd className="font-medium">{user.role}</dd></div>
              <div><dt className="text-slate-500">Statut</dt><dd className="font-medium">{user.status}</dd></div>
              <div><dt className="text-slate-500">Vérifié</dt><dd className="font-medium">{user.emailVerified ? "Oui" : "Non"}</dd></div>
              <div><dt className="text-slate-500">Inscrit le</dt><dd className="font-medium">{formatDateTimeLocal(user.createdAt)}</dd></div>
              <div><dt className="text-slate-500">Dernière activité</dt><dd className="font-medium">{formatDateTimeLocal(user.updatedAt)}</dd></div>
            </dl>
          </Card>
        </TabsContent>

        <TabsContent value="exams">
          <Card className="p-6 bg-white border border-slate-200">
            {user.examSessions.length === 0 && user.examEnrollments.length === 0 ? (
              <p className="text-sm text-slate-500">Aucun examen.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {user.examSessions.map((s: any) => (
                  <li key={s.id} className="border-b border-slate-100 pb-2">
                    Session {s.id} — {s.status} — {formatDateTimeLocal(s.startedAt)}
                  </li>
                ))}
                {user.examEnrollments.map((e: any) => (
                  <li key={e.id} className="border-b border-slate-100 pb-2">
                    Inscription {e.id} — {e.status ?? "-"} — {formatDateTimeLocal(e.createdAt)}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="attestations">
          <Card className="p-6 bg-white border border-slate-200">
            {user.attestations.length === 0 ? (
              <p className="text-sm text-slate-500">Aucune attestation.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {user.attestations.map((a: any) => (
                  <li key={a.id} className="border-b border-slate-100 pb-2">
                    {a.code} — {a.status} — {formatDateLocal(a.issuedAt)}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="audit">
          <Card className="p-6 bg-white border border-slate-200">
            <UserAuditLogs userId={user.id} />
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

