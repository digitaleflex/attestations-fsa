import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Conditions Générales d'Utilisation – Ferme St André",
  description: "Conditions générales d'utilisation de la plateforme Ferme St André.",
};

export default function CGUPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <div className="mb-10">
        <Link href="/" className="text-sm font-bold text-brand hover:text-brand-dark transition-colors inline-flex items-center gap-1">
          ← Retour à l'accueil
        </Link>
      </div>

      <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-2">
        Conditions Générales d'Utilisation
      </h1>
      <p className="text-sm text-slate-500 mb-12">
        Dernière mise à jour : avril 2026
      </p>

      <div className="space-y-10 text-slate-700 leading-relaxed">
        {/* 1 */}
        <section>
          <h2 className="text-xl font-bold text-slate-900 mb-3">1. Objet</h2>
          <p>
            Les présentes conditions générales d'utilisation (ci-après « CGU ») régissent l'accès et
            l'utilisation de la plateforme en ligne de la <strong>Ferme Agro-piscicole Saint André</strong>
            (ci-après « FSA » ou « la Plateforme »).
          </p>
          <p className="mt-2">
            En accédant à la Plateforme, l'utilisateur (ci-après « l'Utilisateur ») reconnaît avoir lu,
            compris et accepté ces conditions dans leur intégralité.
          </p>
        </section>

        {/* 2 */}
        <section>
          <h2 className="text-xl font-bold text-slate-900 mb-3">2. Identification de l'éditeur</h2>
          <div className="mt-4 p-6 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
            <p><strong>Raison sociale :</strong> Ferme Agro-piscicole Saint André</p>
            <p><strong>Siège :</strong> Abomey-Calavi, Bénin</p>
            <p><strong>Téléphone :</strong> +229 01 91 07 60 93</p>
          </div>
        </section>

        {/* 3 */}
        <section>
          <h2 className="text-xl font-bold text-slate-900 mb-3">3. Accès à la Plateforme</h2>
          <h3 className="font-bold text-slate-800 mt-4 mb-2">3.1 Disponibilité</h3>
          <p>
            La Plateforme est accessible 24h/24 et 7j/7, sous réserve des interruptions nécessaires
            à sa maintenance ou en cas de force majeure.
          </p>

          <h3 className="font-bold text-slate-800 mt-4 mb-2">3.2 Inscription</h3>
          <p>
            L'accès à certaines fonctionnalités (examens, attestations) nécessite la création d'un compte.
            L'Utilisateur s'engage à fournir des informations exactes, complètes et à jour lors de son inscription.
          </p>

          <h3 className="font-bold text-slate-800 mt-4 mb-2">3.3 Identifiants</h3>
          <p>
            L'Utilisateur est responsable de la confidentialité de ses identifiants de connexion et de
            toutes les activités effectuées sous son compte. Toute utilisation non autorisée doit être
            signalée immédiatement à la FSA.
          </p>
        </section>

        {/* 4 */}
        <section>
          <h2 className="text-xl font-bold text-slate-900 mb-3">4. Services proposés</h2>
          <p>La Plateforme offre les services suivants :</p>
          <ul className="space-y-1 ml-6 list-disc mt-2">
            <li><strong>Passage d'examens en ligne</strong> : évaluations dans les domaines de la pisciculture, l'agriculture et l'élevage</li>
            <li><strong>Délivrance d'attestations</strong> : certificats numériques vérifiables avec code unique</li>
            <li><strong>Vérification d'attestations</strong> : service public et gratuit permettant à quiconque de vérifier l'authenticité d'un certificat</li>
            <li><strong>Demandes de stage</strong> : formulaires de candidature pour les formations pratiques</li>
            <li><strong>Ressources pédagogiques</strong> : documents et supports de formation</li>
            <li><strong>Signalements</strong> : système de reporting pour fraudes ou problèmes techniques</li>
          </ul>
        </section>

        {/* 5 */}
        <section>
          <h2 className="text-xl font-bold text-slate-900 mb-3">5. Règles d'utilisation</h2>
          <p>L'Utilisateur s'engage à :</p>
          <ul className="space-y-1 ml-6 list-disc mt-2">
            <li>Utiliser la Plateforme de manière honnête et conforme à sa destination</li>
            <li>Ne pas falsifier ou tenter de falsifier les attestations délivrées</li>
            <li>Ne pas utiliser de moyen frauduleux pendant les examens (tricherie, usage de documents non autorisés, assistance extérieure)</li>
            <li>Ne pas perturber le bon fonctionnement de la Plateforme (attaques, scripts malveillants, surcharge)</li>
            <li>Ne pas tenter d'accéder aux données d'autres utilisateurs</li>
            <li>Fournir des informations véridiques lors de l'inscription</li>
            <li>Signaler toute activité suspecte ou tout problème technique</li>
          </ul>
        </section>

        {/* 6 */}
        <section>
          <h2 className="text-xl font-bold text-slate-900 mb-3">6. Examens et évaluations</h2>
          <h3 className="font-bold text-slate-800 mt-4 mb-2">6.1 Conditions de passage</h3>
          <p>
            Les examens sont accessibles aux Utilisateurs inscrits et connectés. La FSA se réserve le
            droit de définir les conditions d'éligibilité à chaque examen.
          </p>

          <h3 className="font-bold text-slate-800 mt-4 mb-2">6.2 Intégrité des examens</h3>
          <p>
            La Plateforme met en place des mécanismes de surveillance pour garantir l'intégrité des
            examens, incluant notamment le suivi des changements d'onglet et l'analyse des patterns
            de réponse. Toute tentative de fraude entraînera l'annulation immédiate de l'examen.
          </p>

          <h3 className="font-bold text-slate-800 mt-4 mb-2">6.3 Résultats</h3>
          <p>
            Les résultats sont générés automatiquement après soumission et sont disponibles dans
            l'espace personnel de l'Utilisateur. Ils ne sont pas susceptibles de réclamation,
            sauf en cas d'erreur technique avérée.
          </p>

          <h3 className="font-bold text-slate-800 mt-4 mb-2">6.4 Tentatives multiples</h3>
          <p>
            La FSA peut limiter le nombre de tentatives autorisées pour un même examen.
            Toute tentative de contournement de cette limite est interdite.
          </p>
        </section>

        {/* 7 */}
        <section>
          <h2 className="text-xl font-bold text-slate-900 mb-3">7. Attestations et certifications</h2>
          <h3 className="font-bold text-slate-800 mt-4 mb-2">7.1 Délivrance</h3>
          <p>
            Une attestation est délivrée à tout Utilisateur ayant réussi l'examen correspondant.
            Elle contient un code unique permettant sa vérification publique.
          </p>

          <h3 className="font-bold text-slate-800 mt-4 mb-2">7.2 Vérification</h3>
          <p>
            Toute personne peut vérifier l'authenticité d'une attestation en saisissant son code
            unique sur la page de vérification. Les informations affichées sont limitées au nom,
            prénom, formation et date d'obtention.
          </p>

          <h3 className="font-bold text-slate-800 mt-4 mb-2">7.3 Propriété</h3>
          <p>
            L'attestation reste la propriété de la FSA. Elle est accordée à titre personnel et
            non transférable. Toute utilisation commerciale ou frauduleuse est interdite.
          </p>
        </section>

        {/* 8 */}
        <section>
          <h2 className="text-xl font-bold text-slate-900 mb-3">8. Propriété intellectuelle</h2>
          <p>
            L'ensemble des contenus de la Plateforme (textes, images, logos, examens, code source,
            base de données) est la propriété exclusive de la FSA ou de ses partenaires.
          </p>
          <p className="mt-2">
            Toute reproduction, représentation, modification ou exploitation, même partielle, est
            strictement interdite sans autorisation écrite préalable.
          </p>
        </section>

        {/* 9 */}
        <section>
          <h2 className="text-xl font-bold text-slate-900 mb-3">9. Responsabilité</h2>
          <h3 className="font-bold text-slate-800 mt-4 mb-2">9.1 De la FSA</h3>
          <p>
            La FSA s'engage à assurer le bon fonctionnement de la Plateforme. Toutefois, la FSA
            ne saurait être tenue responsable des dommages indirects résultant de l'utilisation
            ou de l'impossibilité d'utilisation du service.
          </p>

          <h3 className="font-bold text-slate-800 mt-4 mb-2">9.2 De l'Utilisateur</h3>
          <p>
            L'Utilisateur est responsable de l'usage qu'il fait de la Plateforme et s'engage à
            respecter les présentes CGU ainsi que la législation en vigueur.
          </p>
        </section>

        {/* 10 */}
        <section>
          <h2 className="text-xl font-bold text-slate-900 mb-3">10. Protection des données personnelles</h2>
          <p>
            La collecte et le traitement des données personnelles des Utilisateurs sont régis par
            notre{" "}
            <Link href="/legal/confidentialite" className="text-brand underline hover:text-brand-dark">
              Politique de Confidentialité
            </Link>
            , qui fait partie intégrante des présentes CGU.
          </p>
        </section>

        {/* 11 */}
        <section>
          <h2 className="text-xl font-bold text-slate-900 mb-3">11. Suspension et résiliation</h2>
          <p>
            La FSA se réserve le droit de suspendre ou résilier le compte d'un Utilisateur en cas
            de non-respect des présentes CGU, sans préavis et sans indemnité, notamment en cas de :
          </p>
          <ul className="space-y-1 ml-6 list-disc mt-2">
            <li>Fraude ou tentative de fraude lors d'un examen</li>
            <li>Falsification d'attestation</li>
            <li>Utilisation abusive ou malveillante de la Plateforme</li>
            <li>Fourniture d'informations fausses lors de l'inscription</li>
          </ul>
        </section>

        {/* 12 */}
        <section>
          <h2 className="text-xl font-bold text-slate-900 mb-3">12. Modification des CGU</h2>
          <p>
            La FSA se réserve le droit de modifier les présentes CGU à tout moment. Les modifications
            prendront effet dès leur publication sur la Plateforme. L'utilisation continue de la
            Plateforme après modification vaut acceptation des nouvelles conditions.
          </p>
        </section>

        {/* 13 */}
        <section>
          <h2 className="text-xl font-bold text-slate-900 mb-3">13. Droit applicable et juridiction</h2>
          <p>
            Les présentes CGU sont soumises au droit en vigueur au <strong>Bénin</strong>. En cas de
            litige, les parties s'efforceront de trouver une solution amiable. À défaut, le litige
            sera porté devant les tribunaux compétents de Cotonou, Bénin.
          </p>
        </section>

        {/* 14 */}
        <section>
          <h2 className="text-xl font-bold text-slate-900 mb-3">14. Contact</h2>
          <div className="mt-4 p-6 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
            <p><strong>Ferme Agro-piscicole Saint André</strong></p>
            <p>Abomey-Calavi, Bénin</p>
            <p>Téléphone : +229 01 91 07 60 93</p>
          </div>
        </section>
      </div>
    </div>
  );
}
