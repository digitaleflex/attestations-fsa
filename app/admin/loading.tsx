import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Attente du back-office (#84).
 *
 * Le tableau de bord lit six compteurs en base : sans cet écran de transition,
 * l'administrateur voit le fond vide de la console pendant la requête, sans
 * savoir si la page arrive. La structure du squelette reprend celle de
 * `app/admin/dashboard/page.tsx` (en-tête, titre de section, quatre cartes) :
 * le contenu arrive dans la même géométrie, donc sans saut de mise en page une
 * fois les chiffres remplacés.
 *
 * Le bloc est une région `status` (annonce polie, non interrompante) marquée
 * `aria-busy`, avec un libellé textuel pour les lecteurs d'écran ; les
 * rectangles, eux, sont masqués — des formes vides n'ont rien à annoncer.
 */
export default function AdminLoading() {
  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-8 min-h-screen">
      <div role="status" aria-live="polite" aria-busy="true">
        <span className="sr-only">Chargement de la console d&apos;administration…</span>

        <div aria-hidden="true" className="space-y-8 animate-in fade-in duration-300">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="space-y-3">
              <Skeleton className="h-6 w-36 rounded-full" />
              <Skeleton className="h-10 w-64" />
              <Skeleton className="h-4 w-80" />
            </div>
            <Skeleton className="h-12 w-56 rounded-2xl" />
          </div>

          <div>
            <Skeleton className="mb-4 h-5 w-40" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[0, 1, 2, 3].map((index) => (
                <Card
                  key={index}
                  className="p-6 border-none shadow-sm bg-white rounded-3xl"
                >
                  <Skeleton className="mb-6 h-12 w-12 rounded-2xl" />
                  <Skeleton className="mb-3 h-4 w-28" />
                  <Skeleton className="h-9 w-20" />
                  <Skeleton className="mt-3 h-3 w-32" />
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
