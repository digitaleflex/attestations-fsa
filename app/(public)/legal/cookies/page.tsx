import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Politique de Cookies – Ferme St André",
  description: "Politique de cookies de la plateforme Ferme St André.",
};

export default function CookiesPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <div className="mb-10">
        <Link href="/" className="text-sm font-bold text-emerald-600 hover:text-emerald-700 transition-colors inline-flex items-center gap-1">
          ← Retour à l'accueil
        </Link>
      </div>

      <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-2">
        Politique de Cookies
      </h1>
      <p className="text-sm text-slate-500 mb-12">
        Dernière mise à jour : avril 2026
      </p>

      <div className="space-y-10 text-slate-700 leading-relaxed">
        {/* 1 */}
        <section>
          <h2 className="text-xl font-bold text-slate-900 mb-3">1. Qu'est-ce qu'un cookie ?</h2>
          <p>
            Un cookie est un petit fichier texte déposé sur votre appareil (ordinateur, tablette,
            smartphone) lors de votre visite d'un site web. Il permet au site de conserver des
            informations relatives à votre navigation et de faciliter votre expérience utilisateur.
          </p>
        </section>

        {/* 2 */}
        <section>
          <h2 className="text-xl font-bold text-slate-900 mb-3">2. Cookies que nous utilisons</h2>

          <h3 className="font-bold text-slate-800 mt-4 mb-2">2.1 Cookies essentiels (strictement nécessaires)</h3>
          <p>Ces cookies sont indispensables au bon fonctionnement de la Plateforme :</p>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50">
                  <th className="text-left p-3 border border-slate-200 font-bold">Nom</th>
                  <th className="text-left p-3 border border-slate-200 font-bold">Finalité</th>
                  <th className="text-left p-3 border border-slate-200 font-bold">Durée</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="p-3 border border-slate-200 font-mono text-xs">session token</td>
                  <td className="p-3 border border-slate-200">Maintenir votre session de connexion</td>
                  <td className="p-3 border border-slate-200">Durée de la session</td>
                </tr>
                <tr className="bg-slate-50">
                  <td className="p-3 border border-slate-200 font-mono text-xs">auth cookie</td>
                  <td className="p-3 border border-slate-200">Authentification sécurisée</td>
                  <td className="p-3 border border-slate-200">30 jours</td>
                </tr>
                <tr>
                  <td className="p-3 border border-slate-200 font-mono text-xs">csrf token</td>
                  <td className="p-3 border border-slate-200">Protection contre les attaques CSRF</td>
                  <td className="p-3 border border-slate-200">Durée de la session</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-sm text-slate-500 italic">
            Ces cookies ne nécessitent pas votre consentement car ils sont strictement nécessaires
            au fonctionnement du service.
          </p>

          <h3 className="font-bold text-slate-800 mt-6 mb-2">2.2 Cookies de préférences</h3>
          <p>
            Ces cookies mémorisent vos choix (langue, thème d'affichage) pour améliorer votre
            expérience lors de vos prochaines visites.
          </p>

          <h3 className="font-bold text-slate-800 mt-4 mb-2">2.3 Cookies d'analyse et de performance</h3>
          <p>
            Ces cookies nous permettent de mesurer l'audience du site, d'analyser les parcours
            utilisateurs et d'identifier les axes d'amélioration.
          </p>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50">
                  <th className="text-left p-3 border border-slate-200 font-bold">Service</th>
                  <th className="text-left p-3 border border-slate-200 font-bold">Finalité</th>
                  <th className="text-left p-3 border border-slate-200 font-bold">Durée</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="p-3 border border-slate-200 font-mono text-xs">[Analytics]</td>
                  <td className="p-3 border border-slate-200">Statistiques de fréquentation</td>
                  <td className="p-3 border border-slate-200">13 mois</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* 3 */}
        <section>
          <h2 className="text-xl font-bold text-slate-900 mb-3">3. Gestion des cookies</h2>
          <h3 className="font-bold text-slate-800 mt-4 mb-2">3.1 Via votre navigateur</h3>
          <p>
            Vous pouvez à tout moment configurer votre navigateur pour accepter ou refuser les cookies.
            Voici les paramètres pour les navigateurs les plus courants :
          </p>
          <ul className="space-y-1 ml-6 list-disc mt-2">
            <li><strong>Chrome</strong> : Paramètres → Confidentialité et sécurité → Cookies</li>
            <li><strong>Firefox</strong> : Préférences → Vie privée et sécurité</li>
            <li><strong>Safari</strong> : Préférences → Confidentialité</li>
            <li><strong>Edge</strong> : Paramètres → Cookies et autorisations de site</li>
          </ul>

          <h3 className="font-bold text-slate-800 mt-4 mb-2">3.2 Conséquences du refus</h3>
          <p>
            Le refus des cookies essentiels peut empêcher le bon fonctionnement de la Plateforme,
            notamment l'accès à votre espace personnel et le passage d'examens.
          </p>
        </section>

        {/* 4 */}
        <section>
          <h2 className="text-xl font-bold text-slate-900 mb-3">4. Cookies tiers</h2>
          <p>
            Certains cookies peuvent être déposés par des services tiers intégrés à notre
            Plateforme (services d'analyse, réseaux sociaux). Nous n'avons aucun contrôle sur
            l'utilisation de ces cookies par ces tiers. Nous vous invitons à consulter leurs
            politiques de confidentialité respectives.
          </p>
        </section>

        {/* 5 */}
        <section>
          <h2 className="text-xl font-bold text-slate-900 mb-3">5. Durée de conservation</h2>
          <p>
            Les cookies déposés sur votre appareil sont conservés pour une durée maximale de
            <strong> 13 mois</strong> à compter de leur dépôt. Votre consentement est recueilli
            pour cette même durée.
          </p>
        </section>

        {/* 6 */}
        <section>
          <h2 className="text-xl font-bold text-slate-900 mb-3">6. Mise à jour</h2>
          <p>
            Cette politique de cookies peut être modifiée à tout moment. Nous vous invitons �
            la consulter régulièrement.
          </p>
        </section>

        {/* 7 */}
        <section>
          <h2 className="text-xl font-bold text-slate-900 mb-3">7. Contact</h2>
          <p>
            Pour toute question relative à notre utilisation des cookies :
          </p>
          <div className="mt-4 p-6 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
            <p><strong>Ferme Agro-piscicole Saint André</strong></p>
            <p>Cotonou, Bénin</p>
            <p>Téléphone : +229 01 91 07 60 93</p>
          </div>
        </section>
      </div>
    </div>
  );
}
