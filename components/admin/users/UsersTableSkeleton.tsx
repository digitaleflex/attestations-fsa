import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

const COLUMNS = 8;

/**
 * Skeleton du tableau Apprenants — préserve la structure
 * (en-tête + lignes) pour éviter les sauts visuels (CLS).
 */
export function UsersTableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div aria-hidden="true">
      <div className="hidden md:block">
        <div className="flex gap-4 border-b border-slate-100 px-4 py-3">
          {Array.from({ length: COLUMNS }).map((_, i) => (
            <Skeleton key={i} className="h-4 flex-1" />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, r) => (
          <div
            key={r}
            className="flex items-center gap-4 border-b border-slate-50 px-4 py-4"
          >
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="ml-auto h-9 w-24 rounded-xl" />
          </div>
        ))}
      </div>
      <div className="space-y-4 md:hidden">
        {Array.from({ length: 3 }).map((_, r) => (
          <Card key={r} className="space-y-3 p-4">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <div className="flex gap-2">
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-6 w-24 rounded-full" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
