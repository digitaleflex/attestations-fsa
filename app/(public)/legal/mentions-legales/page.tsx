import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Mentions Légales – Ferme St André",
  description: "Mentions légales de la plateforme Ferme St André.",
};

export default function MentionsLegalesPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <div className="mb-10">
        <Link href="/" className="text-sm font-bold text-emerald-600 hover:text-emerald-700 transition-colors inline-flex items-center gap-1">
          ← Retour à l'accueil
        </Link>
      </div>

      <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-2">
        Mentions Légales
      </h1>
      <p className="text-sm text-slate-500 mb-12">
        Dernière mise à jour : avril 2026
      </p>

      <div className="space-y-10 text-slate-700 leading-relaxed">
        {/* 1 */}
        <section>
          <h2 className="text-xl font-bold text-slate-900 mb-3">1. Éditeur du site</h2>
          <div className="mt-4 p-6 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
            <p><strong>Raison sociale :</strong> Ferme Agro-piscicole Saint André</p>
            <p><strong>Forme juridique :</strong> <em>[à préciser]</em></p>
            <p><strong>Siège social :</strong> Abomey-Calavi, Bénin</p>
            <p><strong>Téléphone :</strong> +229 01 91 07 60 93</p>
            <p><strong>Directeur de publication :</strong> <em>[à préciser]</em></p>
          </div>
        </section>

        {/* 2 */}
        <section>
          <h2 className="text-xl font-bold text-slate-900 mb-3">2. Hébergement</h2>
          <div className="mt-4 p-6 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
            <p><strong>Hébergeur :</strong> <em>[Nom de l'hébergeur]</em></p>
            <p><strong>Siège social :</strong> <em>[Adresse de l'hébergeur]</em></p>
            <p><strong>Site web :</strong> <em>[URL de l'hébergeur]</em></p>
          </div>
        </section>

        {/* 3 */}
        <section>
          <h2 className="text-xl font-bold text-slate-900 mb-3">3. Propriété intellectuelle</h2>
          <p>
            L'ensemble des éléments constitutifs du site — y compris mais sans s'y limiter :
            textes, images, graphismes, logo, icônes, sons, vidéos, logiciels, base de données,
            arborescence, code source — sont la propriété exclusive de la Ferme Agro-piscicole
            Saint André ou de ses partenaires.
          </p>
          <p className="mt-2">
            Toute reproduction, représentation, modification, adaptation, traduction ou exploitation,
            même partielle, est strictement interdite sans autorisation écrite et préalable de la FSA.
          </p>
          <p className="mt-2">
            Les marques et logos présents sur le site sont des marques déposées. Toute utilisation
            non autorisée est susceptible de constituer une contrefaçon.
          </p>
        </section>

        {/* 4 */}
        <section>
          <h2 className="text-xl font-bold text-slate-900 mb-3">4. Données personnelles</h2>
          <p>
            La collecte et le traitement des données personnelles sont régis par notre
            <Link href="/legal/confidentialite" className="text-emerald-600 underline hover:text-emerald-700 mx-1">
              Politique de Confidentialité
            </Link>.
          </p>
        </section>

        {/* 5 */}
        <section>
          <h2 className="text-xl font-bold text-slate-900 mb-3">5. Cookies</h2>
          <p>
            Le site utilise des cookies pour assurer son fonctionnement et améliorer l'expérience
            utilisateur. Pour plus d'informations, consultez notre
            <Link href="/legal/cookies" className="text-emerald-600 underline hover:text-emerald-700 mx-1">
              Politique de cookies
            </Link>.
          </p>
        </section>

        {/* 6 */}
        <section>
          <h2 className="text-xl font-bold text-slate-900 mb-3">6. Responsabilité</h2>
          <p>
            La FSA s'efforce d'assurer l'exactitude et la mise à jour des informations diffusées
            sur le site. Toutefois, la FSA ne saurait être tenue responsable des erreurs ou
            omissions, ni des dommages directs ou indirects résultant de l'utilisation du site.
          </p>
        </section>

        {/* 7 */}
        <section>
          <h2 className="text-xl font-bold text-slate-900 mb-3">7. Liens hypertextes</h2>
          <p>
            Le site peut contenir des liens vers des sites tiers. La FSA n'exerce aucun contrôle
            sur ces sites et décline toute responsabilité quant à leur contenu, leur politique de
            confidentialité ou leurs pratiques.
          </p>
        </section>

        {/* 8 */}
        <section>
          <h2 className="text-xl font-bold text-slate-900 mb-3">8. Droit applicable</h2>
          <p>
            Les présentes mentions légales sont soumises au droit en vigueur au <strong>Bénin</strong>.
          </p>
        </section>
      </div>
    </div>
  );
}
