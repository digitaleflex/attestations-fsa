"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Loader2, Trash2, RefreshCw, Shield, Mail, Clock, Key, Copy, Check } from "lucide-react";
import { toast } from "sonner";

type OTPLog = {
  id: string;
  email: string;
  otp: string;
  type: "forget-password" | "email-verification" | "sign-in";
  sentAt: Date;
  delivered: boolean;
};

export default function OTPLogsPage() {
  const [logs, setLogs] = useState<OTPLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/otp-logs");
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      } else if (res.status === 401) {
        toast.error("Non autorisé");
      } else {
        toast.error("Erreur lors du chargement");
      }
    } catch (err) {
      toast.error("Erreur réseau");
    } finally {
      setLoading(false);
    }
  };

  const handleClear = async () => {
    setClearing(true);
    try {
      const res = await fetch("/api/admin/otp-logs", { method: "DELETE" });
      if (res.ok) {
        setLogs([]);
        toast.success("Logs effacés");
      } else {
        toast.error("Erreur lors de l'effacement");
      }
    } catch (err) {
      toast.error("Erreur réseau");
    } finally {
      setClearing(false);
    }
  };

  const copyOTP = (otp: string) => {
    navigator.clipboard.writeText(otp);
    toast.success("Code copié !");
  };

  useEffect(() => {
    fetchLogs();
    // Auto-refresh every 10 seconds
    const interval = setInterval(fetchLogs, 10000);
    return () => clearInterval(interval);
  }, []);

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "forget-password":
        return <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-200">🔑 Réinitialisation</Badge>;
      case "email-verification":
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800 border-blue-200">📧 Vérification email</Badge>;
      case "sign-in":
        return <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200">🔐 Connexion</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  const formatTime = (date: Date) => {
    const d = new Date(date);
    return d.toLocaleString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const getTimeAgo = (date: Date) => {
    const now = new Date();
    const sent = new Date(date);
    const diff = Math.floor((now.getTime() - sent.getTime()) / 1000);

    if (diff < 60) return `Il y a ${diff}s`;
    if (diff < 3600) return `Il y a ${Math.floor(diff / 60)}min`;
    if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)}h`;
    return `Il y a ${Math.floor(diff / 86400)}j`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-blue-50 to-indigo-50 p-4 sm:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Codes de vérification OTP</h1>
              <p className="text-sm text-slate-500">
                {logs.length} code{logs.length !== 1 ? "s" : ""} envoyé{logs.length !== 1 ? "s" : ""} • Rafraîchissement auto (10s)
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={fetchLogs}
              disabled={loading}
              className="h-10"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Rafraîchir
            </Button>
            <Button
              variant="destructive"
              onClick={handleClear}
              disabled={clearing || logs.length === 0}
              className="h-10"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Tout effacer
            </Button>
          </div>
        </div>

        {/* Alert */}
        <Alert className="bg-amber-50 border-amber-200 rounded-xl">
          <Shield className="h-4 w-4 !mt-0.5 text-amber-600" />
          <AlertTitle className="text-amber-800">🔒 Données sensibles</AlertTitle>
          <AlertDescription className="text-amber-700">
            Ces codes sont temporaires et stockés uniquement en mémoire. Ils seront perdus au redémarrage du serveur.
            Ne partagez jamais ces codes avec des utilisateurs.
          </AlertDescription>
        </Alert>

        {/* Loading */}
        {loading && logs.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
          </div>
        ) : logs.length === 0 ? (
          <Card className="bg-white rounded-2xl shadow-lg p-12 text-center">
            <Key className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-600 mb-2">Aucun code OTP envoyé</h3>
            <p className="text-sm text-gray-400">
              Les codes de vérification apparaîtront ici lorsqu'un utilisateur demande une réinitialisation de mot de passe.
            </p>
          </Card>
        ) : (
          <div className="grid gap-4">
            {logs.map((log) => (
              <Card
                key={log.id}
                className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow border border-gray-100 overflow-hidden"
              >
                <div className="p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    
                    {/* Left: Email + Type */}
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Mail className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-slate-900 truncate">
                            {log.email}
                          </p>
                          {getTypeBadge(log.type)}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {getTimeAgo(log.sentAt)}
                          </span>
                          <span className="hidden sm:inline">•</span>
                          <span className="hidden sm:inline">{formatTime(log.sentAt)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Right: OTP Code + Copy */}
                    <div className="flex items-center gap-3 sm:flex-shrink-0">
                      <div className="bg-gradient-to-br from-emerald-50 to-green-100 border-2 border-emerald-200 rounded-xl px-4 py-3 text-center">
                        <p className="text-xs font-medium text-emerald-700 mb-1">Code OTP</p>
                        <p className="text-2xl font-mono font-black text-emerald-700 tracking-widest">
                          {log.otp}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          copyOTP(log.otp);
                          setCopiedId(log.id);
                          setTimeout(() => setCopiedId(null), 2000);
                        }}
                        className="h-12 w-12 flex-shrink-0"
                      >
                        {copiedId === log.id ? (
                          <Check className="w-5 h-5 text-emerald-600" />
                        ) : (
                          <Copy className="w-5 h-5 text-gray-500" />
                        )}
                      </Button>
                    </div>

                  </div>
                </div>

                {/* Progress bar showing remaining time */}
                {(() => {
                  const sentTime = new Date(log.sentAt).getTime();
                  const expiryTime = sentTime + 10 * 60 * 1000; // 10 minutes
                  const now = Date.now();
                  const remaining = Math.max(0, (expiryTime - now) / (10 * 60 * 1000));
                  const isExpired = remaining <= 0;

                  return (
                    <div className="h-1 w-full bg-gray-100">
                      <div
                        className={`h-full transition-all duration-1000 ${
                          isExpired ? "bg-red-400" : remaining < 0.5 ? "bg-amber-400" : "bg-emerald-500"
                        }`}
                        style={{ width: `${remaining * 100}%` }}
                      />
                    </div>
                  );
                })()}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
