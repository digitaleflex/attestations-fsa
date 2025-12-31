'use client';

import { useQuery } from '@tanstack/react-query';
import { CheckCircle, Clock } from 'lucide-react';

interface StatsData {
    validated: number;
    pending: number;
}

async function fetchStats(): Promise<StatsData> {
    const res = await fetch('/api/public/stats');
    if (!res.ok) {
        throw new Error('Failed to fetch stats');
    }
    return res.json();
}

export function StatsDisplay() {
    const { data, isLoading, error } = useQuery({
        queryKey: ['attestation-stats'],
        queryFn: fetchStats,
        refetchInterval: 5000, // Mise à jour toutes les 5 secondes
        staleTime: 2000,
    });

    if (error) {
        return null; // On n'affiche rien en cas d'erreur pour ne pas casser l'UI
    }

    return (
        <div className="grid grid-cols-2 gap-4 mt-8 w-full max-w-lg animate-fade-in-up delay-200">
            <div className="flex flex-col items-center p-4 bg-white/50 backdrop-blur-sm border border-green-200 rounded-xl shadow-sm hover:shadow-md transition-all">
                <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span className="text-sm font-medium text-gray-600">Validées</span>
                </div>
                {isLoading ? (
                    <div className="h-8 w-16 bg-gray-200 animate-pulse rounded" />
                ) : (
                    <span className="text-3xl font-bold text-green-700 font-display">
                        {data?.validated.toLocaleString()}
                    </span>
                )}
            </div>

            <div className="flex flex-col items-center p-4 bg-white/50 backdrop-blur-sm border border-orange-200 rounded-xl shadow-sm hover:shadow-md transition-all">
                <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-5 h-5 text-orange-500" />
                    <span className="text-sm font-medium text-gray-600">En cours</span>
                </div>
                {isLoading ? (
                    <div className="h-8 w-16 bg-gray-200 animate-pulse rounded" />
                ) : (
                    <span className="text-3xl font-bold text-orange-600 font-display">
                        {data?.pending.toLocaleString()}
                    </span>
                )}
            </div>
        </div>
    );
}
