import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { applyRateLimit } from "@/lib/rate-limit";

// ============================================================================
// #315 — Restreindre ou agréger les statistiques publiques
// ============================================================================
// Cette route est publique par nature (elle alimente la transparence du
// programme et reste lisible par les robots et les agrégateurs) mais elle
// n'est PAS anonymement inoffensive :
//
//  - elle se trouvait exemptée de tout rate limiting par `proxy.ts` (le
//    pré-filtre `/api/public`), donc rien ne protégeait l'origine ;
//  - elle publiait des compteurs d'EXPLOITATION bruts (`pending`,
//    `totalUsers`), qui ne sont pas des indicateurs de transparence.
//
// La réponse est désormais une WHITELIST stricte (aucun spread de ligne
// Prisma, cf. même démarche que #281 sur `/api/verifier`) construite à partir
// de deux familles de données seulement :
//
//   PUBLIC  — `validated` + les objectifs publiés (`targets`) : l'indicateur
//             d'impact « X attestations délivrées sur Y annoncées », dérivé
//             de mesures déjà rendues publiques ou fixées par l'admin.
//   PRIVÉ   — `pending` (taille de la file de validation) et `totalUsers`
//             (taille du vivier d'inscrits) : retirés, y compris de la base
//             (les deux COUNT sont supprimés, pas seulement masqués).
//
// `dynamic = "force-dynamic"` : la route lit la requête pour le quota. En
// `revalidate`, le code de la route ne s'exécuterait qu'à la RÉGÉNÉRATION du
// cache (~1 fois/heure) — le quota ne serait donc jamais appliqué, ce qui en
// ferait une protection purement cosmétique. La politique de cache est
// conservée, mais portée par l'en-tête `Cache-Control` explicite ci-dessous
// (qui prime sur la valeur par défaut de `force-dynamic`) : c'est l'edge qui
// absorbe le trafic légitime, et le quota ne borne que ce qui atteint
// réellement l'origine.

export const dynamic = "force-dynamic";

/**
 * Politique de cache : 1 h côté CDN, tolérance de 59 s pour le
 * `stale-while-revalidate` (un agrégateur qui rate l'échéance est servi
 * pendant une minute au lieu d'attendre la régénération).
 */
const CACHE_CONTROL = "public, s-maxage=3600, stale-while-revalidate=59";

/** Valeurs de repli des objectifs, alignées sur `app/api/admin/settings`. */
const DEFAULT_TARGETS = {
  attestations: 300,
  inscriptions: 500,
  validations: 450,
} as const;

/**
 * Quota : seau DÉDIÉ `publicStats` (600 req/min par IP, soit 10 req/s), et non
 * le seau générique `api` (100 req/min). Raison du détachement : sous un même
 * NAT — un campus, une entreprise, un opérateur mobile — l'IP d'un
 * administrateur, qui est derrière une authentification, et celle d'un robot,
 * qui ne l'est pas, se retrouvaient à partager le même budget. Le robot pouvait
 * donc consommer le quota de l'administrateur, et réciproquement : deux
 * populations aux profils de risque opposés, un seul compteur. Les séparer, c'est
 * le seul découpage symétriquement faisable.
 *
 * Budget volontairement large : la route est publique, servie par le cache de
 * l'edge (`s-maxage=3600`) et ne fait que deux COUNT. Sur un déploiement sans
 * CDN, chaque affichage de page atteint l'origine, et toute une école se
 * partage une seule IP publique : un quota serré casserait des visiteurs
 * légitimes avant d'attraper un robot. Le quota borne ici l'amplification
 * d'un `for i in seq 1 10000` sur deux COUNT d'index — on protège l'origine,
 * on ne bride personne.
 *
 * IP seule, PAS de double comptage `applyRateLimitByUser` : cette route est
 * anonyme, donc le seau de session serait `sess:anonymous` — un seau PARTAGÉ
 * par tous les visiteurs sans session, qui ferait tomber le site public dès
 * le premier crawling légitime. Un seau dédié par IP est précisément ce qui
 * rend le budget de l'administrateur insensible au trafic des robots.
 *
 * Fail-OPEN (filet mémoire) : `publicStats` n'est pas dans
 * `FAIL_CLOSED_LIMIT_TYPES` de `lib/rate-limit.ts`, liste explicitement
 * réservée aux endpoints sensibles (auth, upload, mutation, devinette de
 * secret). Un compteur public mis en cache n'en est pas un, et un 503 le
 * temps d'une panne Upstash mettrait un indicateur de transparence hors ligne
 * pour tout le monde — l'inverse de sa fonction. La dégradation assumée est le
 * filet mémoire (compteur réel, mais par instance), pas une ouverture.
 */
const STATS_LIMIT_TYPE = "publicStats" as const;

export async function GET(request: Request) {
  try {
    // 1. Quota AVANT toute lecture base : un flood ne coûte pas un seul COUNT.
    const rateLimit = await applyRateLimit(request, STATS_LIMIT_TYPE);
    if (!rateLimit.allowed) {
      return rateLimit.response;
    }

    const [validated, settings] = await Promise.all([
      prisma.attestation.count({
        where: { status: "VALIDATED" },
      }),
      prisma.settings.findFirst(),
    ]);

    const targets = {
      attestations: settings?.targetAttestations || DEFAULT_TARGETS.attestations,
      inscriptions: settings?.targetInscriptions || DEFAULT_TARGETS.inscriptions,
      validations: settings?.targetValidations || DEFAULT_TARGETS.validations,
    };

    // Avancement sur l'objectif ANNONCÉ (donnée publique, fixée par l'admin),
    // jamais sur le nombre d'inscrits (donnée privée). Le ratio répond à la
    // seule question réellement publique — « à quel niveau du programme
    // annoncé en sommes-nous ? » — à partir d'entrées déjà publiques, donc
    // il n'est pas invertible pour en déduire un compte brut non publié.
    const progressRatio =
      targets.attestations > 0
        ? Math.round((validated / targets.attestations) * 100) / 100
        : 0;

    return NextResponse.json(
      {
        // WHITELIST stricte : ni `pending`, ni `totalUsers`, ni `rejected`.
        validated,
        targets,
        progressRatio,
        cachedAt: new Date().toISOString(),
      },
      {
        status: 200,
        headers: {
          "Cache-Control": CACHE_CONTROL,
          ...rateLimit.headers,
        },
      },
    );
  } catch (error) {
    console.error("[API STATS] Error:", error);
    return NextResponse.json(
      { message: "Erreur lors de la récupération des statistiques" },
      { status: 500 },
    );
  }
}
