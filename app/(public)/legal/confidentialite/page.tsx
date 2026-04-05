import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Politique de Confidentialité – Ferme St André",
  description: "Découvrez comment la Ferme St André collecte, utilise et protège vos données personnelles.",
};

export default function ConfidentialitePage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <div className="mb-10">
        <Link href="/" className="text-sm font-bold text-emerald-600 hover:text-emerald-700 transition-colors inline-flex items-center gap-1">
          ← Retour à l'accueil
        </Link>
      </div>

      <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-2">
        Politique de Confidentialité
      </h1>
      <p className="text-sm text-slate-500 mb-12">
        Dernière mise à jour : avril 2026
      </p>

      <div className="space-y-10 text-slate-700 leading-relaxed">
        {/* 1 */}
        <section>
          <h2 className="text-xl font-bold text-slate-900 mb-3">1. Introduction</h2>
          <p>
            La <strong>Ferme Agro-piscicole Saint André</strong> (ci-après « FSA ») s'engage à protéger la vie privée
            de ses utilisateurs. Cette politique de confidentialité explique comment nous collectons, utilisons,
            stockons et protégeons vos données personnelles lorsque vous utilisez notre plateforme
            accessible à l'adresse officielle.
          </p>
          <p className="mt-2">
            En utilisant nos services, vous acceptez les pratiques décrites dans la présente politique.
          </p>
        </section>

        {/* 2 */}
        <section>
          <h2 className="text-xl font-bold text-slate-900 mb-3">2. Responsable du traitement</h2>
          <p>
            Le responsable du traitement des données personnelles est la <strong>Ferme Agro-piscicole Saint André</strong>,
            située à <strong>Cotonou, Bénin</strong>.
          </p>
          <p className="mt-2">
            Pour toute question relative à vos données, vous pouvez nous contacter :
          </p>
          <ul className="mt-2 space-y-1 ml-6 list-disc">
            <li>Téléphone : <strong>+229 01 91 07 60 93</strong></li>
            <li>Adresse : <strong>Cotonou, Bénin</strong></li>
          </ul>
        </section>

        {/* 3 */}
        <section>
          <h2 className="text-xl font-bold text-slate-900 mb-3">3. Données collectées</h2>
          <p>Nous collectons les catégories de données suivantes :</p>

          <h3 className="font-bold text-slate-800 mt-4 mb-2">3.1 Données fournies directement par l'utilisateur</h3>
          <ul className="space-y-1 ml-6 list-disc">
            <li><strong>Identité</strong> : nom, prénom, date de naissance</li>
            <li><strong>Coordonnées</strong> : adresse e-mail, numéro de téléphone, adresse postale</li>
            <li><strong>Informations académiques</strong> : formation suivie, résultats d'examens, date d'obtention</li>
            <li><strong>Documents</strong> : pièces justificatives envoyées lors de l'inscription ou du signalement</li>
          </ul>

          <h3 className="font-bold text-slate-800 mt-4 mb-2">3.2 Données collectées automatiquement</h3>
          <ul className="space-y-1 ml-6 list-disc">
            <li><strong>Données de connexion</strong> : adresse IP, type de navigateur, appareil utilisé</li>
            <li><strong>Données de session</strong> : cookies de session, jetons d'authentification</li>
            <li><strong>Données d'usage</strong> : pages visitées, actions effectuées, durée des sessions</li>
          </ul>

          <h3 className="font-bold text-slate-800 mt-4 mb-2">3.3 Données relatives aux examens</h3>
          <ul className="space-y-1 ml-6 list-disc">
            <li>Réponses aux questions d'examens</li>
            <li>Scores et résultats</li>
            <li>Historique des tentatives</li>
            <li>Données de surveillance anti-fraude (changements d'onglet, temps de réponse)</li>
          </ul>
        </section>

        {/* 4 */}
        <section>
          <h2 className="text-xl font-bold text-slate-900 mb-3">4. Finalités du traitement</h2>
          <p>Nous utilisons vos données pour :</p>
          <ul className="space-y-1 ml-6 list-disc">
            <li>Créer et gérer votre compte utilisateur</li>
            <li>Organiser et évaluer vos examens en ligne</li>
            <li>Générer et délivrer vos attestations de certification</li>
            <li>Permettre la vérification publique de l'authenticité de vos attestations</li>
            <li>Assurer la sécurité de la plateforme et prévenir la fraude</li>
            <li>Répondre à vos demandes de support et signalements</li>
            <li>Améliorer nos services et l'expérience utilisateur</li>
            <li>Respecter nos obligations légales et réglementaires</li>
          </ul>
        </section>

        {/* 5 */}
        <section>
          <h2 className="text-xl font-bold text-slate-900 mb-3">5. Base légale du traitement</h2>
          <p>Le traitement de vos données repose sur :</p>
          <ul className="space-y-1 ml-6 list-disc">
            <li><strong>Votre consentement</strong> : lors de la création de votre compte et l'acceptation de cette politique</li>
            <li><strong>L'exécution du service</strong> : gestion des examens, délivrance des attestations</li>
            <li><strong>Notre intérêt légitime</strong> : sécurité de la plateforme, amélioration des services</li>
            <li><strong>Obligations légales</strong> : conservation des archives, conformité réglementaire</li>
          </ul>
        </section>

        {/* 6 */}
        <section>
          <h2 className="text-xl font-bold text-slate-900 mb-3">6. Partage des données</h2>
          <p>
            <strong>Nous ne vendons jamais vos données personnelles.</strong>
          </p>
          <p className="mt-2">Vos données peuvent être partagées uniquement dans les cas suivants :</p>
          <ul className="space-y-1 ml-6 list-disc">
            <li><strong>Vérification publique</strong> : lors de la vérification d'une attestation, seules les informations suivantes sont affichées : nom, prénom, formation, date d'obtention. Aucune donnée sensible n'est visible.</li>
            <li><strong>Sous-traitants techniques</strong> : hébergeurs, fournisseurs de services cloud, dans le cadre strict de l'exécution du service</li>
            <li><strong>Autorités compétentes</strong> : en cas d'obligation légale ou de réquisition judiciaire</li>
          </ul>
        </section>

        {/* 7 */}
        <section>
          <h2 className="text-xl font-bold text-slate-900 mb-3">7. Durée de conservation</h2>
          <ul className="space-y-1 ml-6 list-disc">
            <li><strong>Données de compte</strong> : conservées tant que votre compte est actif</li>
            <li><strong>Attestations et résultats</strong> : conservées de manière permanente pour permettre la vérification</li>
            <li><strong>Données de connexion et logs</strong> : conservées pendant 12 mois</li>
            <li><strong>Signalements</strong> : conservés pendant 24 mois après traitement</li>
          </ul>
          <p className="mt-2">
            Après suppression de votre compte, les données liées à vos attestations restent consultables
            car elles constituent une preuve de certification publique.
          </p>
        </section>

        {/* 8 */}
        <section>
          <h2 className="text-xl font-bold text-slate-900 mb-3">8. Sécurité des données</h2>
          <p>
            Nous mettons en œuvre des mesures techniques et organisationnelles appropriées pour protéger
            vos données :
          </p>
          <ul className="space-y-1 ml-6 list-disc">
            <li>Chiffrement des mots de passe et des données sensibles</li>
            <li>Connexion sécurisée via HTTPS/SSL</li>
            <li>Contrôle d'accès et authentification des utilisateurs</li>
            <li>Sauvegardes régulières et sécurisées</li>
            <li>Surveillance proactive des activités suspectes</li>
            <li>Accès restreint aux données pour le personnel autorisé uniquement</li>
          </ul>
        </section>

        {/* 9 */}
        <section>
          <h2 className="text-xl font-bold text-slate-900 mb-3">9. Vos droits</h2>
          <p>
            Conformément à la réglementation applicable en matière de protection des données, vous disposez des droits suivants :
          </p>
          <ul className="space-y-1 ml-6 list-disc">
            <li><strong>Droit d'accès</strong> : obtenir la confirmation que vos données sont traitées et en recevoir une copie</li>
            <li><strong>Droit de rectification</strong> : corriger des données inexactes ou incomplètes</li>
            <li><strong>Droit à l'effacement</strong> : demander la suppression de vos données (sous réserve des obligations de conservation liées aux attestations)</li>
            <li><strong>Droit à la portabilité</strong> : recevoir vos données dans un format structuré</li>
            <li><strong>Droit d'opposition</strong> : vous opposer au traitement de vos données pour des motifs légitimes</li>
            <li><strong>Droit à la limitation</strong> : demander la limitation du traitement de vos données</li>
          </ul>
          <p className="mt-2">
            Pour exercer vos droits, contactez-nous à <strong>+229 01 91 07 60 93</strong> ou par courrier �
            <strong> Cotonou, Bénin</strong>.
          </p>
        </section>

        {/* 10 */}
        <section>
          <h2 className="text-xl font-bold text-slate-900 mb-3">10. Cookies et technologies similaires</h2>
          <p>
            Notre plateforme utilise des cookies et technologies similaires pour :
          </p>
          <ul className="space-y-1 ml-6 list-disc">
            <li>Assurer le bon fonctionnement de la session utilisateur</li>
            <li>Maintenir votre authentification</li>
            <li>Améliorer l'expérience de navigation</li>
            <li>Analyser l'utilisation du site à des fins statistiques</li>
          </ul>
          <p className="mt-2">
            Pour plus de détails, consultez notre{" "}
            <Link href="/legal/cookies" className="text-emerald-600 underline hover:text-emerald-700">
              Politique de cookies
            </Link>.
          </p>
        </section>

        {/* 11 */}
        <section>
          <h2 className="text-xl font-bold text-slate-900 mb-3">11. Transferts de données</h2>
          <p>
            Vos données sont hébergées sur des serveurs situés{" "}
            <strong>[préciser la localisation de l'hébergeur]</strong>.
            En utilisant nos services, vous consentez à ce transfert.
          </p>
        </section>

        {/* 12 */}
        <section>
          <h2 className="text-xl font-bold text-slate-900 mb-3">12. Modification de la politique</h2>
          <p>
            La FSA se réserve le droit de modifier cette politique de confidentialité à tout moment.
            Toute modification sera publiée sur cette page avec la date de mise à jour. Nous vous
            encourageons à consulter régulièrement cette page.
          </p>
        </section>

        {/* 13 */}
        <section>
          <h2 className="text-xl font-bold text-slate-900 mb-3">13. Contact</h2>
          <p>
            Pour toute question relative à cette politique de confidentialité ou au traitement de vos données personnelles :
          </p>
          <div className="mt-4 p-6 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
            <p><strong>Ferme Agro-piscicole Saint André</strong></p>
            <p>Cotonou, Bénin</p>
            <p>Téléphone : +229 01 91 07 60 93</p>
          </div>
        </section>
      </div>
    </div>
  );
}
