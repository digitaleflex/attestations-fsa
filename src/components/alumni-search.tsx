'use client';

import { useState } from 'react';
import { Search, Loader2, User, Trophy, Award } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useQuery } from '@tanstack/react-query';
import { useDebounce } from '@/hooks/use-debounce';

interface Alumni {
    name: string;
    formation: string;
    year: number;
}

// Helper to get initials from a name
const getInitials = (name: string | null | undefined) => {
    if (!name) return '??';
    const names = name.trim().split(' ').filter(n => n.length > 0);
    if (names.length > 1) {
        return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
    }
    if (names.length === 1 && names[0].length > 0) {
        return names[0].substring(0, 2).toUpperCase();
    }
    return '??';
};

export function AlumniSearch() {
    const [search, setSearch] = useState('');
    const debouncedSearch = useDebounce(search, 500);

    const { data, isLoading, isError } = useQuery({
            queryKey: ['alumni', debouncedSearch],
            queryFn: async () => {
                if (debouncedSearch.length < 3) return [];
                const res = await fetch(`/api/public/alumni?query=${encodeURIComponent(debouncedSearch)}`);
                if (!res.ok) throw new Error('Network response was not ok');
                return res.json() as Promise<Alumni[]>;
            },
            enabled: debouncedSearch.length >= 3,
        });
    
        return (
            <div className="w-full max-w-4xl mx-auto my-12 px-4 animate-fade-in-up">
                <div className="bg-white/60 backdrop-blur-xl rounded-3xl shadow-2xl border border-gray-100/80 p-6 sm:p-10">
                    <div className="text-center mb-10">
                        <Award className="mx-auto h-12 w-12 text-blue-500" />
                        <h1 className="text-4xl font-extrabold text-gray-900 mt-4 font-display">
                            Annuaire des Lauréats
                        </h1>
                        <p className="text-gray-600 mt-2 max-w-xl mx-auto">
                            Explorez le réseau de professionnels certifiés par notre institution.
                        </p>
                    </div>
    
    
                    <div className="relative mb-8 max-w-lg mx-auto">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <Input
                            placeholder="Rechercher par nom (min. 3 caractères)..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-12 h-14 text-lg rounded-full border-gray-200 focus:border-blue-500 focus:ring-blue-500 transition-all bg-white shadow-inner"
                        />
                    </div>
    
                    <div className="space-y-4 min-h-[150px]">
                        {isLoading && debouncedSearch.length >= 3 && (
                            <div className="flex justify-center items-center py-10 gap-3">
                                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                                <span className='text-gray-500'>Chargement...</span>
                            </div>
                        )}
    
                        {data && data.length > 0 ? (
                            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
                                {data.map((alum, idx) => (
                                    <div key={idx} className="group flex flex-col items-center text-center p-6 rounded-2xl bg-gray-50/80 border border-gray-200/80 hover:bg-white hover:shadow-lg hover:-translate-y-1 transition-transform duration-300">
                                        <div className="h-20 w-20 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-2xl mb-4 border-4 border-white shadow-md group-hover:scale-110 transition-transform">
                                            {getInitials(alum.name)}
                                        </div>
                                        <p className="font-bold text-lg text-gray-900 capitalize">{alum.name}</p>
                                        <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                                            <Trophy className="w-4 h-4 text-blue-400" />
                                            <span>{alum.formation}</span>
                                        </div>
                                        <div className="text-xs text-gray-400 mt-2">
                                            Promotion {alum.year}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : debouncedSearch.length >= 3 && !isLoading && !isError ? (
                            <div className="text-center text-gray-500 py-10">
                                <p>Aucun résultat trouvé pour "{debouncedSearch}".</p>
                                <p className='text-sm text-gray-400 mt-1'>Essayez une autre recherche.</p>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center text-gray-400 py-10 opacity-60">
                                <Search className="w-12 h-12 mb-2" />
                                <span className="text-base">Commencez à taper pour rechercher...</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );}
