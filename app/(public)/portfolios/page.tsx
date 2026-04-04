"use client";

import React, { useEffect, useState } from "react";
import {
  Users,
  Search,
  MapPin,
  ExternalLink,
  ArrowRight,
  UserCheck,
  Globe,
  Award,
  Sparkles,
  ArrowLeft,
  Loader2,
  GraduationCap,
  Briefcase,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { toast } from "sonner";

type PortfolioUser = {
  id: string;
  name: string | null;
  email: string | null;
  portfolioSlug: string | null;
  portfolioUrl: string;
  birthPlace: string | null;
  phone: string | null;
  attestationCount: number;
  examCount: number;
};

export default function PortfoliosListPage() {
  const [isWaitlistOpen, setIsWaitlistOpen] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [portfolios, setPortfolios] = useState<PortfolioUser[]>([]);
  const [loadingPortfolios, setLoadingPortfolios] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch portfolios
  const fetchPortfolios = async () => {
    try {
      setLoadingPortfolios(true);
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      params.set("limit", "20");

      const res = await fetch(`/api/public/portfolios?${params}`);
      if (!res.ok) throw new Error("Erreur");
      const data = await res.json();
      setPortfolios(data.portfolios || []);
    } catch (err) {
      console.error(err);
      toast.error("Impossible de charger les portfolios");
    } finally {
      setLoadingPortfolios(false);
    }
  };

  useEffect(() => {
    fetchPortfolios();
  }, [debouncedSearch]);

  const handleJoinWaitlist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Erreur");
      }

      toast.success("Bienvenue sur la liste d'attente !", {
        description: "Vérifiez votre email pour la confirmation."
      });
      setIsWaitlistOpen(false);
      setEmail("");
    } catch (err: any) {
      toast.error("Erreur", {
        description: err.message || "Impossible de rejoindre la liste. Réessayez plus tard."
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 text-slate-900">
      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-600 text-[10px] font-black uppercase tracking-widest mb-4">
            <Sparkles className="w-3 h-3" /> Annuaire des Talents FSA
          </div>
          <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-4">
            Portfolios <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-emerald-600">Publics</span>
          </h1>
          <p className="text-lg text-slate-500 max-w-2xl mx-auto">
            Découvrez les portfolios numériques certifiés de nos diplômés et candidats.
          </p>
        </div>

        {/* Search & Actions */}
        <div className="flex flex-col md:flex-row items-center justify-center gap-4 mb-12">
          <div className="relative flex-1 max-w-lg">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <Input
              placeholder="Rechercher un candidat..."
              className="pl-12 h-12 rounded-xl"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button onClick={() => setIsWaitlistOpen(true)} className="h-12 px-6 rounded-xl">
            Rejoindre la Liste d'Attente
          </Button>
        </div>

        {/* Results Count */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-slate-500">
            {loadingPortfolios ? "Chargement..." : `${portfolios.length} portfolio(s) trouvé(s)`}
          </p>
        </div>

        {/* Portfolio Grid */}
        {loadingPortfolios ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : portfolios.length === 0 ? (
          <Card className="p-12 text-center">
            <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">Aucun portfolio trouvé</p>
            <Button variant="link" onClick={() => setIsWaitlistOpen(true)} className="mt-2">
              Soyez le premier à créer votre portfolio
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {portfolios.map((p) => (
              <Card key={p.id} className="p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center text-white font-bold text-xl">
                    {p.name?.charAt(0) || "U"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-slate-800 truncate">{p.name || "Utilisateur"}</h3>
                    <p className="text-sm text-slate-500">{p.portfolioUrl}</p>
                    <div className="flex items-center gap-4 mt-3 text-sm text-slate-600">
                      <span className="flex items-center gap-1">
                        <Award className="w-4 h-4" />
                        {p.attestationCount} attestations
                      </span>
                      <span className="flex items-center gap-1">
                        <GraduationCap className="w-4 h-4" />
                        {p.examCount} examens
                      </span>
                    </div>
                    <Link href={p.portfolioUrl} className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:underline">
                      Voir le portfolio <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Waitlist Modal */}
        <Dialog open={isWaitlistOpen} onOpenChange={setIsWaitlistOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-2">
                <Sparkles className="w-6 h-6" />
              </div>
              <DialogTitle className="text-center">Rejoindre la liste d'attente</DialogTitle>
              <DialogDescription className="text-center">
                Soyez notifié quand les portfolios seront disponibles.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleJoinWaitlist} className="space-y-4">
              <Input
                required
                type="email"
                placeholder="votre@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 rounded-xl"
              />
              <Button disabled={loading} type="submit" className="w-full h-12 rounded-xl">
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "S'inscrire"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        {/* Footer */}
        <footer className="py-12 text-center border-t mt-12">
          <p className="text-slate-400 text-sm">
            © 2026 Ferme Agro-Piscicole Cité St André. Plateforme Technologique d'Excellence.
          </p>
        </footer>
      </div>
    </div>
  );
}
