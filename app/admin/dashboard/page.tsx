"use client";

import * as React from "react";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, GraduationCap, AlertCircle, CheckCircle, Clock, PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';

export default function AdminDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState({
    attestations: 0,
    attestationsPending: 0,
    attestationsValidated: 0,
    formations: 0,
  });
  const [loadingStats, setLoadingStats] = useState(true);
  const [lastAttestations, setLastAttestations] = useState<any[]>([]);
  const [loadingLast, setLoadingLast] = useState(true);

  useEffect(() => {
    setLoadingStats(true);
    Promise.all([
      fetch('/api/attestations?count=1').then(res => res.json()),
      fetch('/api/attestations?status=PENDING&count=1').then(res => res.json()),
      fetch('/api/attestations?status=VALIDATED&count=1').then(res => res.json()),
      fetch('/api/formations').then(res => res.json()),
    ]).then(([all, pending, validated, formations]) => {
      setStats({
        attestations: all.count || 0,
        attestationsPending: pending.count || 0,
        attestationsValidated: validated.count || 0,
        formations: Array.isArray(formations) ? formations.length : 0,
      });
    }).finally(() => setLoadingStats(false));
  }, []);

  useEffect(() => {
    setLoadingLast(true);
    fetch('/api/attestations?limit=5&order=desc')
      .then(res => res.json())
      .then(data => setLastAttestations(Array.isArray(data) ? data : []))
      .finally(() => setLoadingLast(false));
  }, []);

  return (
    <div className="w-full flex flex-col space-y-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 w-full">
        <h1 className="text-3xl font-bold text-center md:text-left text-gray-800">Tableau de bord</h1>
        <div className="flex flex-col sm:flex-row gap-3 justify-center md:justify-end items-center w-full md:w-auto">
          <Button variant="default" className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white shadow-sm" onClick={() => router.push('/admin/attestations/new')}>
            <PlusCircle className="w-4 h-4 mr-2" /> Attestation
          </Button>
          <Button variant="default" className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white shadow-sm" onClick={() => router.push('/admin/formations/new')}>
            <PlusCircle className="w-4 h-4 mr-2" /> Formation
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 w-full">
        <Card className="bg-blue-50 border-blue-100 shadow-sm hover:shadow-md transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-900">Total Attestations</CardTitle>
            <FileText className="h-4 w-4 text-blue-600" aria-hidden="true" />
          </CardHeader>
          <CardContent>
            {loadingStats ? <Skeleton className="h-8 w-20" /> : <div className="text-2xl font-bold text-blue-900">{stats.attestations}</div>}
            <p className="text-xs text-blue-700 mt-1">Enregistrées</p>
          </CardContent>
        </Card>

        <Card className="bg-yellow-50 border-yellow-100 shadow-sm hover:shadow-md transition-all cursor-pointer" onClick={() => router.push('/admin/attestations?status=PENDING')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-yellow-900">En attente</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" aria-hidden="true" />
          </CardHeader>
          <CardContent>
            {loadingStats ? <Skeleton className="h-8 w-20" /> : <div className="text-2xl font-bold text-yellow-900">{stats.attestationsPending}</div>}
            <p className="text-xs text-yellow-700 mt-1">À valider</p>
          </CardContent>
        </Card>

        <Card className="bg-green-50 border-green-100 shadow-sm hover:shadow-md transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-900">Validées</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" aria-hidden="true" />
          </CardHeader>
          <CardContent>
            {loadingStats ? <Skeleton className="h-8 w-20" /> : <div className="text-2xl font-bold text-green-900">{stats.attestationsValidated}</div>}
            <p className="text-xs text-green-700 mt-1">Approuvées</p>
          </CardContent>
        </Card>

        <Card className="bg-purple-50 border-purple-100 shadow-sm hover:shadow-md transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-purple-900">Formations</CardTitle>
            <GraduationCap className="h-4 w-4 text-purple-600" aria-hidden="true" />
          </CardHeader>
          <CardContent>
            {loadingStats ? <Skeleton className="h-8 w-20" /> : <div className="text-2xl font-bold text-purple-900">{stats.formations}</div>}
            <p className="text-xs text-purple-700 mt-1">Disponibles</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
        <Card className="shadow-sm border-gray-100 hover:shadow-md transition-all cursor-pointer" onClick={() => router.push('/admin/stats')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-semibold text-gray-800">Taux de validation</CardTitle>
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs">%</span>
          </CardHeader>
          <CardContent>
            {loadingStats || stats.attestations === 0 ? <Skeleton className="h-8 w-20" /> : (
              <div className="flex flex-col">
                <span className="text-3xl font-bold text-indigo-900">{Math.round((stats.attestationsValidated / stats.attestations) * 100)}%</span>
                <p className="text-xs text-gray-500 mt-1">des attestations sont validées</p>
              </div>
            )}
          </CardContent>
        </Card>
        {/* Placeholder for future specific stats or quick actions */}
        <div className="hidden lg:block"></div>
      </div>


      {/* Recent Attestations Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 md:p-6 w-full">
        <div className="flex items-center justify-between mb-4 md:mb-6">
          <div className="flex items-center gap-2">
            <FileText className="text-blue-600 w-5 h-5" aria-hidden="true" />
            <h2 className="text-lg font-semibold text-gray-800">Dernières attestations</h2>
          </div>
          <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700 hover:bg-blue-50" onClick={() => router.push('/admin/attestations')}>
            Voir tout
          </Button>
        </div>

        {loadingLast ? (
          <div className="space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : lastAttestations.length === 0 ? (
          <div className="text-center text-gray-400 py-8 text-sm">Aucune attestation récente.</div>
        ) : (
          <div className="rounded-md border border-gray-100 overflow-hidden">
            {/* Mobile View: Cards */}
            <div className="block md:hidden">
              {lastAttestations.map((a: any) => (
                <div key={a.id} className="p-4 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors" onClick={() => router.push(`/admin/attestations/${a.id}`)}>
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-medium text-gray-900">{a.fullName}</span>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${a.status === 'VALIDATED' ? 'bg-green-100 text-green-700' :
                        a.status === 'REJECTED' ? 'bg-red-100 text-red-700' :
                          'bg-yellow-100 text-yellow-800'
                      }`}>
                      {a.status}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs text-gray-500">
                    <span className="font-mono bg-gray-100 px-1 py-0.5 rounded text-gray-600">{a.code}</span>
                    <span>{a.issuedAt ? new Date(a.issuedAt).toLocaleDateString() : '-'}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop View: Table */}
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50/50">
                    <TableHead className="w-[120px]">Code</TableHead>
                    <TableHead>Nom complet</TableHead>
                    <TableHead className="w-[120px]">Statut</TableHead>
                    <TableHead className="w-[120px]">Date</TableHead>
                    <TableHead className="w-[50px] text-right"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lastAttestations.map((a: any) => (
                    <TableRow key={a.id} className="cursor-pointer hover:bg-gray-50" onClick={() => router.push(`/admin/attestations/${a.id}`)}>
                      <TableCell className="font-mono text-xs font-medium text-gray-600">{a.code}</TableCell>
                      <TableCell className="font-medium text-gray-900">{a.fullName}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ring-1 ring-inset ${a.status === 'VALIDATED' ? 'bg-green-50 text-green-700 ring-green-600/20' :
                            a.status === 'REJECTED' ? 'bg-red-50 text-red-700 ring-red-600/20' :
                              'bg-yellow-50 text-yellow-800 ring-yellow-600/20'
                          }`}>
                          {a.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-gray-500 text-sm">{a.issuedAt ? new Date(a.issuedAt).toLocaleDateString() : "-"}</TableCell>
                      <TableCell className="text-right">
                        <div className="p-2 text-gray-400">
                          <FileText className="w-4 h-4" />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}