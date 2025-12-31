'use client';

import { FileText, Search, ShieldCheck } from 'lucide-react';

export function HowItWorks() {
    const steps = [
        {
            icon: <FileText className="w-8 h-8 text-blue-500" />,
            title: "1. Recevez",
            description: "L'étudiant reçoit son attestation munie d'un code unique sécurisé."
        },
        {
            icon: <Search className="w-8 h-8 text-orange-500" />,
            title: "2. Vérifiez",
            description: "Saisissez le code sur cette plateforme pour lancer la recherche."
        },
        {
            icon: <ShieldCheck className="w-8 h-8 text-green-500" />,
            title: "3. Confirmez",
            description: "Obtenez instantanément le statut officiel de l'attestation."
        }
    ];

    return (
        <div className="w-full max-w-4xl mx-auto my-16 px-4 animate-fade-in-up delay-300">
            <h2 className="text-2xl font-bold text-center text-gray-800 mb-8 font-display">
                Comment ça marche ?
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {steps.map((step, index) => (
                    <div
                        key={index}
                        className="flex flex-col items-center text-center p-6 bg-white/40 backdrop-blur-sm border border-gray-100 rounded-xl hover:bg-white/60 transition-colors"
                    >
                        <div className="p-3 bg-white rounded-full shadow-sm mb-4">
                            {step.icon}
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">{step.title}</h3>
                        <p className="text-gray-600">{step.description}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}
