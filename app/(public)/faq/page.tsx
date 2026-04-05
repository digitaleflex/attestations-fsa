"use client";

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
