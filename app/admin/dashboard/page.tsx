import { prisma } from "@/lib/prisma";
import Link from 'next/link';
import { FileText, GraduationCap, AlertCircle, CheckCircle, Clock, PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';

async function getStats() {
  const [
    attestations,
    attestationsPending,
    attestationsValidated,
    formations,
    lastAttestations
  ] = await Promise.all([
    prisma.attestation.count(),
    prisma.attestation.count({ where: { status: 'PENDING' } }),
    prisma.attestation.count({ where: { status: 'VALIDATED' } }),
    prisma.formation.count(),
    prisma.attestation.findMany({
      take: 5,
      orderBy: { issuedAt: 'desc' },
      select: {
        id: true,
        code: true,
        fullName: true,
        status: true,
        issuedAt: true,
      }
    })
  ]);

  return {
    attestations,
    attestationsPending,
    attestationsValidated,
    formations,
    lastAttestations
  };
}

export default async function AdminDashboard() {
  const { attestations, attestationsPending, attestationsValidated, formations, lastAttestations } = await getStats();

  return (
    <div className="w-full flex flex-col space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 w-full">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600">Tableau de bord</h1>
          <p className="text-slate-500 mt-1">Vue d'ensemble de l'activité de la plateforme.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center md:justify-end items-center w-full md:w-auto">
          <Link href="/admin/attestations/new" className="w-full sm:w-auto">
            <Button variant="default" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-md hover:shadow-lg transition-all">
              <PlusCircle className="w-4 h-4 mr-2" /> Attestation
            </Button>
          </Link>
          <Link href="/admin/formations/new" className="w-full sm:w-auto">
            <Button variant="outline" className="w-full border-indigo-200 text-indigo-700 hover:bg-indigo-50">
              <PlusCircle className="w-4 h-4 mr-2" /> Formation
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 w-full">
        <Card className="glass-card border-l-4 border-l-indigo-500 cursor-default">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Total Attestations</CardTitle>
            <div className="p-2 bg-indigo-50 rounded-full">
              <FileText className="h-4 w-4 text-indigo-600" aria-hidden="true" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{attestations}</div>
            <p className="text-xs text-slate-400 mt-1">+2 depuis hier (simulé)</p>
          </CardContent>
        </Card>

        <Link href="/admin/attestations?status=PENDING" className="block h-full">
          <Card className="glass-card border-l-4 border-l-amber-500 cursor-pointer hover:bg-amber-50/10 h-full transition-colors">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">En attente</CardTitle>
              <div className="p-2 bg-amber-50 rounded-full">
                <Clock className="h-4 w-4 text-amber-600" aria-hidden="true" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900">{attestationsPending}</div>
              <p className="text-xs text-amber-600 mt-1 font-medium">Action requise</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/attestations?status=VALIDATED" className="block h-full">
          <Card className="glass-card border-l-4 border-l-emerald-500 hover:bg-emerald-50/10 h-full transition-colors">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Validées</CardTitle>
              <div className="p-2 bg-emerald-50 rounded-full">
                <CheckCircle className="h-4 w-4 text-emerald-600" aria-hidden="true" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900">{attestationsValidated}</div>
              <p className="text-xs text-slate-400 mt-1">Dossiers clos</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/formations" className="block h-full">
          <Card className="glass-card border-l-4 border-l-purple-500 hover:bg-purple-50/10 h-full transition-colors">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Formations</CardTitle>
              <div className="p-2 bg-purple-50 rounded-full">
                <GraduationCap className="h-4 w-4 text-purple-600" aria-hidden="true" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900">{formations}</div>
              <p className="text-xs text-slate-400 mt-1">Actives</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full">
        <Card className="col-span-1 lg:col-span-2 glass-panel border-0">
          <CardHeader className="border-b border-slate-100/50 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-bold text-slate-800">Dernières attestations</CardTitle>
                <p className="text-sm text-slate-500">Les 5 dernières demandes reçues.</p>
              </div>
              <Link href="/admin/attestations">
                <Button variant="ghost" size="sm" className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-full text-xs font-semibold">
                  Voir tout
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {lastAttestations.length === 0 ? (
              <div className="text-center text-slate-400 py-12 text-sm">Aucune donnée disponible.</div>
            ) : (
              <div className="w-full">
                {/* Mobile View */}
                <div className="block md:hidden">
                  {lastAttestations.map((a: any) => (
                    <Link key={a.id} href={`/admin/attestations/${a.id}`} className="block">
                      <div className="p-4 border-b border-slate-100 last:border-0 active:bg-slate-50">
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-semibold text-slate-800 text-sm">{a.fullName}</span>
                          <span className={`h-2 w-2 rounded-full ${a.status === 'VALIDATED' ? 'bg-emerald-500' :
                            a.status === 'REJECTED' ? 'bg-rose-500' :
                              'bg-amber-400'
                            }`}></span>
                        </div>
                        <div className="flex justify-between items-center text-xs text-slate-500 mt-2">
                          <span className="bg-slate-100 px-2 py-1 rounded text-slate-600 font-mono">{a.code}</span>
                          <span>{a.issuedAt ? new Date(a.issuedAt).toLocaleDateString() : '-'}</span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>

                {/* Desktop View */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                        <TableHead className="w-[100px] text-xs font-semibold uppercase tracking-wider text-slate-500">Code</TableHead>
                        <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500">Étudiant</TableHead>
                        <TableHead className="w-[120px] text-xs font-semibold uppercase tracking-wider text-slate-500">Statut</TableHead>
                        <TableHead className="w-[120px] text-xs font-semibold uppercase tracking-wider text-slate-500">Date</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lastAttestations.map((a: any) => (
                        <TableRow key={a.id} className="cursor-pointer hover:bg-indigo-50/30 transition-colors border-b border-slate-50 group">
                          <TableCell className="font-mono text-xs font-medium text-slate-500">
                            <Link href={`/admin/attestations/${a.id}`} className="block w-full h-full">
                              {a.code}
                            </Link>
                          </TableCell>
                          <TableCell className="font-medium text-slate-900">
                            <Link href={`/admin/attestations/${a.id}`} className="block w-full h-full">
                              {a.fullName}
                            </Link>
                          </TableCell>
                          <TableCell>
                            <Link href={`/admin/attestations/${a.id}`} className="block w-full h-full">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${a.status === 'VALIDATED' ? 'bg-emerald-100 text-emerald-700' :
                                a.status === 'REJECTED' ? 'bg-rose-100 text-rose-700' :
                                  'bg-amber-100 text-amber-700'
                                }`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${a.status === 'VALIDATED' ? 'bg-emerald-500' :
                                  a.status === 'REJECTED' ? 'bg-rose-500' :
                                    'bg-amber-500'
                                  }`}></span>
                                {a.status}
                              </span>
                            </Link>
                          </TableCell>
                          <TableCell className="text-slate-500 text-xs">
                            <Link href={`/admin/attestations/${a.id}`} className="block w-full h-full">
                              {a.issuedAt ? new Date(a.issuedAt).toLocaleDateString() : "-"}
                            </Link>
                          </TableCell>
                          <TableCell className="text-right">
                            <Link href={`/admin/attestations/${a.id}`} className="flex justify-end w-full h-full">
                              <FileText className="w-4 h-4 text-slate-300 group-hover:text-indigo-400 transition-colors" />
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="glass-card shadow-sm border-0 flex flex-col justify-center items-center text-center p-6 bg-gradient-to-b from-indigo-600 to-purple-700 text-white relative overflow-hidden">
          {/* Decorative circles */}
          <div className="absolute top-0 right-0 -mt-10 -mr-10 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
          <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>

          <div className="relative z-10 w-full">
            <div className="mx-auto w-16 h-16 bg-white/20 rounded-full flex items-center justify-center backdrop-blur mb-4">
              <span className="text-2xl font-bold">%</span>
            </div>
            <h3 className="text-lg font-semibold mb-2 text-white">Taux de validation</h3>

            <div className="text-5xl font-bold mb-2 tracking-tight">
              {attestations === 0 ? 0 : Math.round((attestationsValidated / attestations) * 100)}%
            </div>

            <p className="text-indigo-100 text-xs mb-6">Attestations approuvées sur le total.</p>
            <Link href="/admin/stats" className="w-full block">
              <Button variant="secondary" className="w-full bg-white text-indigo-600 hover:bg-indigo-50 border-0">
                Voir les détails
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}