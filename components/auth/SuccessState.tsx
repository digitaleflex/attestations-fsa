import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * État de succès plein écran allégé : confirmation puis action unique.
 */
export function SuccessState({
  title,
  description,
  actionLabel,
  actionHref,
}: {
  title: string;
  description: string;
  actionLabel: string;
  actionHref: string;
}) {
  return (
    <div
      role="status"
      className="flex flex-col items-center py-4 text-center"
    >
      <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-700">
        <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
      </span>
      <h2 className="text-xl font-extrabold tracking-tight text-slate-900">
        {title}
      </h2>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-slate-600">
        {description}
      </p>
      <Link href={actionHref} className="mt-6 w-full">
        <Button className="h-12 w-full rounded-xl bg-brand text-base font-semibold text-white hover:bg-brand-dark">
          {actionLabel}
        </Button>
      </Link>
    </div>
  );
}
