"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle, Mail, Send, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface EmailVerificationBannerProps {
  user: {
    email: string | null;
    emailVerified?: boolean;
  } | null;
}

export function EmailVerificationBanner({ user }: EmailVerificationBannerProps) {
  const [showModal, setShowModal] = useState(false);
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);

  if (!user || user.emailVerified) return null;

  const handleSendOtp = async () => {
    setIsSending(true);
    try {
      const { error } = await authClient.emailOtp.sendVerificationOtp({
        email: user.email!,
        type: "email-verification"
      });

      if (error) throw error;
      
      toast.success("Code de vérification envoyé à " + user.email);
      setShowModal(true);
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de l'envoi du code");
    } finally {
      setIsSending(false);
    }
  };

  const handleVerify = async () => {
    if (otp.length < 6) return toast.error("Le code doit contenir 6 chiffres");
    
    setIsLoading(true);
    try {
      const { error } = await authClient.emailOtp.verifyEmail({
        email: user.email!,
        otp: otp
      });

      if (error) throw error;

      toast.success("Email vérifié avec succès !");
      setShowModal(false);
      // Recharger le profil pour mettre à jour le statut
      window.location.reload();
    } catch (err: any) {
      toast.error(err.message || "Code invalide ou expiré");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="bg-amber-50 border-b border-amber-100 px-4 py-3 sm:px-6 animate-in slide-in-from-top duration-500">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 flex-shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-amber-900">Vérification requise</p>
              <p className="text-xs text-amber-700">Votre adresse email n&apos;est pas encore vérifiée. Certaines fonctionnalités peuvent être limitées.</p>
            </div>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            className="bg-white border-amber-200 text-amber-700 hover:bg-amber-100 hover:text-amber-800 font-semibold h-9 px-4 rounded-xl shadow-sm transition-all active:scale-95"
            onClick={handleSendOtp}
            disabled={isSending}
          >
            {isSending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Mail className="w-4 h-4 mr-2" />}
            Vérifier maintenant
          </Button>
        </div>
      </div>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-md rounded-[2rem] p-8 border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-emerald-500" />
              Vérifier votre email
            </DialogTitle>
            <DialogDescription className="text-slate-500 py-2">
              Saisissez le code de 6 chiffres envoyé à <span className="font-semibold text-slate-700">{user.email}</span>.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 pt-4">
            <div className="flex justify-center">
               <Input
                 type="text"
                 placeholder="000000"
                 maxLength={6}
                 value={otp}
                 onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                 className="text-center text-3xl tracking-[1rem] font-bold h-16 w-full max-w-[240px] rounded-2xl border-slate-200 focus:border-emerald-500 focus:ring-emerald-500 transition-all"
               />
            </div>
            
            <div className="flex flex-col gap-3">
              <Button 
                onClick={handleVerify} 
                disabled={isLoading || otp.length < 6}
                className="h-12 w-full text-base font-bold bg-gradient-to-r from-emerald-500 to-blue-600 hover:from-emerald-600 hover:to-blue-700 shadow-lg shadow-emerald-500/20 rounded-xl"
              >
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Vérifier le code"}
              </Button>
              <Button 
                variant="ghost" 
                onClick={handleSendOtp}
                disabled={isSending}
                className="text-slate-400 hover:text-slate-600"
              >
                {isSending ? "Envoi..." : "Renvoyer le code"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ShieldCheck({ className }: { className?: string }) {
  return (
    <div className={className}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-full h-full"
      >
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    </div>
  );
}
