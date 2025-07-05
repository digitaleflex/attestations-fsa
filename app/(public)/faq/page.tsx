"use client";

const faqs = [
  {
    question: "Comment vérifier une attestation ?",
    answer: "Saisissez le code unique de l’attestation sur la page de vérification ou scannez le QR code présent sur le document. Vous obtiendrez instantanément le statut et les informations publiques de l’attestation.",
  },
  {
    question: "Quels types d’attestations puis-je vérifier ?",
    answer: "Toutes les attestations délivrées par la Ferme St André : formations, stages, certifications professionnelles, etc.",
  },
  {
    question: "Mes données sont-elles protégées ?",
    answer: "Oui, aucune donnée sensible n’est collectée lors de la vérification. Seules les informations publiques de l’attestation sont affichées.",
  },
  {
    question: "Puis-je partager mon attestation sur les réseaux sociaux ?",
    answer: "Oui, après vérification, vous pouvez partager votre attestation sur WhatsApp, LinkedIn, Facebook ou X/Twitter en un clic.",
  },
  {
    question: "Que faire si une attestation semble frauduleuse ?",
    answer: "Utilisez le formulaire de signalement pour nous alerter. Notre équipe analysera votre demande dans les plus brefs délais.",
  },
  {
    question: "Comment obtenir un badge ou un certificat personnalisé ?",
    answer: "Après vérification, vous pouvez télécharger un badge ou certificat à votre nom (fonctionnalité à venir).",
  },
  {
    question: "Qui peut vérifier une attestation ?",
    answer: "Tout le monde ! Le service est public, gratuit et sans inscription.",
  },
];

export default function FAQPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-gray-100 p-4">
      <div className="w-full max-w-2xl mx-auto bg-white/80 backdrop-blur-md border border-blue-200 rounded-2xl shadow-xl p-8 animate-fade-in-up">
        <h1 className="text-3xl font-bold text-blue-700 mb-6 text-center">FAQ – Questions fréquentes</h1>
        <div className="flex flex-col gap-6">
          {faqs.map((faq, i) => (
            <div key={i} className="rounded-xl border border-blue-100 bg-blue-50/60 p-5">
              <div className="font-semibold text-blue-900 mb-2 text-lg">{faq.question}</div>
              <div className="text-gray-700 text-base">{faq.answer}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
} 