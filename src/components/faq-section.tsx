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
            question: "Comment vérifier l'authenticité d'une attestation ?",
            answer: "Il vous suffit de saisir le code unique présent sur l'attestation dans la barre de recherche ci-dessus, ou de scanner le QR code si vous utilisez un appareil mobile. Le système confirmera instantanément si le document est valide."
        },
        {
            question: "Que faire si mon code est indiqué comme 'Invalide' ?",
            answer: "Vérifiez d'abord que vous avez saisi le code exactement comme il apparaît (majuscules, tirets). Si le problème persiste, contactez l'administration de la FSA pour vérifier qu'il n'y a pas eu d'erreur lors de l'émission."
        },
        {
            question: "Puis-je partager mon attestation sur LinkedIn ?",
            answer: "Absolument ! Nous vous encourageons à partager votre réussite. Vous pouvez mentionner votre code unique dans la section 'Licences et certifications' de votre profil LinkedIn pour que les recruteurs puissent le vérifier facilement."
        },
        {
            question: "Les données des étudiants sont-elles publiques ?",
            answer: "Non. Seules les informations essentielles à la vérification (Nom, Prénom, Formation, Date) sont affichées lorsqu'un code valide est saisi. Aucune donnée sensible (email, téléphone, adresse) n'est accessible publiquement."
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
