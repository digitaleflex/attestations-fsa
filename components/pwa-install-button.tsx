'use client';

import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function PwaInstallButton() {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // Enregistrement du Service Worker pour le mode Offline
        if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js').then((reg) => {
                    console.log('[SW] Service Worker enregistré avec succès !', reg.scope);
                }).catch((err) => {
                    console.error('[SW] Échec de l\'enregistrement du Service Worker', err);
                });
            });
        }

        const handler = (e: any) => {
            e.preventDefault();
            setDeferredPrompt(e);
            setIsVisible(true);
        };

        window.addEventListener('beforeinstallprompt', handler);

        return () => {
            window.removeEventListener('beforeinstallprompt', handler);
        };
    }, []);

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            setIsVisible(false);
        }
        setDeferredPrompt(null);
    };

    if (!isVisible) return null;

    return (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-8 md:bottom-8 z-50 animate-in slide-in-from-bottom duration-300">
            <div className="bg-white/95 backdrop-blur shadow-2xl rounded-2xl p-4 border border-green-100 flex items-center justify-between gap-4 max-w-sm ml-auto">
                <div className="flex items-center gap-3">
                    <div className="bg-green-100 p-2 rounded-xl text-green-700">
                        <Download className="w-5 h-5" />
                    </div>
                    <div className="text-sm">
                        <p className="font-bold text-gray-900">Installer l'application</p>
                        <p className="text-gray-500 text-xs">Accès rapide sans téléchargement</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button size="sm" onClick={handleInstallClick} className="bg-green-600 hover:bg-green-700 text-white rounded-lg">
                        Installer
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => setIsVisible(false)} className="h-8 w-8 text-gray-400 hover:text-gray-600">
                        <X className="w-4 h-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
}
