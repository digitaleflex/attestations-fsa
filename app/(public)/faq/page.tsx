import type { Metadata } from "next";
import React from "react";
import { HelpCircle, Sparkles, ArrowRight, MessageCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Questions fréquentes",
  description: "Réponses sur les examens, les attestations et leur vérification en ligne.",
};

const faqs = [
  {
    question: "Comment passer un examen en ligne ?",
    answer: "Créez votre compte, accédez à votre espace personnel et sélectionnez l'examen disponible. Vous pourrez répondre aux questions directement en ligne et recevoir vos résultats immédiatement après la soumission.",
  },
  {
    question: "Comment vérifier l'authenticité d'une attestation ?",
    answer: "Rendez-vous sur la page de vérification et saisissez le code unique présent sur le document. Le système confirmera instantanément sa validité avec les informations associées.",
  },
  {
    question: "Combien de temps faut-il pour recevoir mon attestation ?",
    answer: "Une fois votre examen réussi, votre attestation est générée automatiquement et disponible dans votre espace personnel. Elle est vérifiable immédiatement grâce à son code unique.",
  },
  {
    question: "Que faire si mon code est indiqué comme invalide ?",
    answer: "Vérifiez que le code est saisi exactement comme il apparaît (majuscules, tirets). Si le problème persiste, contactez l'administration FSA pour qu'on vérifie votre dossier.",
  },
  {
    question: "Puis-je partager mon attestation sur les réseaux sociaux ?",
    answer: "Oui ! Vous pouvez partager votre réussite sur LinkedIn, WhatsApp, Facebook ou X en un clic.",
  },
  {
    question: "Le service de vérification est-il gratuit ?",
    answer: "Oui, la vérification d'attestation est entièrement gratuite, publique et ne nécessite aucune inscription.",
  },
  {
    question: "Mes données personnelles sont-elles protégées ?",
    answer: "Absolument. Seules les informations essentielles (Nom, Prénom, Formation, Date) sont affichées lors d'une vérification. Aucune donnée sensible (email, téléphone, adresse) n'est accessible publiquement.",
  },
  {
    question: "Quels types de certifications puis-je obtenir ?",
    answer: "La FSA propose des certifications en pisciculture, élevage, agriculture et agro-pisciculture. Chaque certification est unique et vérifiable en ligne.",
  },
  {
    question: "Qui peut vérifier une attestation ?",
    answer: "Tout le monde ! Le service est public, gratuit et sans inscription. Employeurs, recruteurs ou particuliers peuvent vérifier un document à tout moment.",
  },
];

export default function FAQPage() {
  return (
    <div className="min-h-screen bg-[#fafbfc] selection:bg-amber-100 selection:text-amber-900 pb-24 overflow-x-hidden">
      {/* Decorative Glows */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[60vw] h-[60vw] bg-amber-100/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] bg-blue-100/10 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-6 pt-24 md:pt-36">
        <div className="flex flex-col items-center text-center space-y-8 mb-20">
          <Badge className="bg-amber-50 text-amber-700 border-amber-100 px-4 py-1.5 rounded-full text-[10px] font-black tracking-[0.25em] uppercase shadow-sm">
             <Sparkles className="w-3.5 h-3.5 mr-2 fill-amber-500" />
             Aide & Support
          </Badge>
          
          <div className="space-y-4">
            <h1 className="text-5xl md:text-7xl font-[900] text-slate-900 tracking-tight leading-[0.95]">
               Des questions ? <br />
               On a les <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-600 to-orange-600">réponses.</span>
            </h1>
            <p className="text-lg md:text-xl text-slate-500 font-medium max-w-2xl mx-auto leading-relaxed">
              Tout ce que vous devez savoir sur la plateforme FSA, les examens et la vérification des attestations.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {faqs.map((faq, i) => (
            <div 
              key={i} 
              className="group p-8 md:p-10 rounded-[2.5rem] bg-white border border-slate-50 shadow-[0_20px_50px_rgba(0,0,0,0.03)] hover:shadow-[0_40px_80px_rgba(0,0,0,0.08)] transition-all duration-500"
            >
              <div className="flex gap-6">
                <div className="w-12 h-12 shrink-0 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-110 group-hover:bg-amber-600 group-hover:text-white transition-all duration-500">
                    <HelpCircle className="w-6 h-6" />
                </div>
                <div className="space-y-4">
                  <h3 className="text-xl md:text-2xl font-[900] text-slate-900 group-hover:text-amber-700 transition-colors">
                    {faq.question}
                  </h3>
                  <p className="text-slate-500 font-medium text-base md:text-lg leading-relaxed">
                    {faq.answer}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* CTA Support */}
        <div className="mt-24 p-10 md:p-16 rounded-[3rem] bg-slate-900 text-white relative overflow-hidden shadow-2xl">
           <div className="absolute top-0 right-0 w-1/3 h-full bg-amber-500/10 skew-x-12 transform translate-x-1/2" />
           <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-12">
              <div className="space-y-6 max-w-xl text-center md:text-left">
                <h2 className="text-3xl md:text-4xl font-black tracking-tight leading-tight">Vous ne trouvez pas votre réponse ?</h2>
                <p className="text-slate-400 font-medium text-lg leading-relaxed">
                  Notre équipe de conseillers techniques est disponible pour vous accompagner dans vos démarches.
                </p>
                <div className="flex flex-wrap justify-center md:justify-start gap-4">
                  <Link href="/contact">
                    <Button className="h-16 px-10 rounded-2xl bg-amber-600 hover:bg-amber-500 text-white font-black group shadow-xl shadow-amber-900/20">
                      Contacter le support
                      <ArrowRight className="w-5 h-5 ml-2 transition-transform group-hover:translate-x-1" />
                    </Button>
                  </Link>
                </div>
              </div>
              <div className="w-48 h-48 bg-white/5 rounded-[2rem] border border-white/10 flex items-center justify-center rotate-3 relative overflow-hidden">
                  <MessageCircle className="w-20 h-20 text-amber-500/20" />
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
