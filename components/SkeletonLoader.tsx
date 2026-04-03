import { Card } from "@/components/ui/card";

export function SkeletonCard() {
  return (
    <Card className="p-6 bg-white shadow-sm border border-slate-100 overflow-hidden relative">
      <div className="animate-pulse space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            <div className="w-12 h-12 rounded-lg bg-slate-100" />
            <div className="space-y-2 flex-1">
              <div className="h-4 bg-slate-100 rounded w-1/3" />
              <div className="h-3 bg-slate-50 rounded w-1/2" />
            </div>
          </div>
          <div className="w-16 h-6 bg-slate-100 rounded-full" />
        </div>
        
        {/* Content */}
        <div className="space-y-2">
          <div className="h-3 bg-slate-50 rounded w-full" />
          <div className="h-3 bg-slate-50 rounded w-5/6" />
        </div>

        {/* Info row */}
        <div className="flex gap-4 pt-2">
          <div className="h-3 bg-slate-100 rounded w-1/4" />
          <div className="h-3 bg-slate-100 rounded w-1/4" />
        </div>

        {/* Footer actions */}
        <div className="flex gap-2 pt-4 border-t border-slate-50">
          <div className="h-9 bg-slate-100 rounded-lg flex-1" />
          <div className="h-9 bg-slate-100 rounded-lg w-10" />
          <div className="h-9 bg-slate-100 rounded-lg w-10" />
        </div>
      </div>
    </Card>
  );
}

export function SkeletonStats() {
    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full">
            {[1, 2, 3, 4].map((i) => (
                <Card key={i} className="p-4 bg-white shadow-sm border-slate-50 overflow-hidden">
                    <div className="animate-pulse space-y-2">
                        <div className="h-3 bg-slate-100 rounded w-1/2" />
                        <div className="h-8 bg-slate-200 rounded w-3/4" />
                    </div>
                </Card>
            ))}
        </div>
    );
}
