import type { Metadata } from "next";
import Link from "next/link";

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: "Conditions de Délivrance des Attestations – Ferme St André",
  description: "Conditions d'obtention et de vérification des attestations de certification FSA.",
};

export default function AttestationsPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <div className="mb-10">
        <Link href="/" className="text-sm font-bold text-emerald-600 hover:text-emerald-700 transition-colors inline-flex items-center gap-1">
          ← Retour à l'accueil
        </Link>
      </div>

      <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-2">
        Conditions de Délivrance des Attestations
      </h1>
      <p className="text-sm text-slate-500 mb-12">
        Dernière mise à jour : avril 2026
      </p>

      <div className="space-y-10 text-slate-700 leading-relaxed">
        {/* 1 */}
        <section>
          <h2 className="text-xl font-bold text-slate-900 mb-3">1. Objet</h2>
          <p>
            Les présentes conditions définissent les règles d'obtention, de délivrance, de
            vérification et d'utilisation des attestations de certification délivrées par la
            <strong> Ferme Agro-piscicole Saint André</strong> (ci-après « FSA »).
          </p>
        </section>

        {/* 2 */}
        <section>
          <h2 className="text-xl font-bold text-slate-900 mb-3">2. Nature des attestations</h2>
          <p>
            Les attestations délivrées par la FSA sont des documents numériques certifiant qu'un
            Utilisateur a réussi avec succès un examen dans l'un des domaines suivants :
          </p>
          <ul className="space-y-1 ml-6 list-disc mt-2">
            <li><strong>Pisciculture</strong> : techniques de production piscicole, gestion des étangs, alimentation</li>
            <li><strong>Agriculture</strong> : techniques culturales, agriculture durable, gestion des sols</li>
            <li><strong>Élevage</strong> : production animale, santé animale, nutrition</li>
            <li><strong>Agro-pisciculture</strong> : approche intégrée agriculture-pisciculture-élevage</li>
          </ul>
        </section>

        {/* 3 */}
        <section>
          <h2 className="text-xl font-bold text-slate-900 mb-3">3. Conditions d'obtention</h2>
          <p>Pour obtenir une attestation, le candidat doit :</p>
          <ul className="space-y-1 ml-6 list-disc mt-2">
            <li>Être inscrit sur la Plateforme avec un compte valide</li>
            <li>Être éligible à l'examen concerné (prérequis, formations suivies)</li>
            <li>Passer l'intégralité de l'examen dans les conditions définies</li>
            <li>Obtenir un score égal ou supérieur au seuil de réussite fixé</li>
            <li>Avoir respecté les règles d'intégrité pendant l'examen</li>
          </ul>
          <p className="mt-2">
            Le seuil de réussite est défini par la FSA pour chaque examen et est communiqué
            au candidat avant le début de l'épreuve.
          </p>
        </section>

        {/* 4 */}
        <section>
          <h2 className="text-xl font-bold text-slate-900 mb-3">4. Délivrance</h2>
          <h3 className="font-bold text-slate-800 mt-4 mb-2">4.1 Délai</h3>
          <p>
            L'attestation est générée <strong>automatiquement et instantanément</strong> après
            la réussite de l'examen. Elle est disponible dans l'espace personnel du candidat.
          </p>

          <h3 className="font-bold text-slate-800 mt-4 mb-2">4.2 Contenu</h3>
          <p>Chaque attestation contient les informations suivantes :</p>
          <ul className="space-y-1 ml-6 list-disc mt-2">
            <li>Nom et prénom du titulaire</li>
            <li>Intitulé de la certification obtenue</li>
            <li>Date d'obtention</li>
            <li><strong>Code unique de vérification</strong> (alphanumérique)</li>
            <li>QR code de vérification</li>
            <li>Mention de l'autorité délivrante (FSA)</li>
          </ul>

          <h3 className="font-bold text-slate-800 mt-4 mb-2">4.3 Format</h3>
          <p>
            L'attestation est délivrée au format numérique (PDF téléchargeable). Elle peut
            également être imprimée par le titulaire.
          </p>
        </section>

        {/* 5 */}
        <section>
          <h2 className="text-xl font-bold text-slate-900 mb-3">5. Vérification</h2>
          <h3 className="font-bold text-slate-800 mt-4 mb-2">5.1 Accessibilité publique</h3>
          <p>
            Toute personne peut vérifier l'authenticité d'une attestation en saisissant le
            code unique de vérification sur la page{" "}
            <Link href="/verifier" className="text-emerald-600 underline hover:text-emerald-700">
              Vérifier un certificat
            </Link>.
          </p>

          <h3 className="font-bold text-slate-800 mt-4 mb-2">5.2 Informations affichées</h3>
          <p>
            Lors de la vérification, seules les informations suivantes sont rendues publiques :
          </p>
          <ul className="space-y-1 ml-6 list-disc mt-2">
            <li>Nom du titulaire</li>
            <li>Prénom du titulaire</li>
            <li>Formation / certification obtenue</li>
            <li>Date d'obtention</li>
            <li>Statut de validité (valide / invalide)</li>
          </ul>
          <p className="mt-2">
            <strong>Aucune donnée sensible</strong> (email, téléphone, adresse, résultats détaillés)
            n'est affichée publiquement.
          </p>

          <h3 className="font-bold text-slate-800 mt-4 mb-2">5.3 Gratuité</h3>
          <p>
            Le service de vérification est <strong>entièrement gratuit</strong> et ne nécessite
            aucune inscription.
          </p>
        </section>

        {/* 6 */}
        <section>
          <h2 className="text-xl font-bold text-slate-900 mb-3">6. Validité</h2>
          <p>
            Les attestations sont délivrées <strong>sans limite de durée</strong>. Elles constituent
            une preuve de certification permanente et restent vérifiables indéfiniment.
          </p>
          <p className="mt-2">
            La FSA se réserve le droit de révoquer une attestation en cas de :
          </p>
          <ul className="space-y-1 ml-6 list-disc mt-2">
            <li>Fraude avérée lors de l'examen</li>
            <li>Falsification du document</li>
            <li>Erreur administrative nécessitant la réémission</li>
            <li>Décision judiciaire</li>
          </ul>
        </section>

        {/* 7 */}
        <section>
          <h2 className="text-xl font-bold text-slate-900 mb-3">7. Utilisation autorisée</h2>
          <p>Le titulaire d'une attestation est autorisé à :</p>
          <ul className="space-y-1 ml-6 list-disc mt-2">
            <li>Télécharger et imprimer son attestation</li>
            <li>Partager son attestation sur les réseaux sociaux (LinkedIn, WhatsApp, Facebook, X)</li>
            <li>Mentionner sa certification sur son CV ou profil professionnel</li>
            <li>Communiquer son code unique de vérification à des tiers (employeurs, recruteurs)</li>
          </ul>

          <p className="mt-2 font-bold">Il est interdit de :</p>
          <ul className="space-y-1 ml-6 list-disc mt-2">
            <li>Modifier, altérer ou falsifier le document</li>
            <li>Utiliser l'attestation d'un tiers comme sienne</li>
            <li>Revendre ou commercialiser l'attestation</li>
            <li>Prétendre à une certification non obtenue</li>
          </ul>
        </section>

        {/* 8 */}
        <section>
          <h2 className="text-xl font-bold text-slate-900 mb-3">8. Fraude et sanctions</h2>
          <p>
            Toute falsification, contrefaçon ou usage frauduleux d'une attestation entraîne :
          </p>
          <ul className="space-y-1 ml-6 list-disc mt-2">
            <li>La révocation immédiate de l'attestation concernée</li>
            <li>La suspension ou la suppression du compte de l'Utilisateur</li>
            <li>Des poursuites conformément à la législation en vigueur au Bénin</li>
          </ul>
          <p className="mt-2">
            Si vous suspectez une fraude, utilisez le{" "}
            <Link href="/signalement" className="text-emerald-600 underline hover:text-emerald-700">
              formulaire de signalement
            </Link>.
          </p>
        </section>

        {/* 9 */}
        <section>
          <h2 className="text-xl font-bold text-slate-900 mb-3">9. Réclamation</h2>
          <p>
            En cas d'erreur ou de problème concernant votre attestation, contactez-nous :
          </p>
          <div className="mt-4 p-6 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
            <p><strong>Ferme Agro-piscicole Saint André</strong></p>
            <p>Cotonou, Bénin</p>
            <p>Téléphone : +229 01 07 60 93</p>
          </div>
        </section>

        {/* 10 */}
        <section>
          <h2 className="text-xl font-bold text-slate-900 mb-3">10. Modification</h2>
          <p>
            La FSA se réserve le droit de modifier les présentes conditions à tout moment.
            Les modifications prennent effet dès leur publication sur cette page.
          </p>
        </section>
      </div>
    </div>
  );
}
