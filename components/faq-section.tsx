'use client';

import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion"

export function FaqSection() {
    const faqs = [
        {
            question: "Comment passer un examen en ligne ?",
            answer: "Créez votre compte, accédez à votre espace personnel et sélectionnez l'examen disponible. Vous pourrez répondre aux questions directement en ligne et recevoir vos résultats immédiatement après la soumission."
        },
        {
            question: "Comment vérifier l'authenticité d'une attestation ?",
            answer: "Rendez-vous sur la page de vérification et saisissez le code unique présent sur le document. Le système confirmera instantanément sa validité avec les informations associées."
        },
        {
            question: "Combien de temps faut-il pour recevoir mon attestation ?",
            answer: "Une fois votre examen réussi, votre attestation est générée automatiquement et disponible dans votre espace personnel. Elle est vérifiable immédiatement grâce à son code unique."
        },
        {
            question: "Que faire si mon code est indiqué comme invalide ?",
            answer: "Vérifiez que le code est saisi exactement comme il apparaît (majuscules, tirets). Si le problème persiste, contactez l'administration FSA pour qu'on vérifie votre dossier."
        },
        {
            question: "Puis-je partager mon attestation sur les réseaux sociaux ?",
            answer: "Oui ! Vous pouvez partager votre réussite sur LinkedIn, WhatsApp, Facebook ou X en un clic. Nous vous encourageons à mentionner votre code unique dans la section certifications de LinkedIn."
        },
        {
            question: "Le service de vérification est-il gratuit ?",
            answer: "Oui, la vérification d'attestation est entièrement gratuite, publique et ne nécessite aucune inscription. N'importe qui peut vérifier un document à tout moment."
        },
        {
            question: "Mes données personnelles sont-elles protégées ?",
            answer: "Absolument. Seules les informations essentielles (Nom, Prénom, Formation, Date) sont affichées lors d'une vérification. Aucune donnée sensible (email, téléphone, adresse) n'est accessible publiquement."
        }
    ];

    return (
        <div className="w-full max-w-3xl mx-auto my-16 px-4 animate-fade-in-up delay-400">
            <h2 className="text-2xl font-bold text-center text-gray-800 mb-8 font-display">
                Questions Fréquentes
            </h2>
            <div className="bg-white/60 backdrop-blur-sm border border-gray-100 rounded-xl shadow-sm p-6">
                <Accordion type="single" collapsible className="w-full">
                    {faqs.map((faq, index) => (
                        <AccordionItem key={index} value={`item-${index}`}>
                            <AccordionTrigger className="text-left font-semibold text-gray-800">
                                {faq.question}
                            </AccordionTrigger>
                            <AccordionContent className="text-gray-600">
                                {faq.answer}
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>
            </div>
        </div>
    );
}
