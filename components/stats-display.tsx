'use client';

import { useQuery } from '@tanstack/react-query';
import { CheckCircle, Clock, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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
    const { data, isLoading, error, isFetching } = useQuery({
        queryKey: ['attestation-stats'],
        queryFn: fetchStats,
        refetchInterval: 1800000, // Sync every 30 minutes
        staleTime: 900000, // Data stays fresh for 15 minutes
    });

    if (error) return null;

    return (
        <div className="w-full max-w-4xl mx-auto px-6 mt-12 md:mt-16 overflow-visible">
            <div className="text-center mb-10 space-y-2">
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-600 bg-emerald-50 px-4 py-1.5 rounded-full border border-emerald-100 shadow-sm">
                    Impact en Temps Réel
                </span>
            </div>

            <div className="flex flex-wrap justify-center gap-8 md:gap-12">
                {/* VALIDATED STATS */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    whileInView={{ opacity: 1, scale: 1, y: 0 }}
                    viewport={{ once: true }}
                    whileHover={{ y: -8, scale: 1.02 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    className="relative group w-full sm:w-[calc(50%-2rem)] max-w-sm"
                >
                    {/* Background Glow */}
                    <div className="absolute -inset-2 bg-gradient-to-r from-emerald-500/20 to-teal-400/20 rounded-[3rem] blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                    
                    <div className="relative flex flex-col items-center p-8 md:p-12 bg-white/80 backdrop-blur-3xl border border-emerald-100/50 rounded-[3rem] shadow-2xl shadow-emerald-500/5 overflow-hidden">
                        {/* Decorative Glass Ring */}
                        <div className="absolute -top-10 -right-10 w-32 h-32 bg-emerald-50/50 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                        <div className="flex items-center gap-4 mb-6">
                            <div className="p-3 bg-emerald-100/50 rounded-2xl text-emerald-600 shadow-inner group-hover:bg-emerald-500 group-hover:text-white transition-colors duration-500">
                                <CheckCircle className="w-6 h-6 md:w-7 md:h-7" />
                            </div>
                            <div className="flex flex-col">
                                <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-400 group-hover:text-emerald-600 transition-colors">Validées</h3>
                                {isFetching && (
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                        <motion.div 
                                            animate={{ scale: [1, 1.4, 1], opacity: [0.5, 1, 0.5] }} 
                                            transition={{ repeat: Infinity, duration: 2 }}
                                            className="w-1.5 h-1.5 rounded-full bg-emerald-500" 
                                        />
                                        <span className="text-[8px] font-bold text-emerald-500/70 tracking-tighter">SYNC</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="relative">
                            {isLoading ? (
                                <div className="h-12 md:h-20 w-32 md:w-48 bg-slate-100/50 animate-pulse rounded-3xl" />
                            ) : (
                                <AnimatePresence mode="wait">
                                    <motion.span 
                                        key={`stat-validated-${data?.validated || 0}`}
                                        initial={{ opacity: 0, y: 15, filter: "blur(5px)" }}
                                        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                                        exit={{ opacity: 0, y: -15, filter: "blur(5px)" }}
                                        className="text-6xl md:text-8xl font-black text-slate-900 tracking-tighter block"
                                    >
                                        {data?.validated.toLocaleString()}
                                    </motion.span>
                                </AnimatePresence>
                            )}
                            <div className="absolute -bottom-4 -right-6 text-[10px] font-black text-white bg-emerald-600 px-3 py-1 rounded-full shadow-lg shadow-emerald-200 group-hover:scale-110 transition-transform">
                                LIVE
                            </div>
                        </div>
                        
                        <p className="mt-8 text-slate-400 font-bold text-xs uppercase tracking-widest opacity-50">Attestations éligibles</p>
                    </div>
                </motion.div>

                {/* PENDING STATS */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    whileInView={{ opacity: 1, scale: 1, y: 0 }}
                    viewport={{ once: true }}
                    whileHover={{ y: -8, scale: 1.02 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }}
                    className="relative group w-full sm:w-[calc(50%-2rem)] max-w-sm"
                >
                    {/* Background Glow */}
                    <div className="absolute -inset-2 bg-gradient-to-r from-amber-500/20 to-orange-400/20 rounded-[3rem] blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                    
                    <div className="relative flex flex-col items-center p-8 md:p-12 bg-white/80 backdrop-blur-3xl border border-amber-100/50 rounded-[3rem] shadow-2xl shadow-amber-500/5 overflow-hidden">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="p-3 bg-amber-100/50 rounded-2xl text-amber-600 shadow-inner group-hover:bg-amber-500 group-hover:text-white transition-colors duration-500">
                                <Clock className="w-6 h-6 md:w-7 md:h-7" />
                            </div>
                            <div className="flex flex-col">
                                <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-400 group-hover:text-amber-600 transition-colors">En attente</h3>
                                {isFetching && (
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                        <motion.div 
                                            animate={{ scale: [1, 1.4, 1], opacity: [0.5, 1, 0.5] }} 
                                            transition={{ repeat: Infinity, duration: 2, delay: 0.5 }}
                                            className="w-1.5 h-1.5 rounded-full bg-amber-500" 
                                        />
                                        <span className="text-[8px] font-bold text-amber-500/70 tracking-tighter">SYNC</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="relative">
                            {isLoading ? (
                                <div className="h-12 md:h-20 w-32 md:w-48 bg-slate-100/50 animate-pulse rounded-3xl" />
                            ) : (
                                <AnimatePresence mode="wait">
                                    <motion.span 
                                        key={`stat-pending-${data?.pending || 0}`}
                                        initial={{ opacity: 0, y: 15, filter: "blur(5px)" }}
                                        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                                        exit={{ opacity: 0, y: -15, filter: "blur(5px)" }}
                                        className="text-6xl md:text-8xl font-black text-slate-900 tracking-tighter block"
                                    >
                                        {data?.pending.toLocaleString()}
                                    </motion.span>
                                </AnimatePresence>
                            )}
                        </div>
                        
                        <p className="mt-8 text-slate-400 font-bold text-xs uppercase tracking-widest opacity-50">Dossiers en traitement</p>
                    </div>
                </motion.div>
            </div>
            
            {/* Quick Note */}
            <div className="mt-12 flex flex-col items-center gap-3">
                <div className="flex items-center gap-3 text-slate-400 text-[10px] font-black uppercase tracking-[0.3em]">
                    <Zap className="w-4 h-4 text-emerald-500 animate-pulse" />
                    Transparence & Traçabilité FSA
                </div>
                <div className="h-px w-24 bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
            </div>
        </div>
    );
}

